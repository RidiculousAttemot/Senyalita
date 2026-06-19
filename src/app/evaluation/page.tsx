"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRecognition, type RecognitionCategory } from "@/features/recognition";

type EvalResult = {
  gesture: string;
  category: "alphabet" | "phrase";
  predicted: string;
  confidence: number;
  correct: boolean | null;
  timestamp: string;
};

const TEST_GESTURES = [
  { label: "A", category: "alphabet" as const },
  { label: "B", category: "alphabet" as const },
  { label: "C", category: "alphabet" as const },
  { label: "D", category: "alphabet" as const },
  { label: "E", category: "alphabet" as const },
  { label: "Thank You", category: "phrase" as const },
  { label: "Good Morning", category: "phrase" as const },
  { label: "Hello", category: "phrase" as const },
  { label: "How Are You", category: "phrase" as const },
  { label: "Yes", category: "phrase" as const },
  { label: "No", category: "phrase" as const },
  { label: "One", category: "phrase" as const },
  { label: "Father", category: "phrase" as const },
  { label: "Mother", category: "phrase" as const },
  { label: "Blue", category: "phrase" as const },
  { label: "Water", category: "phrase" as const },
  { label: "Rice", category: "phrase" as const },
  { label: "Coffee", category: "phrase" as const },
  { label: "Today", category: "phrase" as const },
  { label: "Monday", category: "phrase" as const },
];

