"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play,
  Pause,
  StopCircle,
  SkipBack,
  SkipForward,
  Repeat,
  Maximize2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { VideoMetadata, ExtractionResult } from "./types";
import type { AnimationFrame, GestureAnimationAsset } from "@/features/sign-animation/types";

interface SkeletonPreviewTabProps {
  extractionResult: ExtractionResult;
  videoMeta: VideoMetadata | null;
}

type ViewMode = "skeleton" | "video" | "side-by-side";

export function SkeletonPreviewTab({ extractionResult, videoMeta }: SkeletonPreviewTabProps) {
  const { asset } = extractionResult;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("skeleton");
  const [showLabels, setShowLabels] = useState(false);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const loopRef = useRef(true);
  const speedRef = useRef(1);
  const currentFrameRef = useRef(0);

  const totalFrames = asset.frames.length;
  const fps = asset.fps;
  const durationMs = asset.duration;

  const getFrameData = useCallback((index: number): AnimationFrame | null => {
    if (index < 0 || index >= asset.frames.length) return null;
    return asset.frames[index];
  }, [asset.frames]);

  const renderFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = getFrameData(index);
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    if (!frame) {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No frame data", w / 2, h / 2);
      return;
    }

    const padding = 40;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;
    const scaleX = drawW;
    const scaleY = drawH;
    const offsetX = padding;
    const offsetY = padding;

    const sx = (x: number) => offsetX + (x + 0.5) * scaleX;
    const sy = (y: number) => offsetY + (y + 1) * scaleY;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const poseLm = frame.poseLandmarks;
    const faceLm = frame.faceLandmarks;
    const leftHand = frame.landmarks.find((h) => h.side === "left")?.landmarks ?? [];
    const rightHand = frame.landmarks.find((h) => h.side === "right")?.landmarks ?? [];
    const anyHand = frame.landmarks[0]?.landmarks ?? [];

    if (poseLm && poseLm.length >= 33) {
      const p = poseLm;

      const poseBones: [number, number, string][] = [
        [11, 12, "#94a3b8"],
        [11, 13, "#94a3b8"], [13, 15, "#94a3b8"],
        [12, 14, "#94a3b8"], [14, 16, "#94a3b8"],
        [11, 23, "#64748b"], [12, 24, "#64748b"],
        [23, 24, "#64748b"],
        [23, 25, "#475569"], [25, 27, "#475569"],
        [24, 26, "#475569"], [26, 28, "#475569"],
        [27, 29, "#334155"], [29, 31, "#334155"],
        [28, 30, "#334155"], [30, 32, "#334155"],
        [0, 1, "#fbbf24"], [1, 2, "#fbbf24"], [2, 3, "#fbbf24"], [3, 7, "#fbbf24"],
        [0, 4, "#fbbf24"], [4, 5, "#fbbf24"], [5, 6, "#fbbf24"], [6, 8, "#fbbf24"],
        [9, 10, "#fbbf24"],
        [11, 22, "#60a5fa"], [11, 23, "#60a5fa"],
        [12, 24, "#60a5fa"], [12, 22, "#60a5fa"],
      ];

      for (const [i, j, color] of poseBones) {
        if (i < p.length && j < p.length) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx(p[i].x), sy(p[i].y));
          ctx.lineTo(sx(p[j].x), sy(p[j].y));
          ctx.stroke();
        }
      }

      const jointIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
      for (const i of jointIndices) {
        if (i < p.length) {
          ctx.fillStyle = "#cbd5e1";
          ctx.beginPath();
          ctx.arc(sx(p[i].x), sy(p[i].y), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const headIdx = 0;
      if (headIdx < p.length) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const hx = sx(p[headIdx].x);
        const hy = sy(p[headIdx].y);
        ctx.arc(hx, hy, 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(hx - 4, hy - 3, 2, 0, Math.PI * 2);
        ctx.arc(hx + 4, hy - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      const neckIdx = 11;
      const midHip = p[23] && p[24]
        ? { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 }
        : null;

      if (neckIdx < p.length && midHip) {
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx(p[neckIdx].x), sy(p[neckIdx].y));
        ctx.lineTo(sx(midHip.x), sy(midHip.y));
        ctx.stroke();
      }
    } else {
      const cx = w / 2;
      const cy = h / 2;

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 80, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 83, 2, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 83, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 62);
      ctx.lineTo(cx, cy + 40);
      ctx.stroke();

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 50);
      ctx.lineTo(cx - 50, cy - 20);
      ctx.moveTo(cx, cy - 50);
      ctx.lineTo(cx + 50, cy - 20);
      ctx.stroke();

      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 50, cy - 20);
      ctx.lineTo(cx - 60, cy + 30);
      ctx.moveTo(cx + 50, cy - 20);
      ctx.lineTo(cx + 60, cy + 30);
      ctx.stroke();

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 40);
      ctx.lineTo(cx - 40, cy + 140);
      ctx.moveTo(cx, cy + 40);
      ctx.lineTo(cx + 40, cy + 140);
      ctx.stroke();
    }

    if (faceLm && faceLm.length > 0) {
      ctx.fillStyle = "rgba(251,191,36,0.15)";
      for (const pt of faceLm) {
        ctx.beginPath();
        ctx.arc(sx(pt.x), sy(pt.y), 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const drawHand = (landmarks: { x: number; y: number; z: number }[], color: string) => {
      if (landmarks.length < 21) return;

      const handBones: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
      ];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (const [i, j] of handBones) {
        if (i < landmarks.length && j < landmarks.length) {
          ctx.beginPath();
          ctx.moveTo(sx(landmarks[i].x), sy(landmarks[i].y));
          ctx.lineTo(sx(landmarks[j].x), sy(landmarks[j].y));
          ctx.stroke();
        }
      }

      const palmPoints = [0, 1, 5, 9, 13, 17];
      ctx.fillStyle = color;
      for (const i of palmPoints) {
        if (i < landmarks.length) {
          ctx.beginPath();
          ctx.arc(sx(landmarks[i].x), sy(landmarks[i].y), 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const tipPoints = [4, 8, 12, 16, 20];
      ctx.fillStyle = "#fde68a";
      for (const i of tipPoints) {
        if (i < landmarks.length) {
          ctx.beginPath();
          ctx.arc(sx(landmarks[i].x), sy(landmarks[i].y), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (leftHand.length > 0) drawHand(leftHand, "#c0593a");
    if (rightHand.length > 0) drawHand(rightHand, "#60a5fa");

    if (showLabels && poseLm) {
      ctx.font = "9px monospace";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      const labelIndices = [0, 11, 12, 15, 16, 23, 24, 27, 28];
      const labelNames = ["HEAD", "L_SHOULDER", "R_SHOULDER", "L_HAND", "R_HAND", "L_HIP", "R_HIP", "L_KNEE", "R_KNEE"];
      for (let i = 0; i < labelIndices.length; i++) {
        const idx = labelIndices[i];
        if (idx < poseLm.length) {
          ctx.fillText(labelNames[i], sx(poseLm[idx].x), sy(poseLm[idx].y) - 10);
        }
      }
    }

    ctx.fillStyle = "#475569";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Frame ${index + 1}/${totalFrames}`, 10, 20);
  }, [getFrameData, totalFrames, showLabels]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = 420;
      canvasRef.current.height = 520;
    }
  }, []);

  useEffect(() => {
    renderFrame(currentFrame);
  }, [currentFrame, renderFrame, viewMode]);

  useEffect(() => {
    if (videoRef.current && videoMeta) {
      videoRef.current.src = videoMeta.url;
    }
  }, [videoMeta]);

  useEffect(() => {
    if (videoRef.current && videoMeta) {
      const seekTarget = totalFrames > 0 ? (currentFrame / totalFrames) * videoMeta.duration : 0;
      videoRef.current.currentTime = seekTarget;
    }
  }, [currentFrame, totalFrames, videoMeta]);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);

  const playAnimation = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    pausedRef.current = false;
    setPlaying(true);
    setPaused(false);

    const frameInterval = 1000 / fps;
    let frameIndex = currentFrameRef.current;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      lastTime = now;

      if (!pausedRef.current) {
        frameIndex += (elapsed / frameInterval) * speedRef.current;
        if (frameIndex >= totalFrames) {
          if (loopRef.current) {
            frameIndex = frameIndex % totalFrames;
          } else {
            frameIndex = totalFrames - 1;
            setCurrentFrame(frameIndex);
            currentFrameRef.current = frameIndex;
            playingRef.current = false;
            setPlaying(false);
            return;
          }
        }
        const fi = Math.floor(frameIndex);
        currentFrameRef.current = Math.min(fi, totalFrames - 1);
        setCurrentFrame(currentFrameRef.current);
      }

      if (playingRef.current) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, [fps, totalFrames]);

  useEffect(() => {
    if (playing && !paused) {
      playAnimation();
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing, paused, playAnimation]);

  const handlePlay = useCallback(() => {
    if (pausedRef.current) {
      pausedRef.current = false;
      setPaused(false);
    } else {
      playingRef.current = true;
      setPlaying(true);
      setPaused(false);
    }
  }, []);

  const handlePause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const handleStop = useCallback(() => {
    playingRef.current = false;
    pausedRef.current = false;
    setPlaying(false);
    setPaused(false);
    setCurrentFrame(0);
    currentFrameRef.current = 0;
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const handleFrameStep = useCallback((dir: number) => {
    playingRef.current = false;
    pausedRef.current = false;
    setPlaying(false);
    setPaused(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setCurrentFrame((prev) => {
      const next = prev + dir;
      const clamped = next < 0 ? 0 : next >= totalFrames ? totalFrames - 1 : next;
      currentFrameRef.current = clamped;
      return clamped;
    });
  }, [totalFrames]);

  return (
    <div>
      <style>{`
        .preview-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .preview-layout { grid-template-columns: 1fr; }
        }
        .preview-canvas-wrap {
          position: relative;
        }
        .preview-canvas-wrap canvas {
          width: 100%;
          border-radius: 10px;
          background: #0f172a;
          display: block;
        }
        .preview-video-wrap {
          display: ${viewMode === "video" || viewMode === "side-by-side" ? "block" : "none"};
        }
        .preview-video-wrap video {
          width: 100%;
          border-radius: 10px;
          background: #000;
          max-height: 520px;
        }
        .view-toggle {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
          background: #0f172a;
          border-radius: 8px;
          padding: 3px;
          border: 1px solid #1e293b;
          width: fit-content;
        }
        .view-toggle button {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: transparent;
          color: #64748b;
          transition: all 0.15s;
        }
        .view-toggle button.active {
          background: #1e293b;
          color: #e2e8f0;
        }
        .view-toggle button:hover:not(.active) { color: #94a3b8; }
        .controls-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 10px 14px;
          background: #0f172a;
          border-radius: 10px;
          border: 1px solid #1e293b;
          flex-wrap: wrap;
        }
        .controls-bar button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          background: transparent;
          color: #94a3b8;
          transition: all 0.15s;
        }
        .controls-bar button:hover { background: #1e293b; color: #e2e8f0; }
        .controls-bar button.active { color: #60a5fa; background: rgba(96,165,250,0.1); }
        .controls-bar button:disabled { opacity: 0.3; cursor: not-allowed; }
        .controls-bar .frame-slider {
          flex: 1;
          min-width: 100px;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: #1e293b;
          border-radius: 2px;
          outline: none;
        }
        .controls-bar .frame-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #60a5fa;
          cursor: pointer;
        }
        .controls-bar .frame-label {
          font-size: 12px;
          color: #64748b;
          min-width: 60px;
          text-align: center;
        }
        .speed-control {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: 8px;
        }
        .speed-control label {
          font-size: 11px;
          color: #64748b;
        }
        .speed-control select {
          background: #1e293b;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 12px;
        }
      `}</style>

      <div className="view-toggle">
        <button
          className={viewMode === "skeleton" ? "active" : ""}
          onClick={() => setViewMode("skeleton")}
        >
          <EyeOff size={14} /> Skeleton
        </button>
        <button
          className={viewMode === "video" ? "active" : ""}
          onClick={() => setViewMode("video")}
        >
          <Eye size={14} /> Video
        </button>
        <button
          className={viewMode === "side-by-side" ? "active" : ""}
          onClick={() => setViewMode("side-by-side")}
        >
          <Maximize2 size={14} /> Side-by-side
        </button>
      </div>

      <div className="preview-layout">
        <div className="preview-canvas-wrap" style={{ display: viewMode === "video" ? "none" : "block" }}>
          <canvas ref={canvasRef} />
        </div>
        <div className="preview-video-wrap">
          <video ref={videoRef} controls />
        </div>
      </div>

      <div className="controls-bar">
        <button onClick={() => handleFrameStep(-1)} title="Step Back" disabled={playing}>
          <SkipBack size={16} />
        </button>
        <button onClick={handleStop} title="Stop" disabled={!playing && !paused}>
          <StopCircle size={16} />
        </button>
        {!paused && playing ? (
          <button onClick={handlePause} title="Pause">
            <Pause size={16} />
          </button>
        ) : (
          <button onClick={handlePlay} title="Play" disabled={playing && !paused}>
            <Play size={16} />
          </button>
        )}
        <button onClick={() => handleFrameStep(1)} title="Step Forward" disabled={playing}>
          <SkipForward size={16} />
        </button>

        <button
          className={loop ? "active" : ""}
          onClick={() => setLoop((l) => !l)}
          title="Loop"
        >
          <Repeat size={16} />
        </button>

        <input
          type="range"
          className="frame-slider"
          min={0}
          max={totalFrames - 1}
          value={currentFrame}
          onChange={(e) => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
            setPlaying(false);
            setPaused(false);
            setCurrentFrame(Number(e.target.value));
          }}
        />
        <span className="frame-label">
          {currentFrame + 1}/{totalFrames}
        </span>

        <div className="speed-control">
          <label>Speed</label>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
        </div>

        <button
          className={showLabels ? "active" : ""}
          onClick={() => setShowLabels((l) => !l)}
          title="Labels"
        >
          <Eye size={16} />
        </button>
      </div>
    </div>
  );
}
