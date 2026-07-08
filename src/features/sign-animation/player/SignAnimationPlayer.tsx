"use client";

import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { PlaybackEngine } from "./PlaybackEngine";
import { AdvancedCanvasRenderer } from "../renderer/AdvancedCanvasRenderer";
import type { AdvancedRendererOptions } from "../renderer/AdvancedCanvasRenderer";
import { AnimationLoader } from "../loader/AnimationLoader";
import { CoarticulationEngine } from "./coarticulation";
import { GestureTimingOptimizer } from "./gestureTiming";
import { NonManualController } from "../engine/nonManualFeatures";
import { PerformanceOptimizer } from "./performanceOptimizer";
import type { AnimationClip, PlaybackState, AvatarTheme, GestureAnimationAsset } from "../types";
import { AVATAR_THEMES } from "../types";

interface SignAnimationPlayerProps {
  clips: AnimationClip[];
  width?: number;
  height?: number;
  speed?: number;
  loop?: boolean;
  showControls?: boolean;
  theme?: AvatarTheme;
  showNonManual?: boolean;
  showLabels?: boolean;
  highContrast?: boolean;
  onComplete?: () => void;
  onGestureChange?: (gesture: string, current: number, total: number) => void;
}

const SignAnimationPlayer = memo(function SignAnimationPlayer({
  clips,
  width = 320,
  height = 400,
  speed = 1,
  loop = false,
  showControls = true,
  theme = "minimal",
  showNonManual = false,
  showLabels = false,
  highContrast = false,
  onComplete,
  onGestureChange,
}: SignAnimationPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const rendererRef = useRef<AdvancedCanvasRenderer | null>(null);
  const coarticulationRef = useRef<CoarticulationEngine | null>(null);
  const timingRef = useRef<GestureTimingOptimizer | null>(null);
  const nonManualRef = useRef<NonManualController | null>(null);
  const perfRef = useRef<PerformanceOptimizer | null>(null);
  const currentGestureRef = useRef<string>("");
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const [playState, setPlayState] = useState<PlaybackState>({
    isPlaying: false, isPaused: false, currentTime: 0, duration: 0,
    currentGesture: null, currentIndex: 0, queueLength: 0, speed: 1, loop: false,
  });
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const bgColor = highContrast ? "#000000" : "#0f172a";
    const renderer = new AdvancedCanvasRenderer(canvasRef.current, {
      width, height, theme, showLabels, showNonManual,
      backgroundColor: bgColor,
    });
    rendererRef.current = renderer;

    const engine = new PlaybackEngine();
    engineRef.current = engine;

    const coarticulation = new CoarticulationEngine({ enabled: true, blendDuration: 200 });
    coarticulationRef.current = coarticulation;

    const timing = new GestureTimingOptimizer({ baseSpeed: speed, adjustByComplexity: true });
    timingRef.current = timing;

    const nonManual = new NonManualController();
    nonManualRef.current = nonManual;

    const perf = new PerformanceOptimizer();
    perfRef.current = perf;

    engine.setCallbacks({
      onFrame: (frame, time, clip) => {
        perf.recordFrame(performance.now());

        const gestureLabel = clip?.gesture ?? currentGestureRef.current;
        const coarticulated = coarticulation.processFrame(frame, gestureLabel, 1 / 30);

        nonManual.setGestureExpression(gestureLabel);
        nonManual.update(1 / 30);

        const bodyPose = undefined;
        renderer.render(coarticulated, {
          nonManual: nonManual.getFeatures(),
        });
      },
      onGestureChange: (gesture, index, total) => {
        currentGestureRef.current = gesture;
        setPlayState((prev) => ({
          ...prev, currentGesture: gesture, currentIndex: index, queueLength: total,
        }));
        onGestureChange?.(gesture, index, total);

        const c = clipsRef.current;
        if (index > 0 && c[index - 1]) {
          coarticulation.startTransition(c[index - 1].gesture, gesture);
        }
      },
      onComplete: () => {},
      onQueueComplete: () => {
        setPlayState((prev) => ({
          ...prev, isPlaying: false, isPaused: false, currentTime: 0, currentGesture: null,
        }));
        renderer.render(null);
        onComplete?.();
      },
    });

    return () => {
      engine.dispose();
      renderer.dispose();
      engineRef.current = null;
      rendererRef.current = null;
    };
  }, [onComplete, onGestureChange, width, height, theme, showLabels, showNonManual, highContrast]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || clips.length === 0) return;

    engine.clearQueue();
    const firstClip = clips[0];
    const remaining = clips.slice(1);
    engine.loadClip(firstClip);
    if (remaining.length > 0) {
      engine.queueClips(remaining);
    }
    setPlayState((prev) => ({ ...prev, isPlaying: true, loop }));
  }, [clips, loop]);

  useEffect(() => {
    engineRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    engineRef.current?.setLoop(loop);
  }, [loop]);

  const handlePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (playState.isPaused) {
      engine.resume();
      setPlayState((prev) => ({ ...prev, isPaused: false }));
    } else {
      engine.pause();
      setPlayState((prev) => ({ ...prev, isPaused: true }));
    }
  }, [playState.isPaused]);

  const handleReplay = useCallback(() => {
    engineRef.current?.replay();
    nonManualRef.current?.reset();
    setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    rendererRef.current?.render(null);
    coarticulationRef.current?.reset();
    nonManualRef.current?.reset();
    setPlayState((prev) => ({
      ...prev, isPlaying: false, isPaused: false, currentGesture: null, currentTime: 0,
    }));
  }, []);

  const progress = playState.duration > 0
    ? Math.min(100, (playState.currentTime / playState.duration) * 100) : 0;
  const clipCount = clips.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ borderRadius: 8, maxWidth: "100%" }}
      />
      {showControls && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", maxWidth: width }}>
          <button onClick={handleReplay} disabled={!playState.isPlaying && !playState.currentGesture} className="button button-secondary" style={{ fontSize: 12, padding: "4px 10px" }} title="Replay">
            ↺
          </button>
          <button onClick={handlePause} disabled={!playState.isPlaying && !playState.isPaused} className="button button-secondary" style={{ fontSize: 12, padding: "4px 10px" }} title={playState.isPaused ? "Play" : "Pause"}>
            {playState.isPaused ? "▶" : "⏸"}
          </button>
          <button onClick={handleStop} disabled={!playState.isPlaying && !playState.isPaused} className="button button-secondary" style={{ fontSize: 12, padding: "4px 10px" }} title="Stop">
            ⏹
          </button>
          {clipCount > 1 && (
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>
              {(playState.currentIndex ?? 0) + 1}/{clipCount}
            </span>
          )}
          <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden", marginLeft: 4 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#3b82f6", borderRadius: 3, transition: "width 0.05s linear" }} />
          </div>
        </div>
      )}
    </div>
  );
});

export { SignAnimationPlayer };
export type { SignAnimationPlayerProps };
