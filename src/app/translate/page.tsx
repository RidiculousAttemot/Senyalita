"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserSidebar } from "@/components/UserSidebar";
import { useRecognition, translateLabel, MODE_CONFIGS } from "@/features/recognition";
import type { RecognitionMode } from "@/features/recognition";
import { getTts } from "@/lib/tts";
import { lookupGesture, type GestureInfo } from "@/features/gestures";

type Status = "waiting" | "active" | "no-hand" | "error";

export default function TranslatePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>("waiting");
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [translatedText, setTranslatedText] = useState("");
  const [replies, setReplies] = useState<Array<{ text: string; videoUrl: string | null }>>([]);
  const [gestureInfo, setGestureInfo] = useState<GestureInfo | null>(null);
  const [replyVideo, setReplyVideo] = useState<string | null>(null);
  const [showModePicker, setShowModePicker] = useState(false);
  const handsRef = useRef<any>(null);
  const ttsRef = useRef<ReturnType<typeof getTts> | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState("");

  const onPrediction = useCallback(async (result: any, inferenceTimeMs: number) => {
    if (!result?.label) return;
    setCurrentLabel(result.label);
    setCurrentConfidence(result.confidence);

    setTranslatedText(translateLabel(result.label));

    const gesture = await lookupGesture(result.label);
    setGestureInfo(gesture);

    if (gesture?.replies?.length) {
      setReplies(gesture.replies.map((r: any) => ({
        text: r.reply_text,
        videoUrl: r.response_video_url ?? null,
      })));
    } else {
      setReplies([]);
    }
  }, []);

  const recognition = useRecognition(onPrediction);

  const currentMode = recognition.mode ?? "auto";
  const modeConfig = MODE_CONFIGS[currentMode];

  useEffect(() => {
    ttsRef.current = getTts();
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("active");

        const { Hands } = await import("@mediapipe/hands");
        const hands = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.6,
        });
        hands.onResults((results: any) => {
          if (results.multiHandLandmarks?.length > 0) {
            const left = results.multiHandedness?.find((h: any) => h.label === "Left")
              ? { landmarks: results.multiHandLandmarks[results.multiHandedness.findIndex((h: any) => h.label === "Left")] }
              : null;
            const right = results.multiHandedness?.find((h: any) => h.label === "Right")
              ? { landmarks: results.multiHandLandmarks[results.multiHandedness.findIndex((h: any) => h.label === "Right")] }
              : results.multiHandLandmarks?.length > 0
                ? { landmarks: results.multiHandLandmarks[0] }
                : null;
            recognition.appendFrame(left, right);
            setStatus("active");
          } else {
            setStatus("no-hand");
          }
        });
        handsRef.current = hands;

        const processFrame = async () => {
          if (videoRef.current && canvasRef.current && handsRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              ctx.drawImage(videoRef.current, 0, 0);
              await handsRef.current.send({ image: canvasRef.current });
            }
          }
          requestAnimationFrame(processFrame);
        };
        processFrame();
      } catch {
        setStatus("error");
      }
    };
    startCamera();
    return () => {
      (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
      handsRef.current?.close();
    };
  }, [recognition]);

  const speakReply = (text: string) => {
    ttsRef.current?.speak(text);
  };

  const currentTopK = recognition.state.stage === "predicting" ? recognition.state.result?.topK : undefined;

  const correctionOptions = useMemo(() => {
    if (currentTopK && currentTopK.length > 0) {
      return currentTopK.map((t: any) => t.label);
    }
    return ["HELLO", "THANK YOU", "GOOD MORNING", "HOW ARE YOU", "YES", "NO", "PLEASE", "SORRY"];
  }, [currentTopK]);

  const submitCorrection = async (correctedLabel: string) => {
    try {
      await fetch("/api/predictions/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predicted_label: currentLabel,
          corrected_label: correctedLabel,
          confidence: currentConfidence,
          source: "unknown",
        }),
      });
      setCorrectionMessage("Thanks for the feedback!");
      setShowCorrection(false);
      setTimeout(() => setCorrectionMessage(""), 3000);
    } catch {
      setCorrectionMessage("Failed to submit. Try again.");
    }
  };

  return (
    <UserSidebar>
      <div className="translate">
        {/* Mode Selector */}
        <div className="translate-header">
          <h1 className="translate-title">Translate</h1>
          <div className="translate-mode-selector">
            <button
              className="translate-mode-button"
              onClick={() => setShowModePicker(!showModePicker)}
              title={modeConfig.description}
            >
              {modeConfig.label}
            </button>
            {showModePicker && (
              <div className="translate-mode-dropdown">
                {(Object.entries(MODE_CONFIGS) as [RecognitionMode, typeof modeConfig][]).map(
                  ([modeKey, cfg]) => (
                    <button
                      key={modeKey}
                      className={`translate-mode-option ${currentMode === modeKey ? "active" : ""} ${cfg.recommended ? "recommended" : ""}`}
                      onClick={() => {
                        recognition.setMode(modeKey);
                        setShowModePicker(false);
                      }}
                    >
                      <span className="translate-mode-option-label">{cfg.label}</span>
                      <span className="translate-mode-option-desc">{cfg.description}</span>
                      {cfg.recommended && <span className="translate-mode-badge">Recommended</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="translate-layout">
          {/* Left: Camera */}
          <div className="translate-camera-wrap">
            <div className="camera-shell" style={{ position: "relative" }}>
              <video ref={videoRef} className="video video-flip" playsInline muted />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {status === "waiting" && (
                <div className="overlay"><p>Starting camera...</p></div>
              )}
              {status === "no-hand" && (
                <div className="overlay"><p>No hands detected. Position your hands in frame.</p></div>
              )}
              {status === "error" && (
                <div className="overlay"><p>Camera access denied. Please grant camera permission.</p></div>
              )}
            </div>
          </div>

          {/* Center: Translation */}
          <div className="translate-result">
            {currentLabel ? (
              <>
                <div className="translate-detected">
                  <p className="translate-detected-label">Detected Sign</p>
                  <h2 className="translate-detected-sign">{currentLabel}</h2>
                  <div className="translate-confidence-bar">
                    <div
                      className="translate-confidence-fill"
                      style={{ width: `${currentConfidence * 100}%` }}
                    />
                  </div>
                  <p className="translate-confidence-text">
                    Confidence: {(currentConfidence * 100).toFixed(0)}%
                  </p>
                  <p className="translate-translated-text">
                    &ldquo;{translatedText}&rdquo;
                  </p>
                </div>
                <div style={{ marginTop: 8 }}>
                  {!showCorrection ? (
                    <button
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={() => setShowCorrection(true)}
                    >
                      Incorrect?
                    </button>
                  ) : (
                    <div style={{ fontSize: 12 }}>
                      <p style={{ color: "#888", marginBottom: 4 }}>What did you mean?</p>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {correctionOptions.map((label) => (
                          <button
                            key={label}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 12,
                              border: "1px solid #444",
                              background: "transparent",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                            onClick={() => submitCorrection(label)}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            border: "1px solid #ef4444",
                            background: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          onClick={() => setShowCorrection(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {correctionMessage && (
                    <p style={{ fontSize: 11, color: "#22c55e", marginTop: 4 }}>{correctionMessage}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="translate-detected translate-detected-empty">
                <p className="translate-detected-label">Waiting for gesture...</p>
                <p className="translate-hint">Perform an FSL gesture to see translation</p>
              </div>
            )}
          </div>

          {/* Right: Suggested Responses */}
          <div className="translate-replies">
            <h3 className="translate-replies-title">Suggested Responses</h3>
            {replies.length > 0 ? (
              <div className="translate-replies-list">
                {replies.map((r, i) => (
                  <div key={i} className="translate-reply-chip">
                    <button
                      className="translate-reply-button"
                      onClick={() => speakReply(r.text)}
                    >
                      {r.text}
                    </button>
                    {r.videoUrl && (
                      <button
                        className="translate-reply-video-btn"
                        onClick={() => setReplyVideo(r.videoUrl)}
                        aria-label="Play response video"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="translate-replies-empty">
                {currentLabel ? "No responses available" : "Responses appear here"}
              </p>
            )}
          </div>
        </div>

        {/* Reply Video Modal */}
        {replyVideo && (
          <div
            className="reply-video-overlay"
            onClick={() => setReplyVideo(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="reply-video-modal" onClick={(e) => e.stopPropagation()}>
              <video className="reply-video-player" src={replyVideo} controls autoPlay playsInline />
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setReplyVideo(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </UserSidebar>
  );
}
