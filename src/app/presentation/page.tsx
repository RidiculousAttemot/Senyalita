"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRecognition } from "@/features/recognition";
import { getTts } from "@/lib/tts";

export default function PresentationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState("initializing");
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [langTagalog, setLangTagalog] = useState(false);
  const lastSpokenRef = useRef("");

  const onPrediction = useCallback((result: any) => {
    const label = result.label;
    const confidence = result.confidence;
    setCurrentGesture(label);
    setCurrentConfidence(confidence);
  }, []);

  const { appendFrame } = useRecognition(onPrediction);

  useEffect(() => {
    if (!ttsEnabled || !currentGesture || currentConfidence < 0.7) return;
    if (currentGesture === lastSpokenRef.current) return;
    lastSpokenRef.current = currentGesture;
    getTts().speak(currentGesture.replace(/_/g, " "), { lang: langTagalog ? "fil-PH" : "en-US", rate: 0.9 });
  }, [currentGesture, currentConfidence, ttsEnabled, langTagalog]);

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
            if (handedness.toLowerCase().includes("left")) leftHand = { landmarks };
            else rightHand = { landmarks };
            drawingUtils.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#22c55e", lineWidth: 3 });
            drawingUtils.drawLandmarks(ctx, landmarks, { color: "#ef4444", lineWidth: 2 });
          }
          if (landmarksList.length > 0) appendFrame(leftHand, rightHand);
          ctx.restore();
        });

        camera = new cameraUtils.Camera(video, {
          onFrame: async () => {
            const currentVideo = videoRef.current;
            if (!hands || !currentVideo || isProcessingRef.current) return;
            isProcessingRef.current = true;
            try { await hands.send({ image: currentVideo }); } finally { isProcessingRef.current = false; }
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

  return (
    <main style={{
      height: "100vh",
      background: "#0a0a1a",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.6); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .presentation-text {
          animation: fadeIn 0.3s ease-out;
          text-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
        }
        .presentation-controls {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 12px;
          padding: 12px 20px;
          background: rgba(0,0,0,0.7);
          border-radius: 16px;
          backdrop-filter: blur(8px);
          z-index: 100;
          align-items: center;
        }
      `}</style>

      {/* Camera preview - small PIP */}
      <div style={{
        position: "fixed",
        bottom: 80,
        right: 24,
        width: 160,
        height: 120,
        borderRadius: 12,
        overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.1)",
        zIndex: 50,
      }}>
        <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} playsInline muted />
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }} />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
      }}>
        {status !== "ready" ? (
          <p style={{ fontSize: 24, color: "#888" }}>
            {status === "error" ? "Camera error" : "Starting camera..."}
          </p>
        ) : (
          <>
            {currentGesture && currentConfidence >= 0.5 ? (
              <div style={{ textAlign: "center" }}>
                <p className="presentation-text" style={{
                  fontSize: "clamp(48px, 10vw, 120px)",
                  fontWeight: 700,
                  color: currentConfidence >= 0.7 ? "#22c55e" : "#eab308",
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: "0.02em",
                }}>
                  {currentGesture.replace(/_/g, " ")}
                </p>
                <p style={{
                  fontSize: "clamp(16px, 3vw, 36px)",
                  color: "#888",
                  marginTop: 16,
                  animation: "fadeIn 0.3s ease-out",
                }}>
                  {(currentConfidence * 100).toFixed(0)}% confidence
                </p>
              </div>
            ) : (
              <p style={{
                fontSize: "clamp(24px, 5vw, 48px)",
                color: "#555",
                textAlign: "center",
              }}>
                {langTagalog ? "Mag-sign upang magsimula" : "Sign to begin"}
              </p>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="presentation-controls">
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
          TTS
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={langTagalog} onChange={(e) => setLangTagalog(e.target.checked)} />
          Tagalog
        </label>
        <div style={{ color: "#555", fontSize: 12, borderLeft: "1px solid #333", paddingLeft: 12 }}>
          {langTagalog ? "Presetasyon" : "Presentation Mode"}
        </div>
      </div>
    </main>
  );
}
