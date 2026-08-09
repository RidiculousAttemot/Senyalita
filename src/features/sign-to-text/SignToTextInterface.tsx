"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RealtimeMetrics, useRecognition, translateLabel, getModelLabels,
  allowedLabelsForMode, handsForMode, partitionLabels, assertPartition, numberDisplay,
  assignHandSlots, DEFAULT_MODE, type RecognitionMode,
} from "@/features/recognition";
import { CommunicationProfileManager } from "@/features/profiles";
import { Textarea } from "@/components/ui/textarea";
import { Video, Zap, AlertTriangle, Settings, Copy, X, Power, Info, Volume2 } from "lucide-react";
import { DebugOverlay } from "@/features/recognition/DebugOverlay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTranscriptCommitShortcut, isTranscriptCommitShortcut } from "./commitShortcut";
import { createFrameRateTracker } from "./cameraFrameRate";
import { HAND_CAPTURE_CONSTRAINTS, handLandmarkerOptionsFor, type DetectionSensitivity } from "./handCaptureProfile";
import {
  CAPTURE_INTERVAL_MS,
  HAND_CONNECTIONS,
  createHandLandmarker,
  getActiveDelegate,
} from "./handLandmarkerConfig";
import { CameraSettingsPanel, type CameraSettings } from "./CameraSettingsPanel";
import { isNumberSign } from "./inScopeLabels";
import { SuggestionPanel, useLetterSuggestions } from "@/features/suggestions";

/** Amber reads clearly against skin tones, dim rooms and bright walls alike. */
const SKELETON_STROKE = "rgba(245, 158, 11, 0.95)";
const SKELETON_JOINT = "rgba(255, 237, 213, 0.98)";

/** Normalised position of a tracked hand, for the HTML label layer. */
interface HandOverlay {
  handedness: "Left" | "Right";
  x: number;
  y: number;
}

// Shared with /evaluation via handLandmarkerConfig so the harness cannot drift
// from the path it is measuring.
/** Hand-label badges only need to keep up with the eye, not the camera. */
const OVERLAY_INTERVAL_MS = 100;

/**
 * Idle time left after each detect, as a fraction of what it cost.
 *
 * 1.0 means "rest as long as you just worked" — a 50% duty cycle. Measured on
 * /translate against a software-rendered GPU, 30s samples:
 *
 *   ratio  FPS  main-thread p95
 *   off     4     316ms   unusable — touch and scroll visibly stick
 *   0.5     2     291ms   no throughput gained, still janky
 *   1.0     2      19ms   responsive
 *
 * 0.5 was the obvious compromise and measured strictly worse than 1.0: the
 * same frame rate for fifteen times the input delay. Detection is coarse
 * enough that a half-gap still lets passes land back-to-back.
 */
const DETECT_IDLE_RATIO = 1;

type Status = "waiting" | "starting" | "active" | "no-hand" | "error";

const cameraStatusLabel: Record<Status, string> = {
  waiting: "Camera off",
  starting: "Starting",
  active: "Live",
  "no-hand": "No hand",
  error: "Camera error",
};

