"use client";

import React, { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import { PlaybackEngine } from "./PlaybackEngine";
import { AdvancedCanvasRenderer } from "../renderer/AdvancedCanvasRenderer";
import type { AdvancedRendererOptions } from "../renderer/AdvancedCanvasRenderer";
import { ExactLandmarkRenderer } from "../renderer/ExactLandmarkRenderer";
import type { ExactRendererOptions } from "../renderer/ExactLandmarkRenderer";
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

export type ViewMode = "human" | "skeleton" | "split";

export interface SignAnimationPlayerHandle {
  play: () => void;
  pause: () => void;
  replay: () => void;
  reset: () => void;
  stop: () => void;
  seekToClip: (index: number) => void;
  getPlayState: () => PlaybackState;
  setViewMode: (mode: ViewMode) => void;
}

export interface PlaybackProgress {
  clipTime: number;
  clipDuration: number;
  index: number;
  total: number;
  fps: number;
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
  viewMode?: ViewMode;
  showDebug?: boolean;
  isStreaming?: boolean;
  onComplete?: () => void;
  onGestureChange?: (gesture: string, current: number, total: number) => void;
  onProgress?: (progress: PlaybackProgress) => void;
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
  viewMode = "skeleton",
  showDebug = false,
  isStreaming = false,
  onComplete,
  onGestureChange,
  onProgress,
  onInspectorData,
  onAnalyticsEvent,
}: SignAnimationPlayerProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const advancedRendererRef = useRef<AdvancedCanvasRenderer | null>(null);
  const exactRendererRef = useRef<ExactLandmarkRenderer | null>(null);
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
  const prevClipsRef = useRef<AnimationClip[]>([]);
  const streamingRef = useRef(isStreaming);
  streamingRef.current = isStreaming;
  const pendingCompletionRef = useRef(false);
  const callbacksRef = useRef({ onComplete, onGestureChange, onProgress, onInspectorData, onAnalyticsEvent });
  callbacksRef.current = { onComplete, onGestureChange, onProgress, onInspectorData, onAnalyticsEvent };
  const [playState, setPlayState] = useState<PlaybackState>({
    isPlaying: false, isPaused: false, currentTime: 0, duration: 0,
    currentGesture: null, currentIndex: 0, queueLength: 0, speed: 1, loop: false,
  });
  const playStateRef = useRef(playState);
  playStateRef.current = playState;
  const [fps, setFps] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  const currentAssetRef = useRef<GestureAnimationAsset | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const bgColor = backgroundColor ?? (highContrast ? "#000000" : "#FBF4EA");
    
    const advancedRenderer = new AdvancedCanvasRenderer(canvasRef.current, {
      width, height, theme, showLabels, showNonManual, highContrast,
      backgroundColor: bgColor,
    });
    advancedRendererRef.current = advancedRenderer;

    const exactRenderer = new ExactLandmarkRenderer(canvasRef.current, {
      width, height, imageWidth: 640, imageHeight: 480, backgroundColor: bgColor, showDebug,
    });
    exactRendererRef.current = exactRenderer;

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
      onFrame: (frame, time, clip, frameIndex) => {
        try {
          perf.recordFrame(performance.now());
          setPlayState((prev) => ({ ...prev, currentTime: time }));
          if (frameIndex !== undefined) {
            setCurrentFrameIndex(frameIndex);
          }
          if (clip) {
            const st = engine.getState();
            callbacksRef.current.onProgress?.({
              clipTime: time,
              clipDuration: clip.asset.duration / 1000,
              index: st.currentIndex,
              total: st.queueLength,
              fps: clip.asset.fps,
            });
            currentAssetRef.current = clip.asset;
            if (totalFrames !== clip.asset.totalFrames) {
              setTotalFrames(clip.asset.totalFrames);
            }
          }

          const gestureLabel = clip?.gesture ?? currentGestureRef.current;

          if (viewMode === "skeleton" || viewMode === "split") {
            if (exactRendererRef.current && clip?.asset) {
              const asset = clip.asset;
              if (asset.imageWidth && asset.imageHeight) {
                exactRendererRef.current.setImageDimensions(asset.imageWidth, asset.imageHeight);
              }
              exactRendererRef.current.render(frame, frameIndex ?? 0, asset.totalFrames);
            }
          } else {
            let processedFrame = frame;

            if (transitionRef.current) {
              processedFrame = transitionRef.current.blendFrames(frame, frame, 1);
            }

            const coarticulated = coarticulation.processFrame(processedFrame, gestureLabel, 1 / 30);

            nonManual.setGestureExpression(gestureLabel);
            nonManual.update(1 / 30);

            advancedRenderer.render(coarticulated, {
              nonManual: nonManual.getFeatures(),
            });
          }

          if (callbacksRef.current.onInspectorData && clip) {
            callbacksRef.current.onInspectorData({
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
        callbacksRef.current.onGestureChange?.(gesture, index, total);
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
        callbacksRef.current.onAnalyticsEvent?.({ type: "gesture_played", gesture, details: `index ${index}/${total}` });
      },
      onComplete: () => {},
      onQueueComplete: () => {
        setPlayState((prev) => ({
          ...prev, isPlaying: false, isPaused: false, currentTime: 0,
        }));
        if (streamingRef.current) {
          pendingCompletionRef.current = true;
          return;
        }
        callbacksRef.current.onComplete?.();
      },
    });

    return () => {
      engine.dispose();
      advancedRenderer.dispose();
      exactRenderer.dispose();
      engineRef.current = null;
      advancedRendererRef.current = null;
      exactRendererRef.current = null;
      transitionRef.current = null;
      fingerspellRef.current = null;
      resolverRef.current = null;
      cacheRef.current = null;
      analyticsRef.current = null;
    };
  }, []);

  useEffect(() => {
    advancedRendererRef.current?.setOptions({
      width, height, theme, showLabels, showNonManual, highContrast,
      backgroundColor: backgroundColor ?? (highContrast ? "#000000" : "#FBF4EA"),
    });
    exactRendererRef.current?.setSize(width, height);
  }, [width, height, theme, showLabels, showNonManual, highContrast, backgroundColor]);

  useEffect(() => {
    engineRef.current?.setExactMode(viewMode === "skeleton" || viewMode === "split");
  }, [viewMode]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const prev = prevClipsRef.current;
    prevClipsRef.current = clips;

    if (clips.length === 0) return;

    const isAppend =
      streamingRef.current &&
      prev.length > 0 &&
      clips.length > prev.length &&
      prev.every((c, i) => c.id === clips[i]?.id);

    if (isAppend) {
      const newlyArrived = clips.slice(prev.length);
      if (playStateRef.current.isPlaying) {
        engine.appendToSequence(newlyArrived);
      } else {
        pendingCompletionRef.current = false;
        engine.loadSequence(clips, prev.length);
        setPlayState((p) => ({ ...p, isPlaying: true, isPaused: false }));
      }
      return;
    }

    pendingCompletionRef.current = false;
    engine.loadSequence(clips);
    setPlayState((p) => ({ ...p, isPlaying: true, isPaused: false, loop }));
  }, [clips, loop]);

  useEffect(() => {
    if (!isStreaming && pendingCompletionRef.current) {
      pendingCompletionRef.current = false;
      callbacksRef.current.onComplete?.();
    }
  }, [isStreaming]);

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
      videoRef.current?.play();
    } else {
      engine.pause();
      setPlayState((prev) => ({ ...prev, isPaused: true }));
      videoRef.current?.pause();
    }
  }, [playState.isPaused]);

  const handleReplay = useCallback(() => {
    engineRef.current?.replay();
    nonManualRef.current?.reset();
    coarticulationRef.current?.reset();
    setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    coarticulationRef.current?.reset();
    nonManualRef.current?.reset();
    setPlayState((prev) => ({
      ...prev, isPlaying: false, isPaused: false, currentGesture: null, currentTime: 0,
    }));
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => {
      const s = playStateRef.current;
      if (s.isPaused) {
        engineRef.current?.resume();
        setPlayState((prev) => ({ ...prev, isPaused: false }));
        videoRef.current?.play();
      } else if (!s.isPlaying) {
        engineRef.current?.replay();
        nonManualRef.current?.reset();
        coarticulationRef.current?.reset();
        setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
      }
    },
    pause: () => {
      engineRef.current?.pause();
      setPlayState((prev) => ({ ...prev, isPaused: true }));
      videoRef.current?.pause();
    },
    replay: handleReplay,
    reset: handleReplay,
    stop: handleStop,
    seekToClip: (index: number) => {
      engineRef.current?.seekToClip(index);
      nonManualRef.current?.reset();
      coarticulationRef.current?.reset();
      setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    },
    getPlayState: () => playStateRef.current,
    setViewMode: (mode: ViewMode) => {
      // View mode is controlled via props
    },
  }), [handleReplay, handleStop]);

  const progress = playState.duration > 0
    ? Math.min(100, (playState.currentTime / playState.duration) * 100) : 0;
  const clipCount = clips.length;

  const asset = clips[0]?.asset;
  const videoSrc = asset?.video;

  const renderView = () => {
    const bgColor = backgroundColor ?? (highContrast ? "#000000" : "#FBF4EA");
    const canvasStyle = { borderRadius: 8, maxWidth: "100%", background: bgColor };

    if (viewMode === "human") {
      if (!videoSrc) {
        return (
          <canvas ref={canvasRef} width={width} height={height} style={canvasStyle} />
        );
      }
      return (
        <video
          ref={videoRef}
          src={videoSrc}
          width={width}
          height={height}
          style={{ borderRadius: 8, maxWidth: "100%", background: bgColor }}
          onTimeUpdate={() => {
            if (videoRef.current && engineRef.current) {
              const st = engineRef.current.getState();
              if (Math.abs(videoRef.current.currentTime - st.currentTime) > 0.1) {
                engineRef.current.getState(); 
              }
            }
          }}
        />
      );
    }

    if (viewMode === "split") {
      return (
        <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, textAlign: "center", textTransform: "uppercase" }}>
              Human
            </div>
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: bgColor, objectFit: "contain" }}
              />
            ) : (
              <canvas width={width / 2} height={height} style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: bgColor }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, textAlign: "center", textTransform: "uppercase" }}>
              Skeleton
            </div>
            <canvas ref={canvasRef} width={width / 2} height={height} style={canvasStyle} />
          </div>
        </div>
      );
    }

    return <canvas ref={canvasRef} width={width} height={height} style={canvasStyle} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {renderView()}
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