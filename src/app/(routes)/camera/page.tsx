"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LandmarkFrame,
  LanguageOption,
  PredictionResult,
  recognizeMock
} from "@/features/recognition";
import {
  MAX_FRAMES,
  MAX_RECORDING_MS,
  buildExportFilename,
  createExportPayload,
  downloadJson,
  sanitizeLabel
} from "@/features/dataset";

type Status =
  | "waiting"
  | "active"
  | "no-hand"
  | "hand-1"
  | "hand-2"
  | "error";

const INITIAL_RESULT: Record<LanguageOption, PredictionResult> = {
  en: {
    text: "No sign detected yet.",
    confidence: 0,
    suggestions: [],
    handCount: 0,
    language: "en"
  },
  tl: {
    text: "Wala pang natutukoy na senyas.",
    confidence: 0,
    suggestions: [],
    handCount: 0,
    language: "tl"
  }
};

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const fpsRef = useRef({ frames: 0, last: performance.now(), value: 0 });
  const languageRef = useRef<LanguageOption>("en");
  const latestResultRef = useRef<PredictionResult>(INITIAL_RESULT.en);
  const latestStatusRef = useRef<Status>("waiting");
  const latestHandCountRef = useRef(0);
  const latestFpsRef = useRef(0);
  const uiTimerRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const recordingStartRef = useRef<number | null>(null);
  const recordedFramesRef = useRef<
    Array<{
      timestampMs: number;
      handCount: number;
      hands: Array<{ handedness?: string; landmarks: Array<{ x: number; y: number; z: number }> }>;
    }>
  >([]);
  const stopRequestedRef = useRef(false);
  const [status, setStatus] = useState<Status>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [language, setLanguage] = useState<LanguageOption>("en");
  const [prediction, setPrediction] = useState<PredictionResult>(
    INITIAL_RESULT.en
  );
  const [recordingLabel, setRecordingLabel] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFrameCount, setRecordedFrameCount] = useState(0);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "waiting":
        return "Waiting for camera";
      case "active":
        return "Camera active";
      case "hand-1":
        return "1 hand detected";
      case "hand-2":
        return "2 hands detected";
      case "no-hand":
        return "No hand detected";
      case "error":
        return "Camera error";
      default:
        return "";
    }
  }, [status]);

  const setStatusSafe = (next: Status) => {
    setStatus((prev) => (prev === next ? prev : next));
  };

  const setHandCountSafe = (count: number) => {
    setHandCount((prev) => (prev === count ? prev : count));
  };

  const updatePredictionUi = (next: PredictionResult) => {
    setPrediction((prev) => {
      if (
        prev.text === next.text &&
        prev.confidence === next.confidence &&
        prev.handCount === next.handCount &&
        prev.language === next.language
      ) {
        return prev;
      }
      return next;
    });
  };

  const updateRecordingUi = () => {
    if (!isRecordingRef.current || recordingStartRef.current === null) {
      return;
    }

    const currentFrames = recordedFramesRef.current.length;
    const nextDuration = Date.now() - recordingStartRef.current;

    setRecordedFrameCount((prev) => (prev === currentFrames ? prev : currentFrames));
    setRecordingDurationMs((prev) =>
      Math.abs(prev - nextDuration) < 100 ? prev : nextDuration
    );
  };

  const getCameraErrorMessage = (err: unknown) => {
    const fallback = "Camera permission denied or unavailable.";

    if (!err || typeof err !== "object") {
      return fallback;
    }

    const maybeError = err as { name?: string; message?: string };
    const name = maybeError.name ?? "UnknownError";
    const message = maybeError.message ? ` ${maybeError.message}` : "";

    switch (name) {
      case "NotAllowedError":
        return `Camera access blocked. Allow camera permission in the browser settings.${message}`;
      case "NotFoundError":
        return `No camera device was found. Connect or enable a webcam and try again.${message}`;
      case "NotReadableError":
        return `Camera is already in use by another app. Close other apps using the camera and retry.${message}`;
      case "OverconstrainedError":
        return `Camera constraints cannot be satisfied. Try a different camera device or resolution.${message}`;
      case "SecurityError":
        return `Camera access requires a secure context. Use https or http://localhost.${message}`;
      case "AbortError":
        return `Camera request was interrupted. Reload the page and try again.${message}`;
      default:
        return `Camera error (${name}).${message}`;
    }
  };

  const startRecording = () => {
    if (!recordingLabel.trim()) {
      return;
    }
    recordedFramesRef.current = [];
    recordingStartRef.current = Date.now();
    stopRequestedRef.current = false;
    setRecordedFrameCount(0);
    setRecordingDurationMs(0);
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
    const start = recordingStartRef.current;
    if (start !== null) {
      setRecordingDurationMs(Date.now() - start);
    }
    setRecordedFrameCount(recordedFramesRef.current.length);
  };

  const clearRecording = () => {
    setIsRecording(false);
    recordingStartRef.current = null;
    recordedFramesRef.current = [];
    stopRequestedRef.current = false;
    setRecordedFrameCount(0);
    setRecordingDurationMs(0);
  };

  const exportRecording = () => {
    const frames = recordedFramesRef.current;
    const startedAt = recordingStartRef.current;
    if (!frames.length || startedAt === null) {
      return;
    }

    const label = sanitizeLabel(recordingLabel);
    const timestampMs = Date.now();
    const payload = createExportPayload({
      label,
      frames,
      startedAtMs: startedAt,
      endedAtMs: timestampMs
    });
    const filename = buildExportFilename(label, timestampMs);
    downloadJson(filename, payload);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let camera: { start?: () => void; stop?: () => void } | null = null;
    let hands: any | null = null;
    let cancelled = false;

    const updateCameraUi = () => {
      setStatusSafe(latestStatusRef.current);
      setHandCountSafe(latestHandCountRef.current);
      setFps((prev) =>
        prev === latestFpsRef.current ? prev : latestFpsRef.current
      );
    };

    const setup = async () => {
      setStatusSafe("waiting");
      latestStatusRef.current = "waiting";
      setError(null);

      if (!window.isSecureContext) {
        setStatusSafe("error");
        latestStatusRef.current = "error";
        setError(
          "Camera access requires a secure context. Use https or http://localhost."
        );
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatusSafe("error");
        latestStatusRef.current = "error";
        setError("Camera API not supported by this browser.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });

        if (cancelled) {
          return;
        }

        const video = videoRef.current;
        if (!video) {
          return;
        }

        video.srcObject = stream;
        await video.play();
        setStatusSafe("active");
        latestStatusRef.current = "active";

        const [{ Hands, HAND_CONNECTIONS }, drawingUtils, cameraUtils] =
          await Promise.all([
            import("@mediapipe/hands"),
            import("@mediapipe/drawing_utils"),
            import("@mediapipe/camera_utils")
          ]);

        hands = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        if (!hands) {
          return;
        }

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results: any) => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          const videoEl = videoRef.current;

          if (!canvas || !ctx || !videoEl) {
            return;
          }

          const width = videoEl.videoWidth;
          const height = videoEl.videoHeight;

          if (!width || !height) {
            return;
          }

          if (!lastSizeRef.current ||
              lastSizeRef.current.width !== width ||
              lastSizeRef.current.height !== height) {
            canvas.width = width;
            canvas.height = height;
            lastSizeRef.current = { width, height };
          }

          ctx.save();
          ctx.clearRect(0, 0, width, height);

          const landmarksList = results.multiHandLandmarks ?? [];
          const detectedHands = landmarksList.length;
          const handednessList = results.multiHandedness ?? [];
          const mappedLandmarks: Array<Array<{ x: number; y: number; z: number }>> =
            landmarksList.map((hand: any[]) =>
              hand.map((point: any) => ({
                x: point.x,
                y: point.y,
                z: point.z
              }))
            );

          const frame: LandmarkFrame = {
            hands: mappedLandmarks
          };

          latestResultRef.current = recognizeMock({
            frame,
            handCount: detectedHands,
            language: languageRef.current
          });

          if (isRecordingRef.current) {
            const startTime = recordingStartRef.current ?? Date.now();
            const durationMs = Date.now() - startTime;
            const frames = recordedFramesRef.current;

            if (
              !stopRequestedRef.current &&
              (frames.length >= MAX_FRAMES || durationMs >= MAX_RECORDING_MS)
            ) {
              stopRequestedRef.current = true;
              stopRecording();
            }

            if (!stopRequestedRef.current) {
              frames.push({
                timestampMs: Date.now(),
                handCount: detectedHands,
                hands: mappedLandmarks.map((landmarks, index) => ({
                  handedness: handednessList[index]?.label,
                  landmarks
                }))
              });
            }
          }

          const now = performance.now();
          fpsRef.current.frames += 1;
          const delta = now - fpsRef.current.last;
          if (delta >= 500) {
            fpsRef.current.value = Math.round(
              (fpsRef.current.frames * 1000) / delta
            );
            fpsRef.current.frames = 0;
            fpsRef.current.last = now;
            latestFpsRef.current = fpsRef.current.value;
          }

          if (detectedHands > 0) {
            latestHandCountRef.current = detectedHands;
            latestStatusRef.current = detectedHands === 1 ? "hand-1" : "hand-2";
            for (const landmarks of landmarksList) {
              drawingUtils.drawConnectors(
                ctx,
                landmarks,
                HAND_CONNECTIONS,
                {
                  color: "#22c55e",
                  lineWidth: 3
                }
              );
              drawingUtils.drawLandmarks(ctx, landmarks, {
                color: "#ef4444",
                lineWidth: 2
              });
            }
          } else {
            latestHandCountRef.current = 0;
            latestStatusRef.current = "no-hand";
          }

          ctx.restore();
        });

        camera = new cameraUtils.Camera(video, {
          onFrame: async () => {
            const currentVideo = videoRef.current;
            if (!hands || !currentVideo || isProcessingRef.current) {
              return;
            }
            isProcessingRef.current = true;
            try {
              await (hands as any).send({ image: currentVideo });
            } finally {
              isProcessingRef.current = false;
            }
          },
          width: 640,
          height: 480
        });

        camera?.start?.();

        if (uiTimerRef.current === null) {
          uiTimerRef.current = window.setInterval(() => {
            updatePredictionUi(latestResultRef.current);
            updateRecordingUi();
            updateCameraUi();
          }, 200);
        }
      } catch (err) {
        setStatusSafe("error");
        latestStatusRef.current = "error";
        setError(getCameraErrorMessage(err));
      }
    };

    setup();

    const cleanupVideoEl = videoRef.current;

    return () => {
      cancelled = true;
      isProcessingRef.current = false;
      if (uiTimerRef.current !== null) {
        window.clearInterval(uiTimerRef.current);
        uiTimerRef.current = null;
      }
      camera?.stop?.();
      hands?.close?.();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (cleanupVideoEl) {
        cleanupVideoEl.srcObject = null;
      }
    };
  }, []);

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(prediction.text);
    utterance.lang = language === "en" ? "en-US" : "fil-PH";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className="page">
      <section className="camera-shell">
        <div className="camera-header">
          <h1>Camera</h1>
          <span className={`status status-${status}`}>{statusLabel}</span>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="video-wrap">
          <video ref={videoRef} className="video" playsInline muted />
          <canvas ref={canvasRef} className="overlay" />
        </div>

        <section className="panel">
          <h2>Transcript</h2>
          <p className="mock-label">Mock recognition preview</p>
          <p className="panel-label">Output language</p>
          <div className="toggle">
            <button
              className={`toggle-button ${language === "en" ? "active" : ""}`}
              type="button"
              onClick={() => setLanguage("en")}
            >
              English
            </button>
            <button
              className={`toggle-button ${language === "tl" ? "active" : ""}`}
              type="button"
              onClick={() => setLanguage("tl")}
            >
              Tagalog
            </button>
          </div>
          <p className="transcript-text">{prediction.text}</p>
          <p className="confidence">
            Confidence: {Math.round(prediction.confidence * 100)}%
          </p>
          <div className="suggestions">
            <p className="panel-label">Top suggestions</p>
            <ul>
              {prediction.suggestions.map((suggestion) => (
                <li key={suggestion.text}>
                  {suggestion.text} ({Math.round(suggestion.confidence * 100)}%)
                </li>
              ))}
            </ul>
          </div>
          <div className="summary">
            <span>Hands detected: {handCount}</span>
            <span>Mode: Landmark preview</span>
            <span>FPS: {fps}</span>
          </div>
          <button className="button" onClick={handleSpeak}>
            Text-to-Speech
          </button>
        </section>

        <section className="panel panel-secondary">
          <h2>Developer dataset capture</h2>
          <p className="panel-note">
            Temporary frontend-only tool for preparing CNN-LSTM data. This will
            move to Admin later.
          </p>
          <div className="capture-grid">
            <label className="capture-field">
              Sign label
              <input
                type="text"
                placeholder="hello"
                value={recordingLabel}
                onChange={(event) => setRecordingLabel(event.target.value)}
              />
            </label>
            <div className="capture-metrics">
              <span>Frames: {recordedFrameCount}</span>
              <span>
                Duration: {(recordingDurationMs / 1000).toFixed(1)}s
              </span>
              <span>
                Limit: {MAX_FRAMES} frames / {MAX_RECORDING_MS / 1000}s
              </span>
            </div>
          </div>
          <div className="capture-actions">
            <button
              className="button"
              type="button"
              onClick={startRecording}
              disabled={!recordingLabel.trim() || isRecording}
            >
              Start Recording
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={stopRecording}
              disabled={!isRecording}
            >
              Stop Recording
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={clearRecording}
              disabled={isRecording || recordedFrameCount === 0}
            >
              Clear Recording
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={exportRecording}
              disabled={recordedFrameCount === 0}
            >
              Export JSON
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
