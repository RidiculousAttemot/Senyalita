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
import { drawFullPose, drawStylizedFace, drawFullHand } from "@/features/sign-animation/renderer/renderUtils";
import { useObjectUrl } from "./useObjectUrl";

interface SkeletonPreviewTabProps {
  extractionResult: ExtractionResult;
  videoMeta: VideoMetadata | null;
}

type ViewMode = "skeleton" | "video" | "side-by-side";

export function SkeletonPreviewTab({ extractionResult, videoMeta }: SkeletonPreviewTabProps) {
  // Owned here, for the same reason as the extract tab.
  const videoUrl = useObjectUrl(videoMeta?.file);
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

    const style = {
      bodyColor: "#94a3b8",
      jointColor: "#cbd5e1",
      faceColor: "rgba(251,191,36,0.08)",
      faceFeatureColor: "#fbbf24",
      leftHandColor: "#c0593a",
      rightHandColor: "#60a5fa",
      lineWidth: 2,
      jointRadius: 3,
    };

    if (frame.poseLandmarks && frame.poseLandmarks.length > 0) {
      drawFullPose(ctx, frame.poseLandmarks, w, h, style);
    }

    if (frame.faceLandmarks && frame.faceLandmarks.length > 0) {
      drawStylizedFace(ctx, frame.faceLandmarks, w, h, style);
    }

    const leftHand = frame.landmarks.find((h) => h.side === "left");
    const rightHand = frame.landmarks.find((h) => h.side === "right");

    if (leftHand) {
      drawFullHand(ctx, leftHand.landmarks, style.leftHandColor, w, h, style.lineWidth, style.jointRadius);
    }
    if (rightHand) {
      drawFullHand(ctx, rightHand.landmarks, style.rightHandColor, w, h, style.lineWidth, style.jointRadius);
    }

    if (showLabels && frame.poseLandmarks) {
      ctx.font = "9px monospace";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      const labelIndices = [0, 11, 12, 15, 16, 23, 24, 27, 28];
      const labelNames = ["HEAD", "L_SHOULDER", "R_SHOULDER", "L_HAND", "R_HAND", "L_HIP", "R_HIP", "L_KNEE", "R_KNEE"];
      for (let i = 0; i < labelIndices.length; i++) {
        const idx = labelIndices[i];
        if (idx < frame.poseLandmarks.length) {
          ctx.fillText(labelNames[i], frame.poseLandmarks[idx].x * w, frame.poseLandmarks[idx].y * h - 10);
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
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
    }
    // videoUrl arrives one render after videoMeta, so it must be a dependency
    // or the element keeps the empty src it mounted with.
  }, [videoMeta, videoUrl]);

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
          background: #fff;
          border-radius: 8px;
          padding: 3px;
          border: 1px solid #e2e8f0;
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
          background: #eff6ff;
          color: #1d4ed8;
        }
        .view-toggle button:hover:not(.active) { color: #0f172a; }
        .controls-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 10px 14px;
          background: #fff;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
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
          color: #475569;
          transition: all 0.15s;
        }
        .controls-bar button:hover { background: #f1f5f9; color: #0f172a; }
        .controls-bar button.active { color: #2563eb; background: #eff6ff; }
        .controls-bar button:disabled { opacity: 0.3; cursor: not-allowed; }
        .controls-bar .frame-slider {
          flex: 1;
          min-width: 100px;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: #e2e8f0;
          border-radius: 2px;
          outline: none;
        }
        .controls-bar .frame-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #2563eb;
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
          background: #fff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
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
