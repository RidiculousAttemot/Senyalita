"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  LanguageOption,
  useRecognition,
  RecognitionState
} from "@/features/recognition";
import {
  MAX_FRAMES,
  MAX_RECORDING_MS,
  buildExportFilename,
  createExportPayload,
  downloadJson,
  sanitizeLabel
} from "@/features/dataset";
import {
  createSession,
  recordPrediction,
  endSession,
  getTranscriptEntries,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  ConfidenceThreshold
} from "@/features/logging";

type Status =
  | "waiting"
  | "active"
  | "no-hand"
  | "hand-1"
  | "hand-2"
  | "error";
const SMOOTHING_ALPHA = 0.2;
const RECORDING_SAMPLE_MS = 60;

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const fpsRef = useRef({ frames: 0, last: performance.now(), value: 0 });
  const latestStatusRef = useRef<Status>("waiting");
  const latestHandCountRef = useRef(0);
  const latestFpsRef = useRef(0);
  const smoothedLandmarksRef = useRef<
    Array<Array<{ x: number; y: number; z: number }>> | null
  >(null);
  const lastRecordSampleRef = useRef(0);
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
  const lastHandednessRef = useRef<
    Array<{ label: string }>
  >([]);
  const [status, setStatus] = useState<Status>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [recordingLabel, setRecordingLabel] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFrameCount, setRecordedFrameCount] = useState(0);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);

  const [confidenceThreshold, setConfidenceThreshold] =
    useState<ConfidenceThreshold>(DEFAULT_CONFIDENCE_THRESHOLD);
  const [transcript, setTranscript] = useState<string[]>([]);
  const lastTranscriptLabelRef = useRef("");
  const sessionIdRef = useRef(createSession());
  const sessionStartedRef = useRef(new Date().toISOString());
  const [sessionMetrics, setSessionMetrics] = useState({
    currentConfidence: 0,
    avgConfidence: 0,
    currentInferenceTime: 0,
    avgInferenceTime: 0,
    currentFps: 0,
    avgFps: 0,
    totalPredictions: 0
  });
  const metricsLogRef = useRef<Array<{
    label: string;
    confidence: number;
    topK: Array<{ label: string; confidence: number }>;
    inferenceTimeMs: number;
    fps: number;
  }>>([]);
  const latestInferenceTimeRef = useRef(0);

  const onPrediction = useCallback(
    (_result: unknown, inferenceTimeMs: number) => {
      latestInferenceTimeRef.current = inferenceTimeMs;
    },
    []
  );

  const { state: recognitionState, appendFrame } = useRecognition(onPrediction);

  useEffect(() => {
    if (recognitionState.stage !== "predicting") return;
    const result = recognitionState.result;
    if (!result) return;

    const currentFps = latestFpsRef.current;
    const inferenceTimeMs = latestInferenceTimeRef.current;

    recordPrediction({
      sessionId: sessionIdRef.current,
      predictedLabel: result.label,
      confidence: result.confidence,
      topK: result.topK,
      smoothingEnabled: true,
      inferenceTimeMs,
      fps: currentFps
    });

    const m = metricsLogRef.current;
    m.push({
      label: result.label,
      confidence: result.confidence,
      topK: result.topK,
      inferenceTimeMs,
      fps: currentFps
    });
    if (m.length > 100) m.shift();
    const count = m.length;
    setSessionMetrics({
      currentConfidence: result.confidence,
      avgConfidence: m.reduce((s, e) => s + e.confidence, 0) / count,
      currentInferenceTime: inferenceTimeMs,
      avgInferenceTime: m.reduce((s, e) => s + e.inferenceTimeMs, 0) / count,
      currentFps,
      avgFps: m.reduce((s, e) => s + e.fps, 0) / count,
      totalPredictions: m.length
    });

    if (
      result.confidence >= confidenceThreshold &&
      result.label !== lastTranscriptLabelRef.current
    ) {
      lastTranscriptLabelRef.current = result.label;
      setTranscript((t) => [...t, result.label]);
    }
  }, [recognitionState, confidenceThreshold]);

  const languageRef = useRef<LanguageOption>("en");
  const [language, setLanguage] = useState<LanguageOption>("en");

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

  const recognitionStatusLabel = useMemo(() => {
    switch (recognitionState.stage) {
      case "loading-model":
        return "Loading model...";
      case "collecting":
        return `Collecting sequence (${recognitionState.progress}/${recognitionState.total})`;
      case "predicting":
        return "Predicting";
      case "error":
        return `Recognition error: ${recognitionState.message}`;
      default:
        return "";
    }
  }, [recognitionState]);

  const recognitionResult = recognitionState.stage === "predicting"
    ? recognitionState.result
    : null;

  const setStatusSafe = (next: Status) => {
    setStatus((prev) => (prev === next ? prev : next));
  };

  const setHandCountSafe = (count: number) => {
    setHandCount((prev) => (prev === count ? prev : count));
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
    const nextLabel = recordingLabel.trim() || "sample";
    if (recordingLabel.trim() !== nextLabel) {
      setRecordingLabel(nextLabel);
    }
    recordedFramesRef.current = [];
    recordingStartRef.current = Date.now();
    stopRequestedRef.current = false;
    lastRecordSampleRef.current = 0;
    setRecordedFrameCount(0);
    setRecordingDurationMs(0);
    setIsRecording(true);
  };

  const smoothLandmarks = (
    previous: Array<Array<{ x: number; y: number; z: number }>> | null,
    next: Array<Array<{ x: number; y: number; z: number }>>,
    alpha: number
  ) => {
    if (!previous || previous.length !== next.length) {
      return next;
    }

    return next.map((hand, handIndex) => {
      const prevHand = previous[handIndex];
      if (!prevHand || prevHand.length !== hand.length) {
        return hand;
      }

      return hand.map((point, pointIndex) => {
        const prevPoint = prevHand[pointIndex];
        if (!prevPoint) {
          return point;
        }

        return {
          x: prevPoint.x + (point.x - prevPoint.x) * alpha,
          y: prevPoint.y + (point.y - prevPoint.y) * alpha,
          z: prevPoint.z + (point.z - prevPoint.z) * alpha
        };
      });
    });
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
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6
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
          lastHandednessRef.current = handednessList;
          const mappedLandmarks: Array<Array<{ x: number; y: number; z: number }>> =
            landmarksList.map((hand: any[]) =>
              hand.map((point: any) => ({
                x: point.x,
                y: point.y,
                z: point.z
              }))
            );

          const smoothedLandmarks = smoothLandmarks(
            smoothedLandmarksRef.current,
            mappedLandmarks,
            SMOOTHING_ALPHA
          );
          smoothedLandmarksRef.current = smoothedLandmarks;

          let leftHand: { landmarks: Array<{ x: number; y: number; z: number }> } | null = null;
          let rightHand: { landmarks: Array<{ x: number; y: number; z: number }> } | null = null;

          for (let i = 0; i < detectedHands; i += 1) {
            const handedness = handednessList[i]?.label ?? "";
            const landmarks = smoothedLandmarks[i] ?? mappedLandmarks[i];
            const hand = { landmarks };

            if (handedness.toLowerCase().includes("left")) {
              leftHand = hand;
            } else {
              rightHand = hand;
            }
          }

          if (detectedHands > 0) {
            appendFrame(leftHand, rightHand);
          }

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
              const nowMs = Date.now();
              if (nowMs - lastRecordSampleRef.current >= RECORDING_SAMPLE_MS) {
                lastRecordSampleRef.current = nowMs;
                frames.push({
                  timestampMs: nowMs,
                  handCount: detectedHands,
                  hands: smoothedLandmarks.map((landmarks, index) => ({
                    handedness: handednessList[index]?.label,
                    landmarks
                  }))
                });
              }
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
            for (const landmarks of smoothedLandmarks) {
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
    const cleanupSessionId = sessionIdRef.current;
    const cleanupSessionStarted = sessionStartedRef.current;

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
      endSession(cleanupSessionId, cleanupSessionStarted);
    };
  }, [appendFrame]);

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const text = recognitionResult?.label ?? "No sign detected";
    const utterance = new SpeechSynthesisUtterance(text);
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
        {recognitionState.stage === "error" && (
          <p className="error-text">Model: {recognitionState.message}</p>
        )}

        <div className="camera-layout">
          <div className="camera-main">
            <div className="video-wrap">
              <video ref={videoRef} className="video" playsInline muted />
              <canvas ref={canvasRef} className="overlay" />
            </div>

            <section className="panel">
              <h2>Transcript</h2>
              <p className="recognition-status">
                {recognitionStatusLabel}
              </p>

              {recognitionResult ? (
                <>
                  <p className="transcript-text predicted-sign">
                    {recognitionResult.confidence >= confidenceThreshold
                      ? recognitionResult.label
                      : "Low confidence"}
                  </p>
                  {recognitionResult.confidence < confidenceThreshold && (
                    <p className="confidence low-confidence-text">
                      {Math.round(recognitionResult.confidence * 100)}% &mdash; below threshold
                    </p>
                  )}
                  {recognitionResult.confidence >= confidenceThreshold && (
                    <p className="confidence">
                      Confidence: {Math.round(recognitionResult.confidence * 100)}%
                    </p>
                  )}
                  <div className="suggestions">
                    <p className="panel-label">Top suggestions</p>
                    <ul>
                      {recognitionResult.topK.map((suggestion) => (
                        <li key={suggestion.label}>
                          {suggestion.label} ({Math.round(suggestion.confidence * 100)}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="transcript-text">
                  {recognitionState.stage === "loading-model"
                    ? "Loading recognition model..."
                    : recognitionState.stage === "collecting"
                    ? "Collecting landmark sequence..."
                    : "No sign detected"}
                </p>
              )}

              <p className="panel-label" style={{ marginTop: 12 }}>Confidence threshold</p>
              <div className="toggle">
                {CONFIDENCE_THRESHOLDS.map((t) => (
                  <button
                    key={t}
                    className={`toggle-button ${confidenceThreshold === t ? "active" : ""}`}
                    type="button"
                    onClick={() => setConfidenceThreshold(t)}
                  >
                    {Math.round(t * 100)}%
                  </button>
                ))}
              </div>

              <p className="panel-label" style={{ marginTop: 12 }}>Running transcript</p>
              <div className="transcript-display">
                {transcript.length === 0 ? (
                  <span className="transcript-empty">No predictions yet</span>
                ) : (
                  transcript.map((label, i) => (
                    <span key={i} className="transcript-char">{label}</span>
                  ))
                )}
              </div>

              <div className="summary">
                <span>Hands detected: {handCount}</span>
                <span>FPS: {fps}</span>
              </div>
              <div className="capture-actions">
                <button
                  className="button"
                  onClick={handleSpeak}
                  disabled={!recognitionResult}
                >
                  Text-to-Speech
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => { setTranscript([]); lastTranscriptLabelRef.current = ""; }}
                >
                  Clear transcript
                </button>
              </div>
            </section>
          </div>

          <section className="panel panel-secondary camera-side">
            <h2>Developer evaluation panel</h2>
            <div className="eval-metrics">
              <div className="eval-metric">
                <span className="eval-metric-label">Current confidence</span>
                <span className="eval-metric-value">
                  {(sessionMetrics.currentConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="eval-metric">
                <span className="eval-metric-label">Avg confidence</span>
                <span className="eval-metric-value">
                  {(sessionMetrics.avgConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="eval-metric">
                <span className="eval-metric-label">Current FPS</span>
                <span className="eval-metric-value">{sessionMetrics.currentFps}</span>
              </div>
              <div className="eval-metric">
                <span className="eval-metric-label">Avg FPS</span>
                <span className="eval-metric-value">{sessionMetrics.avgFps.toFixed(1)}</span>
              </div>
              <div className="eval-metric">
                <span className="eval-metric-label">Inference time</span>
                <span className="eval-metric-value">
                  {sessionMetrics.currentInferenceTime.toFixed(1)}ms
                </span>
              </div>
              <div className="eval-metric">
                <span className="eval-metric-label">Avg inference time</span>
                <span className="eval-metric-value">
                  {sessionMetrics.avgInferenceTime.toFixed(1)}ms
                </span>
              </div>
              <div className="eval-metric">
                <span className="eval-metric-label">Total predictions</span>
                <span className="eval-metric-value">{sessionMetrics.totalPredictions}</span>
              </div>
            </div>

            <h2 style={{ marginTop: 16 }}>Dataset capture</h2>
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
                disabled={isRecording}
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
        </div>
      </section>
    </main>
  );
}
