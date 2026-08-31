"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle, XCircle, ArrowUpRight, Download, Activity } from "lucide-react";
import { useRecognition } from "@/features/recognition";
import { HAND_CAPTURE_CONSTRAINTS, handLandmarkerOptionsFor } from "@/features/sign-to-text/handCaptureProfile";
import {
  CAPTURE_INTERVAL_MS,
  HAND_CONNECTIONS,
  createHandLandmarker,
} from "@/features/sign-to-text/handLandmarkerConfig";
import { SurfaceCard, SectionHeader } from "@/components/ui/surfaces";

type EvalResult = {
  gesture: string;
  predicted: string;
  confidence: number;
  correct: boolean | null;
  timestamp: string;
};

/**
 * The full alphabet, and nothing else.
 *
 * The battery previously carried 15 phrases (Thank You, Good Morning, Hello,
 * Water, Rice, Monday …) alongside A–E. The recognition path is alphabet-only,
 * so those phrases were being scored against a model that cannot predict them:
 * every one would count as a miss and drag the reported accuracy down for a
 * capability the system does not claim. A harness that scores gestures the
 * system cannot recognise produces a number that is not defensible.
 *
 * A–Z is exactly the label set the model exposes, so the accuracy this page
 * reports is now the accuracy of the thing being measured.
 */
const TEST_GESTURES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((label) => ({ label }));