export function SignToTextInterface() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // The real landmarker type, derived from the factory rather than imported:
  // @mediapipe/tasks-vision is dynamically imported to keep it out of the
  // initial bundle, and `typeof` reaches its types without a value import.
  // Previously this was a minimal `{ close }`, which was enough while the draw
  // loop held its own reference — it now detects through the ref so the
  // detector can be swapped, and needs detectForVideo to be on the type.
  const handLandmarkerRef = useRef<Awaited<ReturnType<typeof createHandLandmarker>> | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRunIdRef = useRef(0);
  const [status, setStatus] = useState<Status>("waiting");
  const [errorMessage, setErrorMessage] = useState("");
  const [mediapipeFps, setMediapipeFps] = useState(0);
  /**
   * What the camera actually delivers, and what each stage costs.
   *
   * "2 FPS" has at least four distinct causes and the badge alone cannot tell
   * them apart: the camera itself delivering 2fps (phones drop frame rate hard
   * in low light to lengthen exposure), MediaPipe detection being slow, the
   * CPU delegate being silently selected, or inference crowding the main
   * thread. Two fixes were shipped against guesses before this existed.
   *
   * mediapipeFps counts rAF passes where video.currentTime changed, so it is
   * capped by camera delivery — a slow sensor and slow processing look
   * identical in it.
   */
  const [camDiag, setCamDiag] = useState<{
    width: number; height: number; frameRate: number; delegate: string | null;
  } | null>(null);
  const [detectMs, setDetectMs] = useState(0);
  // Rate landmarks actually enter the recognition buffer, which is what has to
  // match training — distinct from the MediaPipe detection rate above.
  const [captureFps, setCaptureFps] = useState(0);
  const [outputText, setOutputText] = useState("");
  const suggestions = useLetterSuggestions();
  const [showSettings, setShowSettings] = useState(false);
  const [handOverlays, setHandOverlays] = useState<HandOverlay[]>([]);
  const [settings, setSettings] = useState<CameraSettings>({
    mirrored: true,
    showSkeleton: true,
    showHandLabels: true,
    showDetails: false,
    sensitivity: "balanced",
    // Off by default: the second hand costs about a third of the frame rate
    // (342ms vs 631ms per detection on a weak GPU). Opt-in for signers whose
    // resting hand is in frame, where a wrong lock-on is worse than the cost.
    trackBothHands: false,
  });
  // Settings are read inside the rAF draw loop, which closes over its initial
  // values — a ref keeps that loop reading the live object without restarting
  // the camera on every toggle.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Sensitivity is compiled into the MediaPipe detector at creation, so the
  // running camera keeps whatever it started with until it is restarted.
  const activeSensitivityRef = useRef<DetectionSensitivity | null>(null);
  const [activeSensitivity, setActiveSensitivity] = useState<DetectionSensitivity | null>(null);
  // Same story for the mode: it sets numHands, which the detector bakes in.
  const activeModeRef = useRef<RecognitionMode | null>(null);
  const [activeMode, setActiveMode] = useState<RecognitionMode | null>(null);
  // numHands is what is actually compiled into the MediaPipe graph, and it now
  // depends on the "Track both hands" setting as well as the mode. Comparing
  // modes alone would miss a toggle that changes the count without changing the
  // mode, leaving the running detector on the old one.
  const activeHandsRef = useRef<1 | 2 | null>(null);
  const [activeHands, setActiveHands] = useState<1 | 2 | null>(null);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [commitShortcut, setCommitShortcut] = useState("Space");
  const [capturingShortcut, setCapturingShortcut] = useState(false);
  const [telemetrySessionToken, setTelemetrySessionToken] = useState<string | null>(null);

  const onPrediction = useCallback(() => {}, []);
  const [selectedMode, setSelectedMode] = useState<RecognitionMode>(DEFAULT_MODE);
  // Read inside the camera-start closure, which captures its initial value.
  const selectedModeRef = useRef(selectedMode);
  selectedModeRef.current = selectedMode;
  const [modelLabels, setModelLabels] = useState<readonly string[]>([]);

  /**
   * The mode decides which classes may be predicted, as a restriction on the
   * argmax rather than a filter afterwards — discarding out-of-scope
   * predictions leaves the panel blank whenever the model prefers a class the
   * mode excludes.
   *
   * /evaluation deliberately passes nothing and keeps all 131 for the thesis
   * numbers; the narrowing lives here, in the consumer.
   */
  const allowedLabels = useMemo(
    // Undefined until the model reports its labels. No hardcoded fallback:
    // inference returns null while the model is loading, so there is no window
    // in which an unrestricted prediction could reach the UI.
    () => (modelLabels.length ? allowedLabelsForMode(selectedMode, modelLabels) : undefined),
    [selectedMode, modelLabels],
  );
  const recognition = useRecognition(onPrediction, undefined, allowedLabels);
  const { appendFrame, resetRecognition, clearSequence } = recognition;

  // No post-filter. The mode restricts the argmax, so whatever arrives is
  // already allowed — and a filter here would be wrong as well as redundant,
  // since Phrase Signs mode legitimately predicts phrases.
  const currentPrediction = recognition.frozenPrediction ?? (recognition.state.stage === "predicting" ? recognition.state.result : null);

  useEffect(() => {
    setTelemetrySessionToken(new CommunicationProfileManager().getToken());
  }, []);

  // Conversation mode's allowed set is "everything that is not a letter or a
  // number", which cannot be written down without the model's own vocabulary.
  //
  // Polled rather than hung off a stage transition: the labels land when the
  // model resolves, which does not line up with any single render, and keying
  // this to one transition left the phrase list permanently empty.
  useEffect(() => {
    if (modelLabels.length) return;
    const tryLoad = () => {
      const labels = getModelLabels();
      if (labels.length) { setModelLabels(labels); return true; }
      return false;
    };
    if (tryLoad()) return;
    const timer = setInterval(() => { if (tryLoad()) clearInterval(timer); }, 400);
    return () => clearInterval(timer);
  }, [modelLabels.length]);

  /**
   * Every list the panel shows, derived from the model rather than written by
   * hand, and checked to cover the label set exactly. A hardcoded list drifts
   * silently — that is how the numbers row came to advertise 0-9 against a
   * model whose number classes are ONE..TEN.
   */
  const partition = useMemo(() => {
    const p = partitionLabels(modelLabels);
    if (modelLabels.length) assertPartition(modelLabels, p);
    return p;
  }, [modelLabels]);

  const speak = useCallback((text: string) => {
    if (!speakEnabled) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [speakEnabled]);

  // Committing a sign feeds the spelling buffer as well as the transcript, then
  // clears the evidence for it.
  //
  // Without that clear the next letter competes against a 120-frame buffer and a
  // 5-entry smoother history still describing the letter just committed, so the
  // model keeps re-predicting it until those frames age out. Measured at 2900ms
  // from A to B; clearing brings it to 200ms.
  const commitPrediction = useCallback(() => {
    if (!currentPrediction) return;
    const display = translateLabel(currentPrediction.label);
    setOutputText((previousText) => previousText + display);
    // Numbers reach the transcript but not the spelling buffer. The suggestion
    // engine matches a run of characters against a word dictionary, so a digit
    // mid-word can never match and would suppress suggestions until cleared.
    // appendLabel would also mangle "10" — it slices the first character of
    // anything outside MULTI_CHARACTER_LABELS ("NG"), so TEN became "1".
    if (!isNumberSign(display)) {
      suggestions.appendLabel(currentPrediction.label);
    }
    speak(display);
    clearSequence();
  }, [clearSequence, currentPrediction, speak, suggestions]);

  /** Replaces the spelled run in the transcript with the chosen word. */
  const acceptSuggestion = useCallback((phrase: string) => {
    const spelled = suggestions.letters;
    suggestions.accept(phrase);
    setOutputText((previousText) => {
      const trimmed = previousText.toUpperCase().endsWith(spelled)
        ? previousText.slice(0, previousText.length - spelled.length)
        : previousText;
      return `${trimmed}${phrase} `;
    });
    speak(phrase);
  }, [speak, suggestions]);

  useEffect(() => {
    const handleCommitShortcut = (event: KeyboardEvent) => {
      if (capturingShortcut) {
        event.preventDefault();
        if (event.code === "Escape") setCapturingShortcut(false);
        else if (!event.altKey && !event.ctrlKey && !event.metaKey) { setCommitShortcut(event.code); setCapturingShortcut(false); }
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      // Enter accepts the top suggestion, matching how phone keyboards behave.
      if (event.key === "Enter" && suggestions.topSuggestion) {
        event.preventDefault();
        acceptSuggestion(suggestions.topSuggestion.phrase);
        return;
      }
      if (isTranscriptCommitShortcut(event, commitShortcut)) { event.preventDefault(); commitPrediction(); }
    };
    window.addEventListener("keydown", handleCommitShortcut);
    return () => window.removeEventListener("keydown", handleCommitShortcut);
  }, [acceptSuggestion, capturingShortcut, commitPrediction, commitShortcut, suggestions.topSuggestion]);

  const clearCameraResources = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    handLandmarkerRef.current?.close();
    handLandmarkerRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = landmarkCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startCamera = useCallback(async () => {
    if (cameraStreamRef.current) return;
    const runId = ++cameraRunIdRef.current;
    setStatus("starting");
    setErrorMessage("");
    setMediapipeFps(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(HAND_CAPTURE_CONSTRAINTS);
      if (cameraRunIdRef.current !== runId || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const sensitivity = settingsRef.current.sensitivity;
      // numHands is compiled into the detector, so the running camera keeps
      // whatever it started with — same as sensitivity. Alphabet Practice
      // tracks one hand for speed; every other mode tracks two, because
      // phrases need the second and because one-hand tracking flips between
      // hands when both are in frame, which reads as recognition failing.
      const mode = selectedModeRef.current;
      const hands = handsForMode(mode, settingsRef.current.trackBothHands);
      const handLandmarker = await createHandLandmarker({
        ...handLandmarkerOptionsFor(sensitivity),
        numHands: hands,
      });
      activeSensitivityRef.current = sensitivity;
      activeModeRef.current = mode;
      setActiveMode(mode);
      activeHandsRef.current = hands;
      setActiveHands(hands);
      setActiveSensitivity(sensitivity);
      if (cameraRunIdRef.current !== runId) {
        handLandmarker.close();
        return;
      }
      handLandmarkerRef.current = handLandmarker;
      // What the camera actually agreed to, as opposed to what was requested.
      const track = stream.getVideoTracks()[0];
      const s = track?.getSettings?.() ?? {};
      setCamDiag({
        width: s.width ?? 0,
        height: s.height ?? 0,
        frameRate: Math.round(s.frameRate ?? 0),
        delegate: getActiveDelegate(),
      });
      let lastVideoTime = -1;
      // Landmarks are appended on a fixed ~30Hz cadence to match the rate the
      // training clips were extracted at (scripts/extract-holistic-videos.mjs
      // uses ffmpeg fps=30). A 60fps camera would otherwise pack twice the
      // frames into the model's 120-frame window and halve its real duration.
      let lastAppendTime = -Infinity;
      // Duty-cycle budget for the synchronous detect call — see drawLandmarks.
      let lastDetectEnd = -Infinity;
      let lastDetectCost = 0;
      let lastOverlayTime = -Infinity;
      const fpsTracker = createFrameRateTracker(performance.now());
      const captureTracker = createFrameRateTracker(performance.now());
      const drawLandmarks = () => {
        if (cameraRunIdRef.current !== runId || !videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        const video = videoRef.current;
        // Leave the main thread as much idle time as the last detection
        // consumed, so the browser can paint, scroll and handle touch between
        // passes.
        //
        // detectForVideo is synchronous and blocks. On a device where it costs
        // ~600ms, running it on every available frame pins the main thread at
        // 100% — the page stops responding to touch and the whole UI judders,
        // which is the reported lag. No amount of shaving closes 600ms down to
        // the 33ms that 30fps needs, so the choice is not "fast or slow" but
        // "slow and responsive, or slow and frozen".
        //
        // Self-scaling: a laptop at ~15ms yields a 15ms gap, well inside the
        // 33ms frame budget, so nothing changes there. Only devices that are
        // actually struggling back off.
        const sinceDetect = performance.now() - lastDetectEnd;
        if (sinceDetect < lastDetectCost * DETECT_IDLE_RATIO) {
          animationFrameRef.current = window.requestAnimationFrame(drawLandmarks);
          return;
        }
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const frameTimestamp = performance.now();
          // Read from the ref, not the closure this loop was started with, so
          // the detector can be replaced underneath it — which is how a mode
          // change takes effect without stopping the camera.
          const detector = handLandmarkerRef.current;
          if (!detector) {
            animationFrameRef.current = window.requestAnimationFrame(drawLandmarks);
            return;
          }
          const results = detector.detectForVideo(video, frameTimestamp);
          lastDetectEnd = performance.now();
          lastDetectCost = lastDetectEnd - frameTimestamp;
          // Cost of detection alone, separated from camera delivery rate.
          // Throttled to the overlay cadence so measuring cannot itself cost
          // a re-render per frame.
          const detectElapsed = performance.now() - frameTimestamp;
          if (frameTimestamp - lastOverlayTime >= OVERLAY_INTERVAL_MS) {
            setDetectMs(Math.round(detectElapsed));
          }
          const measuredFps = fpsTracker.record(frameTimestamp);
          if (measuredFps > 0) setMediapipeFps(measuredFps);
          // Slotted the way training did, including its collision fallback.
          //
          // This was two independent findIndex calls, one per handedness label.
          // MediaPipe guesses handedness per frame and regularly labels both
          // hands "Right", which made leftIndex -1 and silently discarded the
          // second hand — 63 of the model's 126 features left at zero. Phrases
          // are 93% two-handed in the v4 training split, so that is exactly the
          // case that stopped working.
          //
          // No mirroring or single-hand selection on top of this. Measured over
          // the real v4 test captures, the model already handles either hand
          // and a second hand in frame: left-only 93.1% (n=1675), right-only
          // 94.6% (n=3788), both 92.9% (n=1125). Forcing a lone hand into the
          // right slot mirrored made every group worse -- letters -2.9, numbers
          // -14.7, phrases -5.1 points -- because it rewrites left-handed
          // captures the model was trained on and already reads correctly.
          const [leftLandmarks, rightLandmarks] = assignHandSlots(
            results.landmarks.map((landmarks, index) => ({
              landmarks,
              handedness: results.handedness[index]?.[0]?.categoryName,
            })),
          );
          // Rendering below still runs on every camera frame; only the
          // recognition buffer is throttled, keeping the two decoupled.
          if (frameTimestamp - lastAppendTime >= CAPTURE_INTERVAL_MS) {
            lastAppendTime = frameTimestamp;
            appendFrame(
              leftLandmarks ? { landmarks: leftLandmarks } : null,
              rightLandmarks ? { landmarks: rightLandmarks } : null,
            );
            const captureFps = captureTracker.record(frameTimestamp);
            if (captureFps > 0) setCaptureFps(captureFps);
          }
          setStatus(results.landmarks.length > 0 ? "active" : "no-hand");
          const canvas = landmarkCanvasRef.current;
          const context = canvas?.getContext("2d");
          if (canvas && context) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (settingsRef.current.showSkeleton) {
              results.landmarks.forEach((hand) => {
                context.strokeStyle = SKELETON_STROKE;
                context.lineWidth = 3;
                context.lineCap = "round";
                context.lineJoin = "round";
                HAND_CONNECTIONS.forEach(([start, end]) => {
                  context.beginPath();
                  context.moveTo(hand[start].x * canvas.width, hand[start].y * canvas.height);
                  context.lineTo(hand[end].x * canvas.width, hand[end].y * canvas.height);
                  context.stroke();
                });
                hand.forEach((point) => {
                  context.beginPath();
                  context.arc(point.x * canvas.width, point.y * canvas.height, 3.5, 0, 2 * Math.PI);
                  context.fillStyle = SKELETON_JOINT;
                  context.fill();
                  context.strokeStyle = SKELETON_STROKE;
                  context.lineWidth = 1.5;
                  context.stroke();
                });
              });
            }
          }

          // Handedness badges live in HTML rather than on the canvas so they
          // stay upright when the feed is mirrored, and so they can be styled
          // with the rest of the UI. Throttled — 60Hz setState would thrash.
          if (frameTimestamp - lastOverlayTime >= OVERLAY_INTERVAL_MS) {
            lastOverlayTime = frameTimestamp;
            const next: HandOverlay[] = [];
            if (settingsRef.current.showSkeleton && settingsRef.current.showHandLabels) {
              results.landmarks.forEach((hand, index) => {
                const name = results.handedness[index]?.[0]?.categoryName;
                if (name !== "Left" && name !== "Right") return;
                // Landmark 0 is the wrist — anchors the badge below the hand.
                const wrist = hand[0];
                next.push({ handedness: name, x: wrist.x, y: wrist.y });
              });
            }
            setHandOverlays((prev) => {
              if (prev.length === 0 && next.length === 0) return prev;
              return next;
            });
          }
        }
        animationFrameRef.current = requestAnimationFrame(drawLandmarks);
      };
      drawLandmarks();
      setStatus("active");
      window.dispatchEvent(new CustomEvent("senyalita:camera-state", { detail: true }));
    } catch (error) {
      if (cameraRunIdRef.current !== runId) return;
      clearCameraResources();
      let message = "Camera error";
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") message = "Camera permission denied. Allow camera access and try again.";
        else if (error.name === "NotFoundError") message = "No camera found on this device.";
        else if (error.name === "NotReadableError") message = "Camera is in use by another application.";
      } else if (error instanceof TypeError) {
        message = "Camera not supported in this browser.";
      }
      setErrorMessage(message);
      setStatus("error");
      window.dispatchEvent(new CustomEvent("senyalita:camera-state", { detail: false }));
    }
  }, [appendFrame, clearCameraResources]);

  const stopCamera = useCallback(() => {
    cameraRunIdRef.current++;
    clearCameraResources();
    setStatus("waiting");
    setErrorMessage("");
    setMediapipeFps(0);
    setCaptureFps(0);
    setHandOverlays([]);
    activeSensitivityRef.current = null;
    setActiveSensitivity(null);
    resetRecognition();
    window.dispatchEvent(new CustomEvent("senyalita:camera-state", { detail: false }));
  }, [clearCameraResources, resetRecognition]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  /**
   * Rebuild the detector when the selected mode needs a different hand count.
   *
   * numHands is compiled into the MediaPipe graph when it is created, so a
   * mode change on a running camera kept whatever the detector started with.
   * Choosing Phrase Signs and then signing a two-handed phrase tracked one
   * hand, which does not read as "the mode has not applied yet" — it reads as
   * the model failing on two-handed signs. Alphabet is one hand and phrase
   * signs are two, so every mode change crosses this boundary.
   *
   * Only the graph is rebuilt. The MediaStream is unaffected by numHands, and
   * tearing the camera down to change it would drop frames, blank the stage and
   * re-run permission checks for a setting the camera does not own.
   *
   * The buffer is cleared with it: the window holds up to 120 frames captured
   * under the old hand count, and the right half of every one of those is
   * zero-filled. Feeding the model a window that changes hand count partway
   * through is a distribution it was never trained on.
   */
  useEffect(() => {
    // Camera off — startCamera reads selectedModeRef and builds it correctly.
    if (!handLandmarkerRef.current) return;
    const requiredHands = handsForMode(selectedMode, settings.trackBothHands);
    if (activeModeRef.current === selectedMode && activeHandsRef.current === requiredHands) return;

    let cancelled = false;
    const runId = cameraRunIdRef.current;

    (async () => {
      let next;
      try {
        next = await createHandLandmarker({
          ...handLandmarkerOptionsFor(activeSensitivityRef.current ?? settingsRef.current.sensitivity),
          numHands: requiredHands,
        });
      } catch {
        // Keep the working detector rather than leaving the camera with none.
        // The panel's "restart to apply" notice stays up, which is now the
        // accurate thing to say.
        return;
      }
      // The camera stopped or restarted while the graph was being built.
      if (cancelled || cameraRunIdRef.current !== runId || !handLandmarkerRef.current) {
        next.close();
        return;
      }
      const previous = handLandmarkerRef.current;
      handLandmarkerRef.current = next;
      // Safe to close only after the swap: the draw loop reads the ref at the
      // top of each detect, and nothing yields between these two statements,
      // so no frame can be mid-flight on the old graph.
      previous.close();
      activeModeRef.current = selectedMode;
      setActiveMode(selectedMode);
      activeHandsRef.current = requiredHands;
      setActiveHands(requiredHands);
      clearSequence();
    })();

    return () => { cancelled = true; };
    // trackBothHands belongs here: it changes numHands, which is compiled into
    // the graph, so toggling it has to rebuild the detector exactly as a mode
    // change does.
  }, [selectedMode, settings.trackBothHands, clearSequence]);

  useEffect(() => {
    const toggleCameraFromHeader = () => {
      if (videoRef.current?.srcObject) {
        stopCamera();
      } else {
        void startCamera();
      }
    };

    window.addEventListener("senyalita:camera-toggle", toggleCameraFromHeader);
    return () => window.removeEventListener("senyalita:camera-toggle", toggleCameraFromHeader);
  }, [startCamera, stopCamera]);

  const handleCopy = () => navigator.clipboard.writeText(outputText);
  const handleClear = () => setOutputText("");
  const handleBackspace = () => setOutputText((previousText) => previousText.slice(0, -1));
  const handleSpace = () => setOutputText((previousText) => previousText + " ");
  const handleSpeak = () => {
    if (!outputText || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(outputText));
  };

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <RealtimeMetrics
        sessionId={null}
        userId={null}
        sessionToken={telemetrySessionToken}
        currentGesture={currentPrediction?.label ?? null}
        confidence={currentPrediction?.confidence ?? 0}
        isLowConfidence={(currentPrediction?.confidence ?? 1) < 0.5}
        isAiReply={false}
        inferenceTimeMs={recognition.inferenceTimeMs}
      />

      <motion.div
        className="flex min-w-0 flex-col gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Camera stage */}
        <section className="overflow-hidden rounded-[28px] border border-senyalita-border bg-white/80 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="relative h-[400px] overflow-hidden bg-senyalita-dark md:h-[560px]">
            {/* Mirroring is an inline transform rather than a `-scale-x-*`
                utility: under Tailwind v4 those drive the CSS `scale` property,
                and pairing them with `transition-transform` (which in v4 also
                transitions `scale`) leaves the flip stuck on when the class is
                removed. An explicit transform flips deterministically, and a
                mirror flip should snap rather than animate anyway. */}
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              style={{ transform: settings.mirrored ? "scaleX(-1)" : "none" }}
              playsInline
              autoPlay
              muted
            />
            <canvas
              ref={landmarkCanvasRef}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ transform: settings.mirrored ? "scaleX(-1)" : "none" }}
            />

            {/* Handedness badges — outside the mirrored layers so text stays upright */}
            {handOverlays.map((hand, index) => (
              <span
                key={`${hand.handedness}-${index}`}
                className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg"
                style={{
                  left: `${(settings.mirrored ? 1 - hand.x : hand.x) * 100}%`,
                  top: `calc(${hand.y * 100}% + 12px)`,
                }}
              >
                {hand.handedness}
              </span>
            ))}

            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              <span
                aria-live="polite"
                className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "active" ? "animate-pulse bg-senyalita-accent"
                      : status === "error" ? "bg-rose-400"
                      : status === "no-hand" ? "bg-amber-400"
                      : "bg-slate-400",
                  )}
                  aria-hidden="true"
                />
                {status === "active" && mediapipeFps > 0
                  ? <span className="tabular-nums">{mediapipeFps} FPS</span>
                  : cameraStatusLabel[status]}
                {/*
                  Always visible, not behind the debug toggle. "2 FPS" has four
                  distinct causes that this badge alone cannot separate, and a
                  phone is exactly where devtools are least reachable — these
                  three numbers name the cause from a screenshot:

                    cam 30  -> camera is fine, the cost is downstream
                    cam  2  -> the sensor is delivering 2fps, usually low light
                    det NNN -> milliseconds per MediaPipe detection
                    CPU     -> GPU delegate unavailable, ~10x slower
                */}
                {status === "active" && camDiag && (
                  <span className="tabular-nums font-normal text-white/70">
                    · cam {camDiag.frameRate || "?"} {camDiag.width}×{camDiag.height}
                    {" · det "}{detectMs}ms
                    {" · inf "}{Math.round(recognition.inferenceTimeMs)}ms
                    {camDiag.delegate ? ` · ${camDiag.delegate}` : ""}
                  </span>
                )}
              </span>
              {status === "active" && (
                <span className="hidden rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md sm:inline-flex">
                  {recognition.motionState === "gesturing" ? "Moving" : "Steady"}
                </span>
              )}
            </div>

            <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowSettings((open) => !open)}
                      aria-expanded={showSettings}
                      aria-label="Camera settings"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset backdrop-blur-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                        showSettings
                          ? "bg-white text-senyalita-dark ring-white"
                          : "bg-black/45 text-white ring-white/15 hover:bg-black/60",
                      )}
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Camera settings</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {(status === "active" || status === "no-hand") && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-senyalita-dark shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Power className="h-3.5 w-3.5" />Stop
                </button>
              )}
            </div>

            <AnimatePresence>
              {showSettings && (
                <CameraSettingsPanel
                  settings={settings}
                  onChange={(key, value) => setSettings((prev) => ({ ...prev, [key]: value }))}
                  mode={selectedMode}
                  onModeChange={(m) => { setSelectedMode(m); recognition.setMode(m); }}
                  // Transient now, not an instruction. The detector is rebuilt
                  // for the new hand count on its own, so this is only true
                  // for the moment that takes — unlike sensitivity below,
                  // which still genuinely needs the camera restarted.
                  modePending={
                    // Compares the compiled hand count, not the mode, so the
                    // notice also covers toggling "Track both hands" within a
                    // mode — which rebuilds the graph for the same reason.
                    activeHands !== null
                    && activeHands !== handsForMode(selectedMode, settings.trackBothHands)
                  }
                  sensitivityPending={activeSensitivity !== null && activeSensitivity !== settings.sensitivity}
                  cameraActive={status === "active" || status === "no-hand"}
                  onClose={() => setShowSettings(false)}
                />
              )}
            </AnimatePresence>

            {/* Detected sign — mirrors the reference readout */}
            <AnimatePresence>
              {currentPrediction && (status === "active" || status === "no-hand") && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  aria-live="polite"
                  className="absolute bottom-4 right-4 min-w-[132px] overflow-hidden rounded-2xl bg-black/55 px-4 pb-3 pt-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-md"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">Detected</p>
                  <p className="mt-0.5 font-display text-3xl font-bold leading-none text-white">
                    {translateLabel(currentPrediction.label)}
                  </p>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <motion.div
                      className="h-full rounded-full bg-amber-400"
                      initial={false}
                      animate={{ width: `${Math.round(currentPrediction.confidence * 100)}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold tabular-nums text-white/60">
                    {Math.round(currentPrediction.confidence * 100)}% confident
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {errorMessage && (
              <div role="alert" className="absolute bottom-4 left-4 right-4 flex items-start gap-2.5 rounded-2xl bg-rose-950/85 px-4 py-3 ring-1 ring-inset ring-rose-400/30 backdrop-blur-md">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <p className="text-xs leading-snug text-rose-100">{errorMessage}</p>
              </div>
            )}

            {/* Startup overlay — the detector download and WASM init take a
                visible moment, and a frozen black frame reads as a failure. */}
            <AnimatePresence>
              {status === "starting" && (
                <motion.div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-senyalita-dark/70 px-6 text-center backdrop-blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  aria-live="polite"
                >
                  <span className="mb-5 flex h-12 w-12 items-center justify-center">
                    <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-amber-400" />
                  </span>
                  <p className="text-base font-semibold text-white">Loading translation engine…</p>
                  <p className="mt-1.5 text-[13px] text-slate-300">
                    Setting up hand tracking. This takes a moment.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {status === "waiting" && (
                <motion.div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-senyalita-dark px-6 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-senyalita-primary/15 text-senyalita-secondary ring-1 ring-inset ring-senyalita-primary/30">
                    <Video className="h-7 w-7" />
                  </span>
                  <p className="max-w-md text-[15px] font-medium leading-relaxed text-slate-200">
                    Start the camera, then sign{" "}
                    <span className="font-semibold text-senyalita-secondary">letters (A–Z) or numbers (0–9)</span>
                    {" "}— hold each sign steady.
                  </p>
                  <p className="mb-6 mt-2 text-xs text-slate-400">Hand tracking runs locally on your device.</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-senyalita-primary px-6 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/30 transition-all hover:shadow-xl hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <Zap className="h-4 w-4" />Start camera
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recognition bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-senyalita-border/70 bg-white/60 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-senyalita-muted">Recognition model</p>
              {/* data-prediction carries the bare label so a test can read what
                  the model said without parsing the human-facing string, which
                  also holds a confidence percentage and localised copy. */}
              <p
                className="mt-1 truncate text-sm font-semibold text-senyalita-dark"
                data-testid="recognition-readout"
                data-prediction={currentPrediction ? translateLabel(currentPrediction.label) : ""}
              >
                {recognition.state.stage === "loading-model" ? "Loading on-device model"
                  : recognition.state.stage === "error" ? recognition.state.message
                  : currentPrediction ? `${translateLabel(currentPrediction.label)} · ${Math.round(currentPrediction.confidence * 100)}%`
                  : "Waiting for a stable sign"}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={commitPrediction}
              disabled={!currentPrediction}
              whileTap={{ scale: 0.97 }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-senyalita-primary px-6 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
            >
              <Zap className="h-4 w-4" />Add detected sign
            </motion.button>
          </div>
        </section>

        {settings.showDetails && (
          <div className="overflow-hidden rounded-[22px] border border-senyalita-border bg-white/70 backdrop-blur-xl">
            <DebugOverlay recognitionState={recognition.state} mediapipeFps={mediapipeFps} captureFps={captureFps} inferenceTimeMs={recognition.inferenceTimeMs} bufferLength={recognition.bufferLength} bufferCap={recognition.bufferCap} minimumFrames={recognition.minimumFrames} motionState={recognition.motionState} motionPeak={recognition.motionPeak} />
            <div className="border-t border-senyalita-border/70 bg-senyalita-warm/60 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-senyalita-muted">Camera debug</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-senyalita-muted">
                <span>Camera: <strong className="font-semibold text-senyalita-dark">{cameraStreamRef.current ? "Ready" : "Off"}</strong></span>
                <span>Permission: <strong className="font-semibold text-senyalita-dark">{navigator.permissions ? "API available" : "N/A"}</strong></span>
                <span>MediaPipe: <strong className="font-semibold text-senyalita-dark">{handLandmarkerRef.current ? "Running" : "Stopped"}</strong></span>
                <span>FPS: <strong className="font-semibold tabular-nums text-senyalita-dark">{mediapipeFps}</strong></span>
                <span>Hands: <strong className="font-semibold text-senyalita-dark">{status === "active" ? "Detected" : status === "no-hand" ? "None" : "—"}</strong></span>
                <span>Recognition: <strong className="font-semibold text-senyalita-dark">{recognition.state.stage}</strong></span>
                <span>Prediction: <strong className="font-semibold text-senyalita-dark">{currentPrediction ? translateLabel(currentPrediction.label) : "—"}</strong></span>
                <span>Confidence: <strong className="font-semibold tabular-nums text-senyalita-dark">{currentPrediction ? `${Math.round(currentPrediction.confidence * 100)}%` : "—"}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Transcript */}
        <section aria-labelledby="transcript-heading" className="overflow-hidden rounded-[28px] border border-senyalita-border bg-white/80 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            <h2 id="transcript-heading" className="font-display text-lg font-bold tracking-tight text-senyalita-dark">Transcript</h2>
            <div className="hidden flex-wrap gap-2 md:flex">
              <TranscriptChip onClick={() => setSpeakEnabled((enabled) => !enabled)} active={speakEnabled} icon={<Volume2 className="h-3.5 w-3.5" />}>
                Speak: {speakEnabled ? "on" : "off"}
              </TranscriptChip>
              <TranscriptChip onClick={handleSpeak} disabled={!outputText}>Speak now</TranscriptChip>
              <TranscriptChip onClick={commitPrediction} disabled={!currentPrediction} icon={<Zap className="h-3.5 w-3.5" />}>
                [{formatTranscriptCommitShortcut(commitShortcut)}] Add sign
              </TranscriptChip>
              <TranscriptChip onClick={() => setCapturingShortcut(true)} active={capturingShortcut}>
                {capturingShortcut ? "Press a key…" : "Set key"}
              </TranscriptChip>
              <TranscriptChip onClick={handleSpace}>Add space</TranscriptChip>
              <TranscriptChip onClick={handleBackspace} disabled={!outputText}>Backspace</TranscriptChip>
              <TranscriptChip onClick={handleCopy} disabled={!outputText} icon={<Copy className="h-3.5 w-3.5" />}>Copy</TranscriptChip>
              <TranscriptChip onClick={handleClear} disabled={!outputText} tone="danger" icon={<X className="h-3.5 w-3.5" />}>Clear</TranscriptChip>
            </div>
          </div>

          <div className="px-6 pt-3">
            <Textarea
              value={outputText}
              readOnly
              data-testid="transcript"
              aria-live="polite"
              className="min-h-[80px] resize-none rounded-2xl border border-senyalita-border bg-white px-4 py-3.5 text-[17px] leading-relaxed text-senyalita-dark shadow-none placeholder:text-slate-400 focus-visible:ring-0"
              placeholder="Detected signs appear here when you add them."
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 px-6 md:hidden">
            <motion.button type="button" onClick={commitPrediction} disabled={!currentPrediction} whileTap={{ scale: 0.97 }} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-senyalita-primary text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 disabled:bg-slate-300 disabled:shadow-none">
              <Zap className="h-4 w-4" />Add sign
            </motion.button>
            <TranscriptChip onClick={handleSpace} full>Add space</TranscriptChip>
            <TranscriptChip onClick={handleBackspace} disabled={!outputText} full>Backspace</TranscriptChip>
            <TranscriptChip onClick={handleCopy} disabled={!outputText} full icon={<Copy className="h-3.5 w-3.5" />}>Copy transcript</TranscriptChip>
            <TranscriptChip onClick={handleClear} disabled={!outputText} tone="danger" full icon={<X className="h-3.5 w-3.5" />}>Clear</TranscriptChip>
          </div>

          <p className="mt-4 border-t border-senyalita-border/70 bg-white/60 px-6 py-3.5 text-center text-[11px] text-senyalita-muted">
            <span className="md:hidden">Hold a sign steady, then tap Add detected sign.</span>
            <span className="hidden md:inline">
              Hold a sign steady, then press{" "}
              <kbd className="rounded border border-senyalita-border bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-senyalita-dark">
                {formatTranscriptCommitShortcut(commitShortcut)}
              </kbd>{" "}
              or use Add sign to place it in the transcript.
            </span>
          </p>
        </section>
      </motion.div>

      <motion.aside
        className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06 }}
      >
        <SuggestionPanel
          letters={suggestions.letters}
          suggestions={suggestions.suggestions}
          onAccept={acceptSuggestion}
          onBackspace={suggestions.backspace}
          onClear={suggestions.clear}
        />

        <section className="rounded-[22px] border border-senyalita-border bg-white/70 p-5 backdrop-blur-xl">
          <h2 className="mb-2 font-display text-base font-bold tracking-tight text-senyalita-dark">For FSL signers</h2>
          <p className="text-[13px] leading-relaxed text-senyalita-muted">
            Keep your hands centered in the camera frame. Hold a sign briefly, then pause before the next sign for clearer recognition.
          </p>
        </section>

        <section className="rounded-[22px] border border-senyalita-primary/20 bg-senyalita-primary/[0.06] p-5">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-senyalita-primary" />
            <div>
              <h2 className="mb-1 text-xs font-bold text-senyalita-dark">On-device recognition</h2>
              <p className="text-xs leading-relaxed text-senyalita-muted">
                Hand landmarks are read and classified directly in your browser — video never leaves your device.
              </p>
            </div>
          </div>
        </section>

        <section className="min-h-[140px] rounded-[22px] border border-senyalita-border bg-white/70 p-5 backdrop-blur-xl">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-senyalita-muted">Live transcript</h2>
          <p className={cn("line-clamp-4 text-sm leading-relaxed", outputText ? "text-senyalita-dark" : "text-slate-400")}>
            {outputText || "Recognized signs will appear here…"}
          </p>
        </section>

        {/*
          Follows the selected mode, and every entry is derived from the
          model's own labels — see labelPartition.ts. The previous version
          hardcoded "0123456789", which advertised a ZERO the model has no
          class for and omitted TEN, which it has.

          Fixed min-height so switching modes does not shift the layout.
        */}
        <section className="min-h-[196px] rounded-[22px] border border-senyalita-border bg-white/70 p-5 backdrop-blur-xl">
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-senyalita-muted">
            {selectedMode === "phrase-signs"
              ? `Supported phrase signs (${partition.phrases.length})`
              : "Supported characters"}
          </h2>

          {/*
            The lists come from the model, so they do not exist until it has
            loaded — on a slow connection that left the section blank, which
            reads as broken rather than pending. Hardcoding them to fill the
            gap is what put "0123456789" here in the first place.
          */}
          {modelLabels.length === 0 ? (
            <p className="text-[11px] text-slate-400">Loading supported signs…</p>
          ) : selectedMode === "phrase-signs" ? (
            <div className="max-h-[148px] overflow-y-auto pr-1">
              <ul className="flex flex-wrap gap-1.5">
                {partition.phrases.map((phrase) => (
                  <li
                    key={phrase}
                    className="rounded-md border border-senyalita-border bg-white px-1.5 py-0.5 text-[11px] font-medium text-senyalita-muted"
                  >
                    {translateLabel(phrase)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Letters ({partition.letters.length})
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {partition.letters.map((letter) => (
                  <span key={letter} className="flex h-6 w-6 items-center justify-center rounded-md border border-senyalita-primary/15 bg-senyalita-primary/[0.07] font-mono text-[11px] font-bold uppercase text-senyalita-primary">
                    {letter}
                  </span>
                ))}
              </div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Numbers ({partition.numbers.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {partition.numbers.map((label) => (
                  <span key={label} className="flex h-6 min-w-6 items-center justify-center rounded-md border border-senyalita-border bg-white px-1 font-mono text-[11px] font-bold text-senyalita-muted">
                    {numberDisplay(label)}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </motion.aside>
    </div>
  );
}

/**
 * Pill-shaped transcript action. Mirrors the Type→Sign composer chips so both
 * translation directions share one control vocabulary.
 */
function TranscriptChip({
  onClick, disabled, active, tone = "default", full, icon, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "default" | "danger";
  full?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        full ? "h-11 w-full justify-center text-[13px]" : "h-8 px-3 text-xs",
        tone === "danger"
          ? "border-rose-200 bg-white text-rose-600 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-sm"
          : active
            ? "border-senyalita-primary/30 bg-senyalita-primary/10 text-senyalita-primary"
            : "border-senyalita-border bg-white text-senyalita-muted hover:-translate-y-0.5 hover:border-senyalita-primary/30 hover:text-senyalita-dark hover:shadow-sm",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
