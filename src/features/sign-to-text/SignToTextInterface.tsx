"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RealtimeMetrics, useRecognition, translateLabel } from "@/features/recognition";
import { CommunicationProfileManager } from "@/features/profiles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Video, Zap, AlertTriangle, Loader2, Settings, Copy, X, Power, Info, Volume2 } from "lucide-react";
import { DebugOverlay } from "@/features/recognition/DebugOverlay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTranscriptCommitShortcut, isTranscriptCommitShortcut } from "./commitShortcut";
import { createFrameRateTracker } from "./cameraFrameRate";
import { HAND_CAPTURE_CONSTRAINTS, HAND_LANDMARKER_OPTIONS } from "./handCaptureProfile";
import { SuggestionPanel, useLetterSuggestions } from "@/features/suggestions";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17],
];

const HAND_LANDMARKER_MODEL_URL = process.env.NEXT_PUBLIC_MEDIAPIPE_HAND_MODEL_URL
  ?? "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

/** 30fps — the rate training clips were extracted at. */
const CAPTURE_TARGET_FPS = 30;
// A small tolerance stops a camera running at a nominal 30fps from having
// every other frame rejected by jitter.
const CAPTURE_INTERVAL_MS = 1000 / CAPTURE_TARGET_FPS - 2;

type Status = "waiting" | "starting" | "active" | "no-hand" | "error";

