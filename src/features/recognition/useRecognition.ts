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
  mode: RecognitionMode;
  setMode: (mode: RecognitionMode) => void;
};

export type OnPredictionCallback = (
  result: InferenceResult,
  inferenceTimeMs: number
) => void;

export const useRecognition = (
  onPrediction?: OnPredictionCallback,
  fastMode?: boolean
): RecognitionControls => {
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

          const currentMode = modeManagerRef.current?.getMode() ?? "auto";

          // Use adaptive sampling for early prediction
          const { sample, usedEarly, frameCount } = bufferRef.current.adaptiveSample(EARLY_CONFIDENCE_THRESHOLD);
          if (!sample) return;

          

          const inferStart = performance.now();

          try {
            const temporalResult = await infer(sample);
            if (!temporalResult || !mounted) return;
            const elapsed = performance.now() - inferStart;

            // Debounce inference time display to avoid extra re-renders
            if (performance.now() - lastUiUpdateRef.current > UI_UPDATE_INTERVAL_MS) {
              setInferenceTimeMs(elapsed);
              lastUiUpdateRef.current = performance.now();
            }

            

            const translated = translateResult(temporalResult);
            const smoothed = smootherRef.current?.smooth(translated) ?? translated;

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
          bufferRef.current?.markGestureStart();
        } else if (previousState === "gesturing" && newState === "idle") {
          bufferRef.current?.markGestureEnd(IDLE_FRAMES);
        }

        if (newState === "gesturing") {
          freezeCounterRef.current = 0;
          setFrozenPrediction(null);
          stableLabelRef.current = null;
          stableCountRef.current = 0;
        }
        if (now - lastUiUpdateRef.current > UI_UPDATE_INTERVAL_MS) {
          setMotionState(newState);
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
    setFrozenPrediction(null);
    freezeCounterRef.current = 0;
    stableLabelRef.current = null;
    stableCountRef.current = 0;
    lastResultRef.current = null;
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
    mode,
    setMode,
  };
};
