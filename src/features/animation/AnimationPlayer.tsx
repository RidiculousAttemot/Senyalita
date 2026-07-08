"use client";

import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { AnimationEngine, type AnimationEventCallback } from "./engine";
import { StickmanRenderer } from "./StickmanRenderer";
import type { AnimationClip, SkeletonPose } from "./types";
import { REST_POSE } from "./types";

interface AnimationPlayerProps {
  clips: AnimationClip[];
  autoplay?: boolean;
  width?: number;
  height?: number;
  speed?: number;
  showControls?: boolean;
  onComplete?: () => void;
  onGestureChange?: (gesture: string, current: number, total: number) => void;
}

interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  currentGesture: string | null;
  currentTime: number;
  duration: number;
  queueLength: number;
  currentIndex: number;
}

const defaultPose: SkeletonPose = REST_POSE;

const AnimationPlayer = memo(function AnimationPlayer({
  clips,
  autoplay = true,
  width = 400,
  height = 500,
  speed = 1,
  showControls = true,
  onComplete,
  onGestureChange,
}: AnimationPlayerProps) {
  const engineRef = useRef<AnimationEngine | null>(null);
  const [pose, setPose] = useState<SkeletonPose>(defaultPose);
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    isPaused: false,
    currentGesture: null,
    currentTime: 0,
    duration: 0,
    queueLength: 0,
    currentIndex: 0,
  });

  useEffect(() => {
    const engine = new AnimationEngine();
    engineRef.current = engine;

    const callbacks: AnimationEventCallback = {
      onFrame: (p, time, clip) => {
        setPose(p);
        setState((prev) => ({
          ...prev,
          currentTime: time,
          duration: clip.animation.duration,
        }));
      },
      onComplete: () => {},
      onQueueComplete: () => {
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          isPaused: false,
          currentGesture: null,
          currentTime: 0,
        }));
        setPose(defaultPose);
        onComplete?.();
      },
      onGestureChange: (gesture, index, total) => {
        setState((prev) => ({
          ...prev,
          currentGesture: gesture,
          currentIndex: index,
          queueLength: total,
        }));
        onGestureChange?.(gesture, index, total);
      },
    };

    engine.setCallbacks(callbacks);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [onComplete, onGestureChange]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || clips.length === 0) return;

    engine.clearQueue();
    if (autoplay) {
      if (clips.length === 1) {
        engine.loadClip(clips[0]);
      } else {
        engine.loadClip(clips[0]);
        engine.queueClips(clips.slice(1));
      }
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [clips, autoplay]);

  useEffect(() => {
    engineRef.current?.setSpeed(speed);
  }, [speed]);

  const handlePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (state.isPaused) {
      engine.resume();
      setState((prev) => ({ ...prev, isPaused: false }));
    } else {
      engine.pause();
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, [state.isPaused]);

  const handleReplay = useCallback(() => {
    engineRef.current?.replay();
    setState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    setPose(defaultPose);
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentGesture: null,
      currentTime: 0,
    }));
  }, []);

  const progress =
    state.duration > 0
      ? Math.min(1, state.currentTime / state.duration) * 100
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <StickmanRenderer pose={pose} width={width} height={height} />
      {showControls && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleReplay} disabled={!state.isPlaying && !state.currentGesture} className="button button-secondary" style={{ fontSize: 12, padding: "4px 12px" }}>
            ↺
          </button>
          <button onClick={handlePause} disabled={!state.isPlaying && !state.isPaused} className="button button-secondary" style={{ fontSize: 12, padding: "4px 12px" }}>
            {state.isPaused ? "▶" : "⏸"}
          </button>
          <button onClick={handleStop} disabled={!state.isPlaying && !state.isPaused} className="button button-secondary" style={{ fontSize: 12, padding: "4px 12px" }}>
            ⏹
          </button>
          <div style={{ width: 100, height: 6, background: "#333", borderRadius: 3, overflow: "hidden", marginLeft: 4 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#3b82f6", borderRadius: 3, transition: "width 0.05s linear" }} />
          </div>
        </div>
      )}
    </div>
  );
});

export { AnimationPlayer };
export type { AnimationPlayerProps, PlayerState };
