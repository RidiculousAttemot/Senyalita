"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRecognition } from "@/features/recognition";
import { getTts } from "@/lib/tts";
import { AdvancedCanvasRenderer } from "@/features/sign-animation/renderer/AdvancedCanvasRenderer";
import { AnimationLoader } from "@/features/sign-animation/loader";
import { PlaybackEngine } from "@/features/sign-animation/player/PlaybackEngine";
import type { AnimationClip, AvatarTheme } from "@/features/sign-animation/types";
import { AVATAR_THEMES, globalThemeManager } from "@/features/sign-animation";

export default function PresentationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState("initializing");
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [langTagalog, setLangTagalog] = useState(false);
  const [mode, setMode] = useState<"live" | "avatar">("live");
  const [theme, setTheme] = useState<AvatarTheme>("minimal");
  const [fullscreen, setFullscreen] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [avatarSpeed, setAvatarSpeed] = useState(1);
  const [avatarPlaying, setAvatarPlaying] = useState(false);
  const [subtitleText, setSubtitleText] = useState("");
  const [highContrast, setHighContrast] = useState(false);
  const [avatarSize, setAvatarSize] = useState(0.7);
  const avatarW = Math.round(320 * (0.5 + avatarSize));
  const avatarH = Math.round(400 * (0.5 + avatarSize));
  const lastSpokenRef = useRef("");
  const engineRef = useRef<PlaybackEngine | null>(null);
  const rendererRef = useRef<AdvancedCanvasRenderer | null>(null);
  const loaderRef = useRef(new AnimationLoader());

  // Initialize renderer and engine once (re-create on theme/size/contrast change)
  useEffect(() => {
    if (mode !== "avatar" || !avatarCanvasRef.current) return;
    rendererRef.current?.dispose();
    engineRef.current?.dispose();

    const canvas = avatarCanvasRef.current;
    const renderer = new AdvancedCanvasRenderer(canvas, {
      width: canvas.width,
      height: canvas.height,
      theme,
      showLabels: false,
      showNonManual: true,
      backgroundColor: highContrast ? "#000" : "#0f172a",
    });
    rendererRef.current = renderer;

    const engine = new PlaybackEngine();
    engineRef.current = engine;
  }, [mode, theme, avatarW, avatarH, highContrast]);

  const playGestureAnimation = useCallback(async (label: string) => {
    const loader = loaderRef.current;
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (!engine || !renderer) return;

    const asset = await loader.load(label);
    if (!asset) return;

    setSubtitleText(label.replace(/_/g, " "));
    setAvatarPlaying(true);

    const clip: AnimationClip = { id: `pres-${label}`, gesture: label, asset };
    engine.setCallbacks({
      onFrame: (frame) => renderer.render(frame),
      onQueueComplete: () => {
        setAvatarPlaying(false);
        setSubtitleText("");
      },
    });
    engine.loadSequence([clip]);
    engine.setSpeed(avatarSpeed);
  }, [avatarSpeed]);

  const playGestureRef = useRef(playGestureAnimation);
  playGestureRef.current = playGestureAnimation;

  const onPrediction = useCallback((result: any) => {
    const label = result.label;
    const confidence = result.confidence;
    setCurrentGesture(label);
    setCurrentConfidence(confidence);
    if (mode === "avatar" && label && confidence >= 0.6) {
      playGestureRef.current(label);
    }
  }, [mode]);

  const { appendFrame } = useRecognition(onPrediction);

  useEffect(() => {
    if (!ttsEnabled || !currentGesture || currentConfidence < 0.7) return;
    if (currentGesture === lastSpokenRef.current) return;
    lastSpokenRef.current = currentGesture;
    getTts().speak(currentGesture.replace(/_/g, " "), {
      lang: langTagalog ? "fil-PH" : "en-US",
      rate: 0.9,
    });
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
          maxNumHands: 2, modelComplexity: 1,
          minDetectionConfidence: 0.6, minTrackingConfidence: 0.6,
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

          // Always send landmarks to recognition pipeline regardless of mode
          if (landmarksList.length > 0) {
            // Determine handedness
            let leftLandmarks: any = null;
            let rightLandmarks: any = null;
            for (let i = 0; i < landmarksList.length; i++) {
              const handedness = handednessList[i]?.label ?? "";
              const landmarks = landmarksList[i].map((p: any) => ({ x: p.x, y: p.y, z: p.z }));
              if (handedness.toLowerCase().includes("left")) {
                leftLandmarks = { landmarks };
              } else {
                rightLandmarks = { landmarks };
              }
              // Draw landmarks in live mode only
              if (mode === "live") {
                drawingUtils.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#22c55e", lineWidth: 3 });
                drawingUtils.drawLandmarks(ctx, landmarks, { color: "#ef4444", lineWidth: 2 });
              }
            }
            appendFrame(leftLandmarks, rightLandmarks);
          }
          ctx.restore();
        });

        camera = new cameraUtils.Camera(video, {
          onFrame: async () => {
            const currentVideo = videoRef.current;
            if (!hands || !currentVideo || isProcessingRef.current) return;
            isProcessingRef.current = true;
            try { await hands.send({ image: currentVideo }); } finally { isProcessingRef.current = false; }
          },
          width: 640, height: 480,
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

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleReplay = useCallback(() => {
    if (currentGesture) playGestureAnimation(currentGesture);
  }, [currentGesture, playGestureAnimation]);

  return (
    <main ref={containerRef} style={{
      height: "100vh", background: highContrast ? "#000" : "#0a0a1a",
      display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
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
          flex-wrap: wrap;
          justify-content: center;
        }
      `}</style>

      {mode === "live" && (
        <div style={{
          position: "fixed", bottom: 80, right: 24,
          width: 160, height: 120, borderRadius: 12,
          overflow: "hidden", border: "2px solid rgba(255,255,255,0.1)", zIndex: 50,
        }}>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} playsInline muted />
          <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }} />
        </div>
      )}

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 48,
      }}>
        {mode === "live" ? (
          <>
            {status !== "ready" ? (
              <p style={{ fontSize: 24, color: "#888" }}>
                {status === "error" ? "Camera error" : "Starting camera..."}
              </p>
            ) : (
              <>
                {currentGesture && currentConfidence >= 0.5 ? (
                  <div style={{ textAlign: "center" }}>
                    <p className="presentation-text" style={{
                      fontSize: "clamp(48px, 10vw, 120px)", fontWeight: 700,
                      color: currentConfidence >= 0.7 ? "#22c55e" : "#eab308",
                      margin: 0, lineHeight: 1.2, letterSpacing: "0.02em",
                    }}>
                      {currentGesture.replace(/_/g, " ")}
                    </p>
                    <p style={{ fontSize: "clamp(16px, 3vw, 36px)", color: "#888", marginTop: 16, animation: "fadeIn 0.3s ease-out" }}>
                      {(currentConfidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: "clamp(24px, 5vw, 48px)", color: "#555", textAlign: "center" }}>
                    {langTagalog ? "Mag-sign upang magsimula" : "Sign to begin"}
                  </p>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <canvas
              ref={avatarCanvasRef}
              width={avatarW}
              height={avatarH}
              style={{
                borderRadius: 16, maxWidth: "90vw", maxHeight: "70vh",
                boxShadow: avatarPlaying ? "0 0 40px rgba(96, 165, 250, 0.3)" : "none",
                transition: "box-shadow 0.3s",
              }}
            />
            {showSubtitles && subtitleText && (
              <p style={{
                fontSize: "clamp(24px, 4vw, 48px)", fontWeight: 600,
                color: highContrast ? "#fff" : "#e2e8f0",
                textAlign: "center", textShadow: highContrast ? "0 0 10px rgba(0,0,0,0.8)" : "none",
                animation: "fadeIn 0.3s ease-out", maxWidth: "80vw",
              }}>
                {subtitleText}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="presentation-controls">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "live" | "avatar")}
          style={{ padding: "6px 10px", fontSize: 12, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6 }}
        >
          <option value="live">Live Recognition</option>
          <option value="avatar">Avatar Mode</option>
        </select>

        {mode === "avatar" && (
          <>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as AvatarTheme)}
              style={{ padding: "6px 10px", fontSize: 12, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6 }}
            >
              {AVATAR_THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button onClick={handleReplay} disabled={!currentGesture} className="button button-secondary" style={{ fontSize: 12, padding: "6px 12px" }}>
              ↺ Replay
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 11 }}>
              Speed:
              <input type="range" min={0.25} max={3} step={0.25} value={avatarSpeed}
                onChange={(e) => setAvatarSpeed(parseFloat(e.target.value))}
                style={{ width: 60 }} />
              <span>{avatarSpeed.toFixed(2)}x</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 11 }}>
              Size:
              <input type="range" min={0.3} max={1.5} step={0.1} value={avatarSize}
                onChange={(e) => setAvatarSize(parseFloat(e.target.value))}
                style={{ width: 60 }} />
            </label>
          </>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
          TTS
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={langTagalog} onChange={(e) => setLangTagalog(e.target.checked)} />
          Tagalog
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={showSubtitles} onChange={(e) => setShowSubtitles(e.target.checked)} />
          Subtitles
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={highContrast} onChange={(e) => { setHighContrast(e.target.checked); }} />
          High Contrast
        </label>
        <button onClick={toggleFullscreen} className="button button-secondary" style={{ fontSize: 12, padding: "6px 12px" }}>
          {fullscreen ? "✕ Exit Fullscreen" : "⛶ Fullscreen"}
        </button>
      </div>
    </main>
  );
}