function StatusIndicator({ status }: { status: Status }) {
  const statusConfig = {
    waiting: { icon: <Power className="h-4 w-4" />, text: "Camera off", color: "text-stone-500" },
    starting: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: "Starting camera", color: "text-blue-500" },
    active: { icon: <Zap className="h-4 w-4" />, text: "Live recognition", color: "text-emerald-600" },
    "no-hand": { icon: <AlertTriangle className="h-4 w-4" />, text: "No hand detected", color: "text-amber-600" },
    error: { icon: <AlertTriangle className="h-4 w-4" />, text: "Camera error", color: "text-red-600" },
  };
  const { icon, text, color } = statusConfig[status];
  return <div className={cn("flex items-center gap-1.5 text-xs font-semibold", color)}>{icon}<span>{text}</span></div>;
}

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
  const handLandmarkerRef = useRef<{ close: () => void } | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRunIdRef = useRef(0);
  const [status, setStatus] = useState<Status>("waiting");
  const [errorMessage, setErrorMessage] = useState("");
  const [mediapipeFps, setMediapipeFps] = useState(0);
  // Rate landmarks actually enter the recognition buffer, which is what has to
  // match training — distinct from the MediaPipe detection rate above.
  const [captureFps, setCaptureFps] = useState(0);
  const [outputText, setOutputText] = useState("");
  const suggestions = useLetterSuggestions();
  const [showDebug, setShowDebug] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [commitShortcut, setCommitShortcut] = useState("Space");
  const [capturingShortcut, setCapturingShortcut] = useState(false);
  const [telemetrySessionToken, setTelemetrySessionToken] = useState<string | null>(null);

  const onPrediction = useCallback(() => {}, []);
  const recognition = useRecognition(onPrediction);
  const { appendFrame, resetRecognition } = recognition;

  const currentPrediction = recognition.frozenPrediction ?? (recognition.state.stage === "predicting" ? recognition.state.result : null);

  useEffect(() => {
    setTelemetrySessionToken(new CommunicationProfileManager().getToken());
  }, []);

  const speak = useCallback((text: string) => {
    if (!speakEnabled) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [speakEnabled]);

  // Committing a sign feeds the spelling buffer as well as the transcript;
  // recognition itself is untouched.
  const commitPrediction = useCallback(() => {
    if (!currentPrediction) return;
    const display = translateLabel(currentPrediction.label);
    setOutputText((previousText) => previousText + display);
    suggestions.appendLabel(currentPrediction.label);
    speak(display);
  }, [currentPrediction, speak, suggestions]);

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
      const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      let handLandmarker;
      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "GPU" },
          ...HAND_LANDMARKER_OPTIONS,
        });
      } catch {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "CPU" },
          ...HAND_LANDMARKER_OPTIONS,
        });
      }
      if (cameraRunIdRef.current !== runId) {
        handLandmarker.close();
        return;
      }
      handLandmarkerRef.current = handLandmarker;
      let lastVideoTime = -1;
      // Landmarks are appended on a fixed ~30Hz cadence to match the rate the
      // training clips were extracted at (scripts/extract-holistic-videos.mjs
      // uses ffmpeg fps=30). A 60fps camera would otherwise pack twice the
      // frames into the model's 120-frame window and halve its real duration.
      let lastAppendTime = -Infinity;
      const fpsTracker = createFrameRateTracker(performance.now());
      const captureTracker = createFrameRateTracker(performance.now());
      const drawLandmarks = () => {
        if (cameraRunIdRef.current !== runId || !videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        const video = videoRef.current;
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const frameTimestamp = performance.now();
          const results = handLandmarker.detectForVideo(video, frameTimestamp);
          const measuredFps = fpsTracker.record(frameTimestamp);
          if (measuredFps > 0) setMediapipeFps(measuredFps);
          const leftIndex = results.handedness.findIndex((handedness) => handedness[0]?.categoryName?.toLowerCase() === "left");
          const rightIndex = results.handedness.findIndex((handedness) => handedness[0]?.categoryName?.toLowerCase() === "right");
          // Rendering below still runs on every camera frame; only the
          // recognition buffer is throttled, keeping the two decoupled.
          if (frameTimestamp - lastAppendTime >= CAPTURE_INTERVAL_MS) {
            lastAppendTime = frameTimestamp;
            appendFrame(
              leftIndex >= 0 ? { landmarks: results.landmarks[leftIndex] } : null,
              rightIndex >= 0 ? { landmarks: results.landmarks[rightIndex] } : null,
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
            results.landmarks.forEach((hand) => {
              HAND_CONNECTIONS.forEach(([start, end]) => {
                context.beginPath();
                context.moveTo(hand[start].x * canvas.width, hand[start].y * canvas.height);
                context.lineTo(hand[end].x * canvas.width, hand[end].y * canvas.height);
                context.strokeStyle = "rgba(46, 215, 132, 0.85)";
                context.lineWidth = 2;
                context.stroke();
              });
              hand.forEach((point) => {
                context.beginPath();
                context.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
                context.fillStyle = "rgba(255, 240, 232, 0.95)";
                context.fill();
              });
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
    resetRecognition();
    window.dispatchEvent(new CustomEvent("senyalita:camera-state", { detail: false }));
  }, [clearCameraResources, resetRecognition]);

  useEffect(() => () => stopCamera(), [stopCamera]);

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
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 max-w-[1160px] mx-auto">
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
      <motion.div className="rounded-2xl border border-stone-200 bg-[#fffdfa] p-4 md:p-5 shadow-[0_10px_28px_rgba(69,45,28,0.08)]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="relative h-[380px] md:h-[500px] overflow-hidden rounded-xl bg-[#1d1a18]">
          <video ref={videoRef} className="h-full w-full object-contain" playsInline autoPlay muted />
          <canvas ref={landmarkCanvasRef} className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-lg bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">FSL Sign Language</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"><span className={cn("h-2 w-2 rounded-full", status === "active" ? "animate-pulse bg-[#d88567]" : status === "error" ? "bg-red-400" : status === "no-hand" ? "bg-amber-400" : "bg-stone-500")} />{cameraStatusLabel[status]}{status === "active" && mediapipeFps > 0 ? ` ${mediapipeFps} fps` : ""}</span>
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setShowDebug(!showDebug)} className="h-9 w-9 rounded-lg bg-black/55 text-white hover:bg-black/70 hover:text-white"><Settings className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Toggle recognition details</p></TooltipContent></Tooltip></TooltipProvider>
            {(status === "active" || status === "no-hand") && <Button onClick={stopCamera} size="sm" className="h-9 rounded-lg bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100"><Power className="mr-1.5 h-3.5 w-3.5" />Stop</Button>}
          </div>
          {errorMessage && (
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-red-900/80 px-4 py-3 text-xs text-red-200 backdrop-blur-sm">
              {errorMessage}
            </div>
          )}
          <AnimatePresence>
            {status === "waiting" && <motion.div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1d1a18] px-6 text-center text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#5b3025] text-[#efb39d]"><Video className="h-6 w-6" /></span><p className="max-w-md text-sm font-medium text-stone-200">Start the camera, then sign <span className="text-[#efb39d]">letters (A-Z) or numbers (0-9)</span> - hold each sign steady.</p><p className="mb-6 mt-2 text-xs text-stone-500">Hand tracking runs locally on your device.</p><Button onClick={startCamera} size="lg" className="rounded-lg bg-[#d88567] px-5 text-white hover:bg-[#bc6d53]"><Zap className="mr-2 h-4 w-4" />Start camera</Button></motion.div>}
          </AnimatePresence>
        </div>
        {showDebug && <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
          <DebugOverlay recognitionState={recognition.state} mediapipeFps={mediapipeFps} captureFps={captureFps} inferenceTimeMs={recognition.inferenceTimeMs} bufferLength={recognition.bufferLength} bufferCap={recognition.bufferCap} minimumFrames={recognition.minimumFrames} />
          <div className="border-t border-stone-200 bg-stone-50 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Camera debug</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600">
              <span>Camera: <strong>{cameraStreamRef.current ? "Ready" : "Off"}</strong></span>
              <span>Permission: <strong>{navigator.permissions ? "API available" : "N/A"}</strong></span>
              <span>MediaPipe: <strong>{handLandmarkerRef.current ? "Running" : "Stopped"}</strong></span>
              <span>FPS: <strong>{mediapipeFps}</strong></span>
              <span>Hands: <strong>{status === "active" ? "Detected" : status === "no-hand" ? "None" : "—"}</strong></span>
              <span>Recognition: <strong>{recognition.state.stage}</strong></span>
              <span>Prediction: <strong>{currentPrediction ? translateLabel(currentPrediction.label) : "—"}</strong></span>
              <span>Confidence: <strong>{currentPrediction ? `${Math.round(currentPrediction.confidence * 100)}%` : "—"}</strong></span>
            </div>
          </div>
        </div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Recognition model</p><p className="mt-1 text-sm font-semibold text-stone-700">{recognition.state.stage === "loading-model" ? "Loading on-device model" : recognition.state.stage === "error" ? recognition.state.message : currentPrediction ? `${translateLabel(currentPrediction.label)} (${Math.round(currentPrediction.confidence * 100)}%)` : "Waiting for a stable sign"}</p></div>
          <Button onClick={commitPrediction} disabled={!currentPrediction} className="h-11 w-full rounded-md bg-[#d88567] px-4 text-white hover:bg-[#bc6d53] sm:w-auto"><Zap className="mr-2 h-4 w-4" />Add detected sign</Button>
        </div>
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Transcript</span><div className="hidden flex-wrap gap-2 md:flex"><Button onClick={() => setSpeakEnabled((enabled) => !enabled)} variant="outline" size="sm" className="h-8 rounded-md border-[#e7b9a8] px-2.5 text-xs text-[#a85e48] hover:bg-[#fff5f0]"><Volume2 className="mr-1 h-3 w-3" />Speak: {speakEnabled ? "on" : "off"}</Button><Button onClick={handleSpeak} variant="outline" size="sm" disabled={!outputText} className="h-8 rounded-md px-2.5 text-xs">Speak now</Button><Button onClick={commitPrediction} variant="outline" size="sm" disabled={!currentPrediction} className="h-8 rounded-md border-[#e7b9a8] px-2.5 text-xs text-[#a85e48] hover:bg-[#fff5f0]">[{formatTranscriptCommitShortcut(commitShortcut)}] Add sign</Button><Button onClick={() => setCapturingShortcut(true)} variant="outline" size="sm" className="h-8 rounded-md px-2.5 text-xs">{capturingShortcut ? "Press a key..." : "Set key"}</Button><Button onClick={handleSpace} variant="outline" size="sm" className="h-8 rounded-md px-2.5 text-xs">Add space</Button><Button onClick={handleBackspace} variant="outline" size="sm" disabled={!outputText} className="h-8 rounded-md px-2.5 text-xs">Backspace</Button><Button onClick={handleClear} variant="outline" size="sm" disabled={!outputText} className="h-8 rounded-md border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50">Clear</Button></div></div>
          <Textarea value={outputText} readOnly className="min-h-[64px] resize-none border-0 bg-transparent p-0 text-base text-stone-700 shadow-none focus-visible:ring-0" placeholder="Detected signs appear here when you add them." />
          <div className="mt-4 grid grid-cols-2 gap-2 md:hidden"><Button onClick={commitPrediction} disabled={!currentPrediction} className="h-11 bg-[#d88567] text-white hover:bg-[#bc6d53]"><Zap className="mr-2 h-4 w-4" />Add sign</Button><Button onClick={handleSpace} variant="outline" className="h-11">Add space</Button><Button onClick={handleBackspace} variant="outline" disabled={!outputText} className="h-11">Backspace</Button><Button onClick={handleClear} variant="outline" disabled={!outputText} className="h-11 border-red-200 text-red-600 hover:bg-red-50">Clear</Button><Button onClick={handleCopy} variant="outline" disabled={!outputText} className="col-span-2 h-11"><Copy className="mr-2 h-4 w-4" />Copy transcript</Button></div>
        </div>
        <div className="mt-3 text-center text-xs text-stone-400"><span className="md:hidden">Hold a sign steady, then tap Add detected sign.</span><span className="hidden md:inline">Hold a sign steady, then press {formatTranscriptCommitShortcut(commitShortcut)} or use Add sign to place it in the transcript.</span></div>
      </motion.div>
      <motion.aside className="flex flex-col gap-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_8px_20px_rgba(69,45,28,0.06)]"><h2 className="mb-2 font-display text-base font-bold text-stone-800">For FSL signers</h2><p className="text-sm leading-5 text-stone-600">Keep your hands centered in the camera frame. Hold a sign briefly, then pause before the next sign for clearer recognition.</p></section>
        <section className="rounded-2xl border border-[#efd48c] bg-[#fffaf0] p-5"><div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#c88733]" /><div><h2 className="mb-1 text-xs font-bold text-[#a86624]">Filipino Sign Language</h2><p className="text-xs leading-5 text-[#a86624]">Recognition uses local hand landmarks and runs directly in your browser.</p></div></div></section>
        <SuggestionPanel
          letters={suggestions.letters}
          suggestions={suggestions.suggestions}
          onAccept={acceptSuggestion}
          onBackspace={suggestions.backspace}
          onClear={suggestions.clear}
        />

        <section className="min-h-[150px] rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_8px_20px_rgba(69,45,28,0.06)]"><h2 className="mb-3 text-sm font-semibold text-stone-800">Live transcript</h2><p className="line-clamp-4 text-sm leading-6 text-stone-400">{outputText || "Recognized signs will appear here..."}</p></section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_8px_20px_rgba(69,45,28,0.06)]"><h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">Supported characters</h2><p className="mb-2 text-[10px] font-semibold uppercase text-stone-400">Letters</p><div className="mb-4 flex flex-wrap gap-1.5">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => <span key={letter} className="flex h-5 w-5 items-center justify-center rounded bg-[#fff3ee] text-[10px] font-bold text-[#ab654d]">{letter}</span>)}</div><p className="mb-2 text-[10px] font-semibold uppercase text-stone-400">Numbers</p><div className="flex flex-wrap gap-1.5">{"0123456789".split("").map((number) => <span key={number} className="flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-[10px] font-bold text-stone-600">{number}</span>)}</div></section>
      </motion.aside>
    </div>
  );
}