export default function EvaluationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState("initializing");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [currentCategory, setCurrentCategory] = useState<RecognitionCategory | null>(null);

  const onPrediction = useCallback(
    (result: any) => {
      setCurrentPrediction(result.label);
      setCurrentConfidence(result.confidence);
      setCurrentCategory((result as any).category ?? null);
    },
    []
  );

  const { state: recognitionState, appendFrame } = useRecognition(onPrediction);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let hands: any = null;
    let camera: any = null;
    let cancelled = false;

    const setup = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const [{ Hands, HAND_CONNECTIONS }, drawingUtils, cameraUtils] = await Promise.all([
          import("@mediapipe/hands"),
          import("@mediapipe/drawing_utils"),
          import("@mediapipe/camera_utils"),
        ]);

        hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results: any) => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          const videoEl = videoRef.current;
          if (!canvas || !ctx || !videoEl) return;

          const width = videoEl.videoWidth;
          const height = videoEl.videoHeight;
          if (!width || !height) return;

          if (!lastSizeRef.current || lastSizeRef.current.width !== width || lastSizeRef.current.height !== height) {
            canvas.width = width;
            canvas.height = height;
            lastSizeRef.current = { width, height };
          }

          ctx.save();
          ctx.clearRect(0, 0, width, height);
          const landmarksList = results.multiHandLandmarks ?? [];
          const handednessList = results.multiHandedness ?? [];

          let leftHand: any = null;
          let rightHand: any = null;

          for (let i = 0; i < landmarksList.length; i++) {
            const handedness = handednessList[i]?.label ?? "";
            const landmarks = landmarksList[i].map((p: any) => ({ x: p.x, y: p.y, z: p.z }));
            const hand = { landmarks };

            if (handedness.toLowerCase().includes("left")) {
              leftHand = hand;
            } else {
              rightHand = hand;
            }

            drawingUtils.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
              color: "#22c55e",
              lineWidth: 3,
            });
            drawingUtils.drawLandmarks(ctx, landmarks, { color: "#ef4444", lineWidth: 2 });
          }

          if (landmarksList.length > 0) {
            appendFrame(leftHand, rightHand);
          }

          ctx.restore();
        });

        camera = new cameraUtils.Camera(video, {
          onFrame: async () => {
            const currentVideo = videoRef.current;
            if (!hands || !currentVideo || isProcessingRef.current) return;
            isProcessingRef.current = true;
            try {
              await hands.send({ image: currentVideo });
            } finally {
              isProcessingRef.current = false;
            }
          },
          width: 640,
          height: 480,
        });
        camera?.start?.();
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };

    setup();
    return () => {
      cancelled = true;
      isProcessingRef.current = false;
      camera?.stop?.();
      hands?.close?.();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [appendFrame]);

  const recordResult = (correct: boolean) => {
    const gesture = TEST_GESTURES[currentIndex];
    const result: EvalResult = {
      gesture: gesture.label,
      category: gesture.category,
      predicted: currentPrediction ?? "—",
      confidence: currentConfidence,
      correct,
      timestamp: new Date().toISOString(),
    };
    const updated = [...results, result];
    setResults(updated);
    localStorage.setItem("evaluation-results", JSON.stringify(updated));
    setCurrentIndex((i) => Math.min(i + 1, TEST_GESTURES.length - 1));
  };

  const exportResults = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = results.length;
  const correct = results.filter((r) => r.correct === true).length;
  const incorrect = results.filter((r) => r.correct === false).length;
  const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : "—";

  const current = TEST_GESTURES[currentIndex];
  const isDone = results.length >= TEST_GESTURES.length;

  return (
    <main className="page">
      <section className="camera-shell">
        <div className="camera-header">
          <h1>Gesture Evaluation</h1>
          <span className={`status status-${status === "ready" ? "hand-2" : "waiting"}`}>
            {status === "ready" ? "Camera active" : status}
          </span>
        </div>

        <div className="camera-layout">
          <div className="camera-main">
            <div className="video-wrap">
              <video ref={videoRef} className="video" playsInline muted />
              <canvas ref={canvasRef} className="overlay" />
            </div>

            <section className="panel" style={{ marginTop: 16 }}>
              <h2>Test Progress</h2>
              <p className="panel-note">
                Gesture {currentIndex + 1} of {TEST_GESTURES.length}
              </p>

              {isDone ? (
                <div style={{ marginTop: 16 }}>
                  <p className="panel-label">Evaluation Complete</p>
                  <p className="transcript-text" style={{ fontSize: 24 }}>
                    Accuracy: {accuracy}%
                  </p>
                  <div className="summary" style={{ marginTop: 8 }}>
                    <span>Total: {total}</span>
                    <span>Correct: {correct}</span>
                    <span>Incorrect: {incorrect}</span>
                  </div>
                  <button className="button" type="button" onClick={exportResults} style={{ marginTop: 16 }}>
                    Export Results
                  </button>
                </div>
              ) : (
                <>
                  <p className="panel-label" style={{ marginTop: 16 }}>
                    Perform this gesture:
                  </p>
                  <p className="transcript-text predicted-sign" style={{ fontSize: 28 }}>
                    {current.label}
                  </p>
                  <p className="panel-note">
                    Type: {current.category}
                  </p>

                  <div style={{ marginTop: 16, padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
                    <p className="panel-label">Recognition Result</p>
                    <p className="transcript-text" style={{ fontSize: 20 }}>
                      {recognitionState.stage === "loading-model"
                        ? "Loading model..."
                        : currentPrediction ?? "No sign detected"}
                    </p>
                    <p className="confidence">
                      Confidence: {currentConfidence > 0 ? `${(currentConfidence * 100).toFixed(1)}%` : "—"}
                      {currentCategory && ` | ${currentCategory}`}
                    </p>
                  </div>

                  <div className="feedback-buttons" style={{ marginTop: 16 }}>
                    <button
                      className="button"
                      type="button"
                      onClick={() => recordResult(true)}
                      disabled={!currentPrediction}
                    >
                      Correct
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => recordResult(false)}
                      disabled={!currentPrediction}
                    >
                      Incorrect
                    </button>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <p className="panel-label">Session Log</p>
                    <table className="admin-table" style={{ width: "100%", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Gesture</th>
                          <th>Predicted</th>
                          <th>Conf.</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{r.gesture}</td>
                            <td>{r.predicted}</td>
                            <td>{(r.confidence * 100).toFixed(0)}%</td>
                            <td>{r.correct === true ? "✅" : r.correct === false ? "❌" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <p className="panel-note">
                      Resets on page reload. Results saved to localStorage. Use Export to download.
                    </p>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
