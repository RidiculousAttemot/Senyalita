"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RecognitionState, RealPredictionResult, RecognitionCategory } from "./types";
import { InferenceResult } from "./model";
import { SequenceBuffer, SEQUENCE_LENGTH, MINIMUM_FRAMES, HandData } from "./buffer";
import { PredictionSmoother } from "./smoothing";
import { MotionDetector, MotionState, IDLE_FRAMES } from "./motionDetection";
import { translateResult, getRecognitionCategory } from "./translation";
import { loadModel, infer, getCachedResult } from "./model";
import { ModeManager, type RecognitionMode } from "./recognitionModes";
import { RecognitionPriorityManager } from "./priority";


const INFERENCE_INTERVAL_MS = 100;
const FAST_INFERENCE_INTERVAL_MS = 50;
const EARLY_INFERENCE_INTERVAL_MS = 30;
const MIN_FRAMES_FOR_EARLY_INFERENCE = 5;
const MIN_FRAMES_FOR_FAST_INFERENCE = 8;
const FREEZE_HYSTERESIS_FRAMES = 10;
const EARLY_CONFIDENCE_THRESHOLD = 0.85;
const STABLE_FREEZE_FRAMES = 8;
const UI_UPDATE_INTERVAL_MS = 300;

/**
 * Detecting that a settled sign has ended, by confidence collapse.
 *
 * Fingerspelling cannot use MotionDetector for this: a letter-to-letter
 * reshape spread over 5-20 frames produces 0.003-0.012 mean landmark motion,
 * entirely under MOTION_THRESHOLD (0.015), while merely *holding* a letter
 * produces up to 0.019 at p95. The noise exceeds the signal, so no value of
 * that threshold separates them and lowering it clears the buffer mid-letter.
 */
const SIGN_END_DROP_RATIO = 0.7;
/** Consecutive low samples required — at 100ms inference, ~200ms of hysteresis. */
const SIGN_END_FRAMES = 2;
/** Never armed by a low-confidence read, only by one worth calling settled. */
const SIGN_END_MIN_PEAK = 0.6;

export type RecognitionControls = {
  state: RecognitionState;
  appendFrame: (left: HandData | null, right: HandData | null) => void;
  resetRecognition: () => void;
  clearSequence: () => void;
  bufferLength: number;
  bufferCap: number;
  minimumFrames: number;
  inferenceTimeMs: number;
  frozenPrediction: RealPredictionResult | null;
  motionState: MotionState;
  /** Diagnostic: peak per-frame motion vs the threshold that gates gesturing. */
  motionPeak: { peak: number; threshold: number };
  mode: RecognitionMode;
  setMode: (mode: RecognitionMode) => void;
};

export type OnPredictionCallback = (
  result: InferenceResult,
  inferenceTimeMs: number
) => void;

/**
 * @param allowedLabels Restricts which classes can be predicted, by raw model
 * label. Omit it — as /evaluation does — and all 131 compete.
 *
 * Restricting here rather than discarding downstream is deliberate: a consumer
 * that drops out-of-scope predictions shows nothing whenever the model prefers
 * a class it does not want, which with 95 phrase classes against 36 in scope
 * is most noisy frames.
 */
