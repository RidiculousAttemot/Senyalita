"use client";

import React, { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import { PlaybackEngine } from "./PlaybackEngine";
import { AdvancedCanvasRenderer } from "../renderer/AdvancedCanvasRenderer";
import type { AdvancedRendererOptions } from "../renderer/AdvancedCanvasRenderer";
import { AnimationLoader } from "../loader/AnimationLoader";
import { CoarticulationEngine } from "./coarticulation";
import { GestureTimingOptimizer } from "./gestureTiming";
import { NonManualController } from "../engine/nonManualFeatures";
import { PerformanceOptimizer } from "./performanceOptimizer";
import { TransitionEngine } from "./TransitionEngine";
import { FingerspellingEngine } from "./FingerspellingEngine";
import { SmartAnimationResolver } from "./SmartAnimationResolver";
import { AnimationCache, PlaybackAnalytics } from "./AnimationCache";
import type { AnimationClip, PlaybackState, AvatarTheme, GestureAnimationAsset, AnimationInspectorData } from "../types";
import { AVATAR_THEMES } from "../types";

export interface SignAnimationPlayerHandle {
  play: () => void;
  pause: () => void;
  replay: () => void;
  reset: () => void;
  stop: () => void;
  getPlayState: () => PlaybackState;
}

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
  backgroundColor?: string;
  onComplete?: () => void;
  onGestureChange?: (gesture: string, current: number, total: number) => void;
  onInspectorData?: (data: AnimationInspectorData) => void;
  onAnalyticsEvent?: (event: Parameters<PlaybackAnalytics["record"]>[0]) => void;
}

const SignAnimationPlayer = memo(forwardRef<SignAnimationPlayerHandle, SignAnimationPlayerProps>(function SignAnimationPlayer({
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
  backgroundColor,
  onComplete,
  onGestureChange,
  onInspectorData,
  onAnalyticsEvent,
}: SignAnimationPlayerProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const rendererRef = useRef<AdvancedCanvasRenderer | null>(null);
  const coarticulationRef = useRef<CoarticulationEngine | null>(null);
  const timingRef = useRef<GestureTimingOptimizer | null>(null);
  const nonManualRef = useRef<NonManualController | null>(null);
  const perfRef = useRef<PerformanceOptimizer | null>(null);
  const transitionRef = useRef<TransitionEngine | null>(null);
  const fingerspellRef = useRef<FingerspellingEngine | null>(null);
  const resolverRef = useRef<SmartAnimationResolver | null>(null);
  const cacheRef = useRef<AnimationCache | null>(null);
  const analyticsRef = useRef<PlaybackAnalytics | null>(null);
  const currentGestureRef = useRef<string>("");
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const [playState, setPlayState] = useState<PlaybackState>({
    isPlaying: false, isPaused: false, currentTime: 0, duration: 0,
    currentGesture: null, currentIndex: 0, queueLength: 0, speed: 1, loop: false,
  });
  const playStateRef = useRef(playState);
  playStateRef.current = playState;
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const bgColor = backgroundColor ?? (highContrast ? "#000000" : "#0f172a");
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

    const animLoader = new AnimationLoader();
    const transition = new TransitionEngine();
    transitionRef.current = transition;

    const fingerspell = new FingerspellingEngine({ enabled: true, speed: 1, letterPause: 80, handShape: "right" });
    fingerspellRef.current = fingerspell;

    const resolver = new SmartAnimationResolver(animLoader);
    resolverRef.current = resolver;

    const cache = new AnimationCache();
    cacheRef.current = cache;

    const analytics = new PlaybackAnalytics();
    analyticsRef.current = analytics;

    engine.setCallbacks({
      onFrame: (frame, time, clip) => {
        try {
          perf.recordFrame(performance.now());
          setPlayState((prev) => ({ ...prev, currentTime: time }));

          const gestureLabel = clip?.gesture ?? currentGestureRef.current;
          let processedFrame = frame;

          if (transitionRef.current) {
            processedFrame = transitionRef.current.blendFrames(frame, frame, 1);
          }

          const coarticulated = coarticulation.processFrame(processedFrame, gestureLabel, 1 / 30);

          nonManual.setGestureExpression(gestureLabel);
          nonManual.update(1 / 30);

          renderer.render(coarticulated, {
            nonManual: nonManual.getFeatures(),
          });

          // Inspector data
          if (onInspectorData && clip) {
            onInspectorData({
              originalGloss: gestureLabel,
              resolvedGloss: gestureLabel,
              strategy: "exact_gloss",
              assetDuration: clip.asset.duration,
              frameCount: clip.asset.totalFrames,
              fps: clip.asset.fps,
              transitionIn: null,
              transitionOut: null,
              expression: nonManual.getFeatures().facialExpression,
              timingSpeed: timingRef.current?.getSpeedForGesture(clip.asset) ?? 1,
              confidence: 1,
              missingFrames: 0,
              coarticulationScore: coarticulation.getConfig().enabled ? 1 : 0,
              cacheHit: (cacheRef.current?.getStats().hitRate ?? 0) > 0,
            });
          }
        } catch (err) {
          console.error("[Playback] Render error:", err);
        }
      },
      onGestureChange: (gesture, index, total) => {
        currentGestureRef.current = gesture;
        setPlayState((prev) => ({
          ...prev, currentGesture: gesture, currentIndex: index, queueLength: total,
        }));
        onGestureChange?.(gesture, index, total);
        analyticsRef.current?.record({ type: "gesture_played", gesture, details: `index ${index}/${total}` });

        const c = clipsRef.current;
        if (index > 0 && c[index - 1]) {
          coarticulation.startTransition(c[index - 1].gesture, gesture);
          if (transitionRef.current) {
            const prevAsset = c[index - 1]?.asset;
            const nextAsset = c[index]?.asset;
            if (prevAsset && nextAsset) {
              transitionRef.current.createTransition(
                c[index - 1].gesture, gesture,
                transitionRef.current.getLastFrame(prevAsset.frames),
                transitionRef.current.getFirstFrame(nextAsset.frames),
              );
            }
          }
        }
        if (onAnalyticsEvent) {
          onAnalyticsEvent({ type: "gesture_played", gesture, details: `index ${index}/${total}` });
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
      transitionRef.current = null;
      fingerspellRef.current = null;
      resolverRef.current = null;
      cacheRef.current = null;
      analyticsRef.current = null;
    };
  }, [onComplete, onGestureChange, width, height, theme, showLabels, showNonManual, highContrast, backgroundColor, speed]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || clips.length === 0) return;

    engine.stop();
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

  useImperativeHandle(ref, () => ({
    play: () => {
      const s = playStateRef.current;
      if (s.isPaused) {
        engineRef.current?.resume();
        setPlayState((prev) => ({ ...prev, isPaused: false }));
      } else if (!s.isPlaying) {
        engineRef.current?.replay();
        nonManualRef.current?.reset();
        setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
      }
    },
    pause: () => {
      engineRef.current?.pause();
      setPlayState((prev) => ({ ...prev, isPaused: true }));
    },
    replay: handleReplay,
    reset: handleReplay,
    stop: handleStop,
    getPlayState: () => playStateRef.current,
  }), [handleReplay, handleStop]);

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
}));

export { SignAnimationPlayer };
export type { SignAnimationPlayerProps };