export default function EvaluationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState("initializing");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);

  const onPrediction = useCallback(
    (result: any) => {
      setCurrentPrediction(result.label);
      setCurrentConfidence(result.confidence);
    },
    []
  );

  const { state: recognitionState, appendFrame } = useRecognition(onPrediction);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let landmarker: Awaited<ReturnType<typeof createHandLandmarker>> | null = null;
    let rafId = 0;
    let cancelled = false;

    const setup = async () => {
      try {
        // Same constraints, landmarker options, model build and capture rate as
        // the live path in SignToTextInterface. A harness that captures
        // differently from production reports an accuracy production never has.
        stream = await navigator.mediaDevices.getUserMedia(HAND_CAPTURE_CONSTRAINTS);
        if (cancelled) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        landmarker = await createHandLandmarker(handLandmarkerOptionsFor("balanced"));
        if (cancelled) {
          landmarker.close();
          return;
        }

        let lastVideoTime = -1;
        let lastAppendTime = -Infinity;

        const tick = () => {
          if (cancelled) return;
          rafId = requestAnimationFrame(tick);

          const videoEl = videoRef.current;
          if (!landmarker || !videoEl || videoEl.paused || videoEl.ended) return;
          // detectForVideo rejects a repeated timestamp, so only run on a new frame.
          if (videoEl.currentTime === lastVideoTime) return;
          lastVideoTime = videoEl.currentTime;

          const now = performance.now();
          const results = landmarker.detectForVideo(videoEl, now);

          const leftIndex = results.handedness.findIndex(
            (h) => h[0]?.categoryName?.toLowerCase() === "left",
          );
          const rightIndex = results.handedness.findIndex(
            (h) => h[0]?.categoryName?.toLowerCase() === "right",
          );

          // Throttled to the training extraction rate. Feeding every camera
          // frame would pack a 60fps stream into the model's window and halve
          // the real duration each sequence represents.
          if (results.landmarks.length > 0 && now - lastAppendTime >= CAPTURE_INTERVAL_MS) {
            lastAppendTime = now;
            appendFrame(
              leftIndex >= 0 ? { landmarks: results.landmarks[leftIndex] } : null,
              rightIndex >= 0 ? { landmarks: results.landmarks[rightIndex] } : null,
            );
          }

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          const width = videoEl.videoWidth;
          const height = videoEl.videoHeight;
          if (!canvas || !ctx || !width || !height) return;

          if (
            !lastSizeRef.current
            || lastSizeRef.current.width !== width
            || lastSizeRef.current.height !== height
          ) {
            canvas.width = width;
            canvas.height = height;
            lastSizeRef.current = { width, height };
          }

          ctx.clearRect(0, 0, width, height);
          for (const hand of results.landmarks) {
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (const [start, end] of HAND_CONNECTIONS) {
              ctx.beginPath();
              ctx.moveTo(hand[start].x * width, hand[start].y * height);
              ctx.lineTo(hand[end].x * width, hand[end].y * height);
              ctx.stroke();
            }
            ctx.fillStyle = "#ef4444";
            for (const point of hand) {
              ctx.beginPath();
              ctx.arc(point.x * width, point.y * height, 3.5, 0, 2 * Math.PI);
              ctx.fill();
            }
          }
        };

        rafId = requestAnimationFrame(tick);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };

    setup();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      landmarker?.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [appendFrame]);

  const recordResult = (correct: boolean) => {
    const gesture = TEST_GESTURES[currentIndex];
    const result: EvalResult = {
      gesture: gesture.label,
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

  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-senyalita-warm">
      {pathname !== "/admin" && !pathname?.startsWith("/admin/") && (
        <header className="sticky top-0 z-50 w-full border-b border-senyalita-border/70 bg-senyalita-warm/85 px-4 py-3 backdrop-blur-xl md:px-8 md:py-3.5">
          <div className="mx-auto flex w-full max-w-[1160px] items-center justify-between gap-3">
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-senyalita-border bg-white text-senyalita-muted transition-all duration-150 group-hover:-translate-x-0.5 group-hover:border-senyalita-primary/40 group-hover:text-senyalita-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span className="sr-only">Back to home</span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-senyalita-primary shadow-lg shadow-senyalita-primary/25">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"/>
                  <circle cx="12" cy="13" r="4" fill="transparent" stroke="white" strokeWidth="2"/>
                </svg>
              </span>
              <span className="font-display text-xl font-bold leading-none tracking-tight text-senyalita-dark">Senyalita</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/translate"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-senyalita-primary px-5 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all duration-150 hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
              >
                Open translator
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </header>
      )}

      <main id="main-content" className="mx-auto max-w-[1160px] px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-8">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-senyalita-primary">
            Evaluation
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-senyalita-dark sm:text-4xl">
            Gesture Recognition Accuracy
          </h1>
          <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-senyalita-muted">
            Test the camera&apos;s ability to recognize each letter of the alphabet. Results are saved locally and can be exported.
          </p>
        </header>

        <SurfaceCard tone="light" className="mb-8 p-5 sm:p-6" data-testid="section-evaluation">
          <SectionHeader tone="light" icon={<Activity className="h-4 w-4" />}>
            Live Camera Test
          </SectionHeader>

          <section className="camera-shell">
            <div className="camera-header">
              <h2>Camera Feed</h2>
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
                        <Download className="h-4 w-4 mr-2 inline" /> Export Results
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

                      <div style={{ marginTop: 16, padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
                        <p className="panel-label">Recognition Result</p>
                        <p className="transcript-text" style={{ fontSize: 20 }}>
                          {recognitionState.stage === "loading-model"
                            ? "Loading model..."
                            : currentPrediction ?? "No sign detected"}
                        </p>
                        <p className="confidence">
                          Confidence: {currentConfidence > 0 ? `${(currentConfidence * 100).toFixed(1)}%` : "—"}
                        </p>
                      </div>

                      <div className="feedback-buttons" style={{ marginTop: 16 }}>
                        <button
                          className="button"
                          type="button"
                          onClick={() => recordResult(true)}
                          disabled={!currentPrediction}
                        >
                          <CheckCircle className="h-4 w-4 mr-2 inline" /> Correct
                        </button>
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => recordResult(false)}
                          disabled={!currentPrediction}
                        >
                          <XCircle className="h-4 w-4 mr-2 inline" /> Incorrect
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
                                <td>
                                  {r.correct === true ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : r.correct === false ? (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  ) : (
                                    "—"
                                  )}
                                </td>
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
        </SurfaceCard>

        <section className="mt-8 flex flex-col items-center gap-5 rounded-3xl border border-senyalita-border bg-white px-6 py-10 text-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-senyalita-dark">
              Try the Translator
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-senyalita-muted">
              Sign to the camera and read it back as text, or type a message and watch it signed.
            </p>
          </div>
          <Link
            href="/translate"
            data-testid="eval-try-cta"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-senyalita-primary px-7 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all duration-150 hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
          >
            Open the translator
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </section>
      </main>
    </div>
  );
}