export const useRecognition = (
  onPrediction?: OnPredictionCallback,
  fastMode?: boolean,
  allowedLabels?: ReadonlySet<string>,
): RecognitionControls => {
  // Read inside the interval callback, which closes over its initial value.
  const allowedLabelsRef = useRef(allowedLabels);
  allowedLabelsRef.current = allowedLabels;
  const [state, setState] = useState<RecognitionState>({
    stage: "loading-model"
  });

  const bufferRef = useRef<SequenceBuffer | null>(null);
  const smootherRef = useRef<PredictionSmoother | null>(null);
  const motionDetectorRef = useRef<MotionDetector | null>(null);
  const modeManagerRef = useRef<ModeManager | null>(null);
  const priorityManagerRef = useRef<RecognitionPriorityManager | null>(null);
  const modelReadyRef = useRef(false);
  const inferenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPredictionRef = useRef(onPrediction);
  const [frozenPrediction, setFrozenPrediction] = useState<RealPredictionResult | null>(null);
  const [motionState, setMotionState] = useState<MotionState>("idle");
  const [motionPeak, setMotionPeak] = useState<{ peak: number; threshold: number }>({ peak: 0, threshold: 0 });
  const [mode, setModeState] = useState<RecognitionMode>("auto");
  const freezeCounterRef = useRef(0);
  const noMotionCounterRef = useRef(0);
  const [bufferLength, setBufferLength] = useState(0);
  const [inferenceTimeMs, setInferenceTimeMs] = useState(0);
  const lastStaticFrameRef = useRef<Float32Array | null>(null);
  const stableLabelRef = useRef<string | null>(null);
  const stableCountRef = useRef(0);
  const lastResultRef = useRef<string | null>(null);
  const lastUiUpdateRef = useRef(0);
  /** Guards against overlapping inference passes on slow devices. */
  const inferenceInFlightRef = useRef(false);
  /** Highest confidence seen for the sign currently in the buffer. */
  const peakConfidenceRef = useRef(0);
  const lowConfidenceCountRef = useRef(0);
  onPredictionRef.current = onPrediction;

  const setMode = useCallback((newMode: RecognitionMode) => {
    setModeState(newMode);
    modeManagerRef.current?.setMode(newMode);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      bufferRef.current = new SequenceBuffer();
      smootherRef.current = new PredictionSmoother();
      motionDetectorRef.current = new MotionDetector();
      modeManagerRef.current = new ModeManager();
      priorityManagerRef.current = new RecognitionPriorityManager();
      modelReadyRef.current = false;

      await loadModel();

      if (!mounted) return;

      if (getCachedResult().status === "ready") {
        modelReadyRef.current = true;

        setState({ stage: "predicting", result: null });

        const interval = fastMode ? FAST_INFERENCE_INTERVAL_MS : INFERENCE_INTERVAL_MS;
        const earlyInterval = fastMode ? EARLY_INFERENCE_INTERVAL_MS : FAST_INFERENCE_INTERVAL_MS;

        inferenceTimerRef.current = setInterval(async () => {
          if (!modelReadyRef.current || !bufferRef.current) return;
          // Never run two inferences at once.
          //
          // This callback is async and the timer does not wait for it. On
          // desktop a pass takes 10-20ms against a 100ms tick, so they never
          // overlapped and the missing guard was invisible. On mobile a pass
          // can take 300-500ms: the timer keeps firing, passes pile up, and
          // each one allocates tensors and runs a forward pass on the main
          // thread — starving the camera's requestAnimationFrame loop.
          //
          // Reported as 2 FPS with signs never recognised. The camera was not
          // slow; it was being crowded out by its own backlog.
          //
          // Skipping while busy also paces inference to whatever the device
          // can actually sustain, instead of a rate chosen for a laptop.
          if (inferenceInFlightRef.current) return;

          const currentMode = modeManagerRef.current?.getMode() ?? "auto";

          // Use adaptive sampling for early prediction
          const { sample, usedEarly, frameCount } = bufferRef.current.adaptiveSample(EARLY_CONFIDENCE_THRESHOLD);
          if (!sample) return;

          // Claimed here, not above: `sample` is null whenever the buffer is
          // below MINIMUM_FRAMES — at startup and after every clear — so
          // claiming before that early return would strand the flag on the
          // first tick and stop inference permanently.
          inferenceInFlightRef.current = true;

          

          const inferStart = performance.now();

          try {
            const temporalResult = await infer(sample, allowedLabelsRef.current);
            if (!temporalResult || !mounted) return;
            const elapsed = performance.now() - inferStart;

            // Debounce inference time display to avoid extra re-renders
            if (performance.now() - lastUiUpdateRef.current > UI_UPDATE_INTERVAL_MS) {
              setInferenceTimeMs(elapsed);
              lastUiUpdateRef.current = performance.now();
            }

            

            const translated = translateResult(temporalResult);
            const smoothed = smootherRef.current?.smooth(translated) ?? translated;

            // A settled sign ending shows up as a confidence collapse long
            // before the label changes. Measured a -> b against the served
            // model: settled on "a" at 90.7%, frame 1 already 56.7%, but the
            // label does not flip to "b" until frame 71 (2367ms) — and it
            // emits "y", "n", "m" on the way there.
            //
            // So clearing when the *label* changes is circular: the trigger
            // arrives exactly as late as the delay it is meant to remove.
            // Confidence is the same signal, 70 frames earlier.
            //
            // Only armed after a genuinely confident read, and only after
            // consecutive low samples, so a momentary dip while holding a
            // letter does not wipe the evidence for it.
            if (smoothed.confidence >= peakConfidenceRef.current) {
              peakConfidenceRef.current = smoothed.confidence;
              lowConfidenceCountRef.current = 0;
            } else if (
              peakConfidenceRef.current >= SIGN_END_MIN_PEAK
              && smoothed.confidence < peakConfidenceRef.current * SIGN_END_DROP_RATIO
            ) {
              lowConfidenceCountRef.current += 1;
              if (lowConfidenceCountRef.current >= SIGN_END_FRAMES) {
                bufferRef.current?.reset();
                smootherRef.current?.reset();
                peakConfidenceRef.current = 0;
                lowConfidenceCountRef.current = 0;
                lastResultRef.current = null;
                stableLabelRef.current = null;
                stableCountRef.current = 0;
              }
            } else {
              lowConfidenceCountRef.current = 0;
            }

            const motionState = motionDetectorRef.current?.getState() ?? "idle";
            const gesturePhase = motionDetectorRef.current?.getPhase() ?? "none";
            const priorityApplied = priorityManagerRef.current?.applyPriority(
              smoothed, motionState, gesturePhase, frameCount
            ) ?? smoothed;
            const prioritized = priorityManagerRef.current?.applyBoost(
              priorityApplied, motionState, gesturePhase
            ) ?? priorityApplied;

            const result: RealPredictionResult = {
              label: prioritized.label,
              confidence: prioritized.confidence,
              topK: prioritized.topK,
              category: getRecognitionCategory(prioritized),
              recognitionSource: "temporal",
            };

            // Skip state update if result hasn't changed to avoid re-renders
            const resultKey = `${result.label}:${result.confidence.toFixed(3)}`;
            if (resultKey !== lastResultRef.current || performance.now() - lastUiUpdateRef.current > UI_UPDATE_INTERVAL_MS) {
              lastResultRef.current = resultKey;
              setState({ stage: "predicting", result });
            }

            // Motion-aware stabilization: freeze when stable + no motion
            if (motionDetectorRef.current && motionDetectorRef.current.getState() === "idle" && smoothed.confidence >= 0.6) {
              freezeCounterRef.current++;
              if (freezeCounterRef.current >= FREEZE_HYSTERESIS_FRAMES) {
                setFrozenPrediction(result);
              }
            } else {
              freezeCounterRef.current = 0;
              setFrozenPrediction(null);
            }

            // Early prediction detection: high confidence with few frames
            if (usedEarly && smoothed.confidence >= EARLY_CONFIDENCE_THRESHOLD) {
              if (smoothed.label === stableLabelRef.current) {
                stableCountRef.current++;
                if (stableCountRef.current >= 3) {
                  if (bufferRef.current) {
                    bufferRef.current.reset();
                  }
                  stableCountRef.current = 0;
                }
              } else {
                stableLabelRef.current = smoothed.label;
                stableCountRef.current = 0;
              }
            }

            onPredictionRef.current?.(temporalResult, elapsed);
          } catch {
            if (!mounted) return;
          } finally {
            // Must release on every path. The catch above returns early when
            // unmounted, so releasing after the try/catch instead of in a
            // finally would leave the flag stuck and stop inference for good.
            inferenceInFlightRef.current = false;
          }
        }, fastMode ? earlyInterval : interval);
      } else {
        setState({
          stage: "error",
          message: getCachedResult().error ?? "Failed to load recognition model"
        });
      }
    };

    init();

    return () => {
      mounted = false;
      if (inferenceTimerRef.current !== null) {
        clearInterval(inferenceTimerRef.current);
        inferenceTimerRef.current = null;
      }
    };
  }, [fastMode]);

  const appendFrame = useCallback(
    (left: HandData | null, right: HandData | null) => {
      const now = performance.now();
      if (bufferRef.current) {
        bufferRef.current.append(left, right);
        
        if (now - lastUiUpdateRef.current > UI_UPDATE_INTERVAL_MS) {
          setBufferLength(bufferRef.current.length);
        }
      }
      if (motionDetectorRef.current) {
        const previousState = motionDetectorRef.current.getState();
        const newState = motionDetectorRef.current.update(left, right);

        // Hand the gesture's boundaries to the buffer so its span can be
        // stretched to the temporal scale the model was trained on. Motion is
        // measured here, on raw landmarks, because the buffer's wrist-centred
        // features cannot express a hand moving across the body.
        if (previousState === "idle" && newState === "gesturing") {
          // Movement after stillness means the previous sign is finished and a
          // new one is starting, so its evidence is now noise. Without this the
          // next letter has to out-vote a 120-frame window still describing the
          // last one: measured at 2433ms from A to B against the served model,
          // versus 167ms once the window is cleared.
          //
          // clearSequence() already did this, but only on commit — a keypress.
          // Signing continuously never triggered it, which is why recognition
          // stalled between letters even though the fix was in place.
          bufferRef.current?.reset();
          smootherRef.current?.reset();
          lastResultRef.current = null;
          peakConfidenceRef.current = 0;
          lowConfidenceCountRef.current = 0;
          // reset() dropped the frame appended above; it belongs to the new sign.
          bufferRef.current?.append(left, right);
          bufferRef.current?.markGestureStart();
        } else if (previousState === "gesturing" && newState === "idle") {
          bufferRef.current?.markGestureEnd(IDLE_FRAMES);
        } else if (motionDetectorRef.current.consumeReshapeStart()) {
          // Fingerspelling never reaches MOTION_THRESHOLD, so the branch above
          // never fires for letters and the window kept the previous one.
          // Measured from the deployed app: reshaping between letters peaks at
          // ~0.003 against a 0.015 threshold, with a ~0.0005 noise floor while
          // a letter is held.
          //
          // No markGestureStart() here. A letter is not a gesture span — spans
          // are resampled to fill the trained window, which is right for a
          // phrase captured as real video and wrong for a letter, whose
          // training windows were a static image replicated across every slot.
          bufferRef.current?.reset();
          smootherRef.current?.reset();
          lastResultRef.current = null;
          freezeCounterRef.current = 0;
          setFrozenPrediction(null);
          stableLabelRef.current = null;
          stableCountRef.current = 0;
          // reset() dropped the frame appended above; it belongs to the new letter.
          bufferRef.current?.append(left, right);
        }

        if (newState === "gesturing") {
          freezeCounterRef.current = 0;
          setFrozenPrediction(null);
          stableLabelRef.current = null;
          stableCountRef.current = 0;
        }
        if (now - lastUiUpdateRef.current > UI_UPDATE_INTERVAL_MS) {
          setMotionState(newState);
          setMotionPeak(motionDetectorRef.current.getRecentPeakMotion());
        }
      }
    },
    []
  );

  /**
   * Drops the evidence for the sign just committed, without disturbing the
   * session: mode, motion state and the loaded model all survive.
   *
   * Committing a letter used to leave both the 120-frame buffer and the
   * 5-entry smoother history full of it, so the next letter had to out-vote a
   * window that still described the previous one. Measured against the served
   * model by replaying recorded landmarks at 30fps on the real 100ms cadence,
   * that cost 2900ms to get from A to B; clearing both brings it to 200ms.
   *
   * The buffer needs MINIMUM_FRAMES (5) before it can sample again, which at
   * 30fps is one extra 100ms tick — the 200ms floor, not a new stall.
   */
  const clearSequence = useCallback(() => {
    bufferRef.current?.reset();
    smootherRef.current?.reset();
    // The detector has to go back to idle too.
    //
    // Committing usually happens with the hand still up and moving, so the
    // detector is mid-"gesturing". Leaving it there means the next sign never
    // produces an idle -> gesturing edge, and that edge is what clears the
    // window and calls markGestureStart. Without it the next sign accumulates
    // into an unmarked window: harmless for a static letter, wrong for the
    // number signs, which are video-trained and need a resampled span.
    motionDetectorRef.current?.reset();
    setMotionState("idle");
    setFrozenPrediction(null);
    freezeCounterRef.current = 0;
    stableLabelRef.current = null;
    stableCountRef.current = 0;
    lastResultRef.current = null;
    // The buffer is empty, so the peak it was measured against is stale — a
    // leftover peak would arm the sign-end trigger against the next sign.
    peakConfidenceRef.current = 0;
    lowConfidenceCountRef.current = 0;
    setState({ stage: "predicting", result: null });
  }, []);

  const resetRecognition = useCallback(() => {
    bufferRef.current?.reset();
    smootherRef.current?.reset();
    motionDetectorRef.current?.reset();
    modeManagerRef.current?.reset();
    setFrozenPrediction(null);
    setMotionState("idle");
    setModeState("auto");
    setState({ stage: "predicting", result: null });
    stableLabelRef.current = null;
    stableCountRef.current = 0;
    noMotionCounterRef.current = 0;
    peakConfidenceRef.current = 0;
    lowConfidenceCountRef.current = 0;
  }, []);

  return {
    state,
    appendFrame,
    resetRecognition,
    clearSequence,
    bufferLength,
    // Sourced from the buffer so diagnostics cannot drift from it again —
    // this reported 30 while the buffer actually held 45.
    bufferCap: SEQUENCE_LENGTH,
    minimumFrames: MINIMUM_FRAMES,
    inferenceTimeMs,
    frozenPrediction,
    motionState,
    motionPeak,
    mode,
    setMode,
  };
};
