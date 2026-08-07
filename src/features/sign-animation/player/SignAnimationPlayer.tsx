"use client";

import React, { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import { PlaybackEngine } from "./PlaybackEngine";
import { AdvancedCanvasRenderer } from "../renderer/AdvancedCanvasRenderer";
import type { AdvancedRendererOptions } from "../renderer/AdvancedCanvasRenderer";
import { ExactLandmarkRenderer, computeClipBounds } from "../renderer/ExactLandmarkRenderer";
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
import { computeVideoSync } from "./videoSync";
import type { AnimationClip, PlaybackState, AvatarTheme, GestureAnimationAsset, AnimationInspectorData, ViewMode } from "../types";
import { AVATAR_THEMES } from "../types";

export type { ViewMode } from "../types";

/** View modes drawn from extracted landmarks rather than the avatar renderer. */
const LANDMARK_MODES = new Set<ViewMode>(["skeleton", "split", "overlay"]);

/**
 * How often per-frame playback values are pushed into React.
 *
 * 10Hz. The only thing that renders them is a progress bar, which already
 * eases between values over 50ms, so a finer cadence buys nothing visible and
 * costs a full re-render of the player and the stage around it. The engine
 * itself still advances every frame — this throttles the reporting, not the
 * playback, and anything needing the exact playhead reads currentTimeRef.
 */
const UI_PUSH_INTERVAL_MS = 100;

/**
 * play() returns a Promise that rejects with AbortError whenever anything
 * interrupts it — a pause(), a src change, or the element leaving the DOM
 * (which happens on every view-mode switch here, since each mode renders its
 * own <video>). All of those are routine in this player, not failures, so an
 * uncaught rejection was showing up as a console error on nearly every mode
 * switch or replay. Guarding on `paused` also avoids issuing an overlapping
 * play() that would abort a call already in flight.
 */
function safePlayVideo(video: HTMLVideoElement | null | undefined): void {
  if (!video || !video.paused) return;
  video.play().catch(() => { /* interrupted by pause/src-change/unmount — expected, not fatal */ });
}

export interface SignAnimationPlayerHandle {
  play: () => void;
  pause: () => void;
  replay: () => void;
  reset: () => void;
  stop: () => void;
  seekToClip: (index: number) => void;
  /** Jump to a position inside a specific clip, in seconds. */
  seekTo: (clipIndex: number, timeSeconds: number) => void;
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
  /** Skeleton opacity in overlay mode, 0-1. */
  overlayOpacity?: number;
  /** Fading path behind the hands, for reading movement direction. */
  showTrails?: boolean;
  showDebug?: boolean;
  isStreaming?: boolean;
  onComplete?: () => void;
  onGestureChange?: (gesture: string, current: number, total: number) => void;
  onProgress?: (progress: PlaybackProgress) => void;
  onInspectorData?: (data: AnimationInspectorData) => void;
  onAnalyticsEvent?: (event: Parameters<PlaybackAnalytics["record"]>[0]) => void;
  /**
   * Fires once, when there is actually something to look at.
   *
   * Callers use it to keep a loading state up until then. "Clips have arrived"
   * is not the same moment: the player still has to mount, build its renderers
   * and reach a frame, and in the modes that show the recording the <video>
   * has to fetch and decode several megabytes before it shows anything. Both
   * gaps used to be rendered as a blank stage with no loader over it.
   */
  onFirstFrame?: () => void;
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
  overlayOpacity = 0.85,
  showTrails = false,
  showDebug = false,
  isStreaming = false,
  onComplete,
  onGestureChange,
  onProgress,
  onInspectorData,
  onAnalyticsEvent,
  onFirstFrame,
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
  const callbacksRef = useRef({ onComplete, onGestureChange, onProgress, onInspectorData, onAnalyticsEvent, onFirstFrame });
  callbacksRef.current = { onComplete, onGestureChange, onProgress, onInspectorData, onAnalyticsEvent, onFirstFrame };
  /**
   * Whether each surface that will be visible has something on it yet, and
   * whether the caller has been told. Refs, because this is read from the
   * engine's frame callback and from media events, and a re-render per check
   * would defeat the point.
   */
  const canvasPaintedRef = useRef(false);
  const videoReadyRef = useRef(false);
  const firstFrameFiredRef = useRef(false);
  const [playState, setPlayState] = useState<PlaybackState>({
    isPlaying: false, isPaused: false, currentTime: 0, duration: 0,
    currentGesture: null, currentIndex: 0, queueLength: 0, speed: 1, loop: false,
  });
  const playStateRef = useRef(playState);
  playStateRef.current = playState;
  /**
   * The playhead at full rate, because `playState.currentTime` no longer is.
   *
   * Anything that has to be exact — seeking the recording after a mode switch,
   * the imperative getPlayState — reads this; only the progress bar reads the
   * throttled state.
   */
  const currentTimeRef = useRef(0);
  /** Last time per-frame values were pushed into React. See UI_PUSH_INTERVAL_MS. */
  const lastUiPushRef = useRef(0);

  const currentAssetRef = useRef<GestureAnimationAsset | null>(null);
  // onFrame is installed once, so mutable props it reads must go through refs.
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [currentAsset, setCurrentAsset] = useState<GestureAnimationAsset | null>(null);
  // A ref, not state: the only consumer is the renderer's debug readout, so
  // holding it in state re-rendered the whole player every frame to produce a
  // value that never reached the DOM.
  const driftFramesRef = useRef(0);
  // Follows the clip actually playing, so a multi-sign sequence swaps to each
  // sign's own recording instead of pinning the first one.
  const currentClipAsset = currentAsset ?? clips[0]?.asset;
  const videoSrc = currentClipAsset?.video;

  /**
   * Announce "there is something to look at" once every visible surface has
   * content — not when the first one does.
   *
   * Overlay and split show the skeleton and the recording together, so the
   * skeleton painting while the video is still fetching is exactly the blank
   * this is meant to prevent. Human shows only the recording, and the landmark
   * modes only the canvas, so each waits for what it actually renders.
   */
  /**
   * Draws a clip's opening frame with no engine involvement, so the stage has
   * content the instant data exists rather than one animation frame after
   * playback is started.
   */
  const paintFirstFrame = useCallback((clip: AnimationClip | undefined) => {
    const asset = clip?.asset;
    const frame = asset?.frames?.[0];
    if (!asset || !frame || !canvasRef.current) return;
    if (LANDMARK_MODES.has(viewModeRef.current)) {
      const renderer = exactRendererRef.current;
      if (!renderer) return;
      if (asset.imageWidth && asset.imageHeight) {
        renderer.setImageDimensions(asset.imageWidth, asset.imageHeight);
      }
      renderer.setFitBounds(viewModeRef.current === "overlay" ? null : computeClipBounds(asset));
      renderer.render(frame, 0, asset.totalFrames, { clipTime: 0, videoTime: null });
    } else {
      advancedRendererRef.current?.render(frame, {});
    }
    canvasPaintedRef.current = true;
    announceIfPresentedRef.current?.(viewModeRef.current, videoRef.current !== null);
  }, []);

  /** Indirection so paintFirstFrame can stay dependency-free. */
  const announceIfPresentedRef = useRef<((m: ViewMode, v: boolean) => void) | null>(null);

  const announceIfPresented = useCallback((mode: ViewMode, hasVideo: boolean) => {
    if (firstFrameFiredRef.current) return;
    const needsCanvas = LANDMARK_MODES.has(mode) || !hasVideo;
    const needsVideo = hasVideo && mode !== "skeleton";
    if (needsCanvas && !canvasPaintedRef.current) return;
    if (needsVideo && !videoReadyRef.current) return;
    firstFrameFiredRef.current = true;
    callbacksRef.current.onFirstFrame?.();
  }, []);
  announceIfPresentedRef.current = announceIfPresented;
  // A dead reference-video URL (expired signature, unpublished source, 503)
  // used to render a silent blank pane — indistinguishable from a rendering
  // bug, which is exactly where the last video outage sent debugging. Track
  // failure so the pane falls back to the skeleton or a note instead.
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    setVideoFailed(false);
    // A new recording has not decoded anything yet. Only matters before the
    // first announcement; afterwards the stage already has content and a later
    // clip swapping its src must not put the loader back up.
    if (!firstFrameFiredRef.current) videoReadyRef.current = false;
  }, [videoSrc]);
  const handleVideoError = useCallback(() => {
    console.warn(`[SignAnimationPlayer] reference video failed to load: ${videoSrc}`);
    setVideoFailed(true);
    // The pane falls back to the canvas, so the recording is no longer
    // something to wait for — without this a dead URL holds the loader forever.
    videoReadyRef.current = true;
    announceIfPresentedRef.current?.(viewModeRef.current, false);
  }, [videoSrc]);
  const handleVideoReady = useCallback(() => {
    videoReadyRef.current = true;
    announceIfPresentedRef.current?.(viewModeRef.current, true);
  }, []);
  // Split view gives the skeleton a half-width square panel; the drawing
  // buffer has to match that box or the figure renders stretched.
  let renderWidth = width;
  let renderHeight = height;
  if (viewMode === "split") {
    // Each pane is half-width by full-height; a square buffer would letterbox
    // the skeleton into a fraction of its pane while the video filled its own.
    renderWidth = Math.max(1, Math.floor(width / 2));
    renderHeight = height;
  } else if (viewMode === "overlay" && currentClipAsset?.imageWidth && currentClipAsset?.imageHeight) {
    // Give the canvas the recording's own aspect so `object-fit: contain`
    // letterboxes both layers identically and the landmarks land on the signer.
    renderHeight = Math.max(1, Math.round((width * currentClipAsset.imageHeight) / currentClipAsset.imageWidth));
  }

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
          const now = performance.now();
          perf.recordFrame(now);
          currentTimeRef.current = time;

          // Per-frame values reach React on a fixed cadence rather than on
          // every tick. This callback runs on the engine's requestAnimationFrame
          // loop, so it was pushing four state updates per frame — currentTime,
          // the frame index, the drift, and onProgress into the parent — and
          // re-rendering this component and the stage around it ~60 times a
          // second, next to a 1080p decode on the same thread. Two of those
          // values were never read by any render at all.
          const pushUi = now - lastUiPushRef.current >= UI_PUSH_INTERVAL_MS;
          if (pushUi) {
            lastUiPushRef.current = now;
            setPlayState((prev) => (prev.currentTime === time ? prev : { ...prev, currentTime: time }));
          }

          if (clip) {
            if (pushUi) {
              const st = engine.getState();
              callbacksRef.current.onProgress?.({
                clipTime: time,
                clipDuration: clip.asset.duration / 1000,
                index: st.currentIndex,
                total: st.queueLength,
                fps: clip.asset.fps,
              });
            }
            if (currentAssetRef.current !== clip.asset) {
              currentAssetRef.current = clip.asset;
              setCurrentAsset(clip.asset);
            }
          }

          const gestureLabel = clip?.gesture ?? currentGestureRef.current;

          // Hold the recording on the same instant as the landmark frame.
          // Sync by time, not frame number: extraction resamples to a fixed
          // fps, so the source video's own frame numbering does not match.
          const video = videoRef.current;
          let videoTime: number | null = null;
          if (video && video.readyState >= 1) {
            // Trimming removed the signer's lead-in from the landmarks but not
            // from the recording, so the video is offset to the same instant.
            const offset = clip?.asset.sourceOffsetSeconds ?? 0;
            videoTime = video.currentTime;
            const target = time + offset;
            const delta = videoTime - target;
            // Only resume while the engine itself is running, so a finished or
            // paused sequence cannot leave the recording rolling on.
            if (playStateRef.current.isPlaying && !playStateRef.current.isPaused) {
              safePlayVideo(video);
            }
            // Correct with the rate and keep seeking for real jumps only.
            // Seeking was previously the only correction, and because the
            // element's rate was never matched to the playback speed the drift
            // was permanent: 60 seeks per 10s at 0.5x, 120 at 2x, measured in
            // videoSync.test.ts. A seek flushes the decoder, so the recording
            // stepped between stills instead of playing.
            const correction = computeVideoSync(videoTime, target, speedRef.current);
            if (correction.action === "seek") {
              video.currentTime = correction.to;
            }
            if (video.playbackRate !== correction.rate) {
              video.playbackRate = correction.rate;
            }
            const fpsForDrift = clip?.asset.fps || 30;
            driftFramesRef.current = Math.round(delta * fpsForDrift);
          }

          if (LANDMARK_MODES.has(viewModeRef.current)) {
            if (exactRendererRef.current && clip?.asset) {
              const asset = clip.asset;
              if (asset.imageWidth && asset.imageHeight) {
                exactRendererRef.current.setImageDimensions(asset.imageWidth, asset.imageHeight);
              }
              // Overlay must share the video's contain layout to stay
              // registered with it; the other modes fit the signer to the stage.
              exactRendererRef.current.setFitBounds(
                viewModeRef.current === "overlay" ? null : computeClipBounds(asset),
              );
              exactRendererRef.current.setDrift(driftFramesRef.current);
              exactRendererRef.current.render(frame, frameIndex ?? 0, asset.totalFrames, {
                clipTime: time,
                videoTime,
              });
              canvasPaintedRef.current = true;
              announceIfPresented(viewModeRef.current, video !== null);
            }
          } else if (canvasRef.current) {
            // Guarded on the canvas being mounted, which in this branch it
            // usually is not. "human" is the one mode that renders a <video>
            // *instead of* a <canvas>, so canvasRef is null and the renderer is
            // still attached to whichever canvas existed before the switch —
            // detached from the document, but just as expensive to rasterise
            // into. Every frame of every recording was paying for an avatar
            // nobody could see, on the same thread decoding 1080p at 13Mbit/s.
            //
            // The fallback canvas that appears when a recording fails to load
            // is a real canvas, so this keeps drawing for that case.
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
            canvasPaintedRef.current = true;
            announceIfPresented(viewModeRef.current, video !== null);
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
        // Nothing else stops the <video>, so it would run past the trimmed
        // sign into the footage of the signer relaxing.
        videoRef.current?.pause();
        // currentTime is deliberately left at the end: zeroing it rewinds the
        // paired video while the canvas still shows the final frame, so Human
        // and Overlay would display a different instant than the landmarks.
        setPlayState((prev) => ({
          ...prev, isPlaying: false, isPaused: false,
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
    // Mount-only on purpose. These deps are applied by the dedicated effects
    // below (setOptions / setSize / setSpeed); listing them here would tear
    // down and rebuild the renderers and engine on every resize or prop
    // change, discarding the sequence mid-playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Both renderers share one canvas, so only the active one may resize it:
    // assigning canvas.width resets the bitmap, and the inactive renderer has
    // no frame to repaint, so it would blank what the active one just drew.
    if (LANDMARK_MODES.has(viewMode)) {
      exactRendererRef.current?.setBackgroundColor(
        // Overlay draws on top of the recording, so it must not paint a base.
        viewMode === "overlay"
          ? "transparent"
          : backgroundColor ?? (highContrast ? "#000000" : "#FBF4EA"),
      );
      exactRendererRef.current?.setSize(renderWidth, renderHeight);
      return;
    }
    advancedRendererRef.current?.setOptions({
      width: renderWidth, height: renderHeight, theme, showLabels, showNonManual, highContrast,
      backgroundColor: backgroundColor ?? (highContrast ? "#000000" : "#FBF4EA"),
    });
  }, [renderWidth, renderHeight, theme, showLabels, showNonManual, highContrast, backgroundColor, viewMode]);

  useEffect(() => {
    engineRef.current?.setExactMode(LANDMARK_MODES.has(viewMode));
  }, [viewMode]);

  useEffect(() => {
    exactRendererRef.current?.setShowTrails(showTrails);
  }, [showTrails]);

  // Each view mode renders its own canvas element, so the renderers have to be
  // re-pointed at the live one and repainted — otherwise switching mode after
  // playback has finished shows an empty stage. Also re-runs when videoFailed
  // flips true: the JSX swaps in a fresh fallback <canvas> at that point, and
  // without this in the deps it never gets attached, so the fallback stayed
  // blank instead of drawing the skeleton.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (LANDMARK_MODES.has(viewMode)) {
      exactRendererRef.current?.attach(canvas);
      exactRendererRef.current?.setSize(renderWidth, renderHeight);
    } else {
      advancedRendererRef.current?.attach(canvas);
      advancedRendererRef.current?.setOptions({ width: renderWidth, height: renderHeight });
    }
  }, [viewMode, renderWidth, renderHeight, videoFailed]);

  // A video revealed part-way through a sequence starts at zero, so line it up
  // with the landmark playhead and match the engine's play/pause state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const state = playStateRef.current;
    // currentTimeRef, not state: the state copy is throttled to UI_PUSH_INTERVAL_MS
    // and would line the recording up with a playhead of up to 100ms ago.
    video.currentTime = currentTimeRef.current + (currentClipAsset?.sourceOffsetSeconds ?? 0);
    // Every mode switch renders a different <video>, and a fresh element always
    // starts at rate 1 regardless of the speed the sequence is playing at.
    video.playbackRate = speed;
    if (state.isPlaying && !state.isPaused) {
      safePlayVideo(video);
    } else {
      video.pause();
    }
    // The offset belongs in the deps: two clips can share one recording while
    // starting at different points in it, which would otherwise seek stale.
  }, [viewMode, videoSrc, speed, currentClipAsset?.sourceOffsetSeconds]);

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
    // Put frame 0 on the canvas before playback is asked for anything.
    //
    // Every paint used to come from the engine's frame callback, which cannot
    // run until loadSequence has started the rAF loop — so between the clips
    // arriving and the first tick the stage was empty, on top of the mount and
    // renderer construction that had to happen first. Drawing the frame the
    // sequence starts on costs one render and removes that window entirely.
    paintFirstFrame(clips[0]);

    // Then start on the next frame, not this one.
    //
    // Painting announces "there is something to look at", which is what takes
    // the caller's loading overlay down — but that is a React state change, so
    // it lands a commit later. Starting the engine synchronously ran the sign
    // underneath the overlay for that commit, and the viewer met the sign
    // already in progress. One frame of the static opening pose instead.
    const startId = requestAnimationFrame(() => {
      engine.loadSequence(clips);
      setPlayState((p) => ({ ...p, isPlaying: true, isPaused: false, loop }));
    });
    return () => cancelAnimationFrame(startId);
  }, [clips, loop, paintFirstFrame]);

  useEffect(() => {
    if (!isStreaming && pendingCompletionRef.current) {
      pendingCompletionRef.current = false;
      callbacksRef.current.onComplete?.();
    }
  }, [isStreaming]);

  useEffect(() => {
    engineRef.current?.setSpeed(speed);
    // The engine's clock is scaled by speed; the element's is not unless it is
    // told. Applied here as well as in the sync loop so the rate is right even
    // while paused, when no frames are running to correct it.
    if (videoRef.current) videoRef.current.playbackRate = speed;
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
      safePlayVideo(videoRef.current);
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
    currentTimeRef.current = 0;
    setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
    const video = videoRef.current;
    if (video) {
      // replay() reloads the sequence from clip 0, so line the recording up
      // with that clip's offset into it rather than the raw start of the file.
      video.currentTime = clipsRef.current[0]?.asset.sourceOffsetSeconds ?? 0;
      video.playbackRate = speedRef.current;
      safePlayVideo(video);
    }
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    coarticulationRef.current?.reset();
    nonManualRef.current?.reset();
    // The engine is stopped, so no frame will arrive to correct this.
    currentTimeRef.current = 0;
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
        safePlayVideo(videoRef.current);
      } else if (!s.isPlaying) {
        engineRef.current?.replay();
        nonManualRef.current?.reset();
        coarticulationRef.current?.reset();
        currentTimeRef.current = 0;
        setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          safePlayVideo(videoRef.current);
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
      currentTimeRef.current = 0;
      setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        safePlayVideo(videoRef.current);
      }
    },
    seekTo: (clipIndex: number, timeSeconds: number) => {
      engineRef.current?.seekToClip(clipIndex, timeSeconds);
      nonManualRef.current?.reset();
      coarticulationRef.current?.reset();
      currentTimeRef.current = timeSeconds;
      setPlayState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
      const video = videoRef.current;
      if (video) {
        video.currentTime = timeSeconds + (currentAssetRef.current?.sourceOffsetSeconds ?? 0);
      }
    },
    // Exact playhead, not the throttled copy — callers use this to seek.
    getPlayState: () => ({ ...playStateRef.current, currentTime: currentTimeRef.current }),
    setViewMode: (mode: ViewMode) => {
      // View mode is controlled via props
    },
  }), [handleReplay, handleStop]);

  const progress = playState.duration > 0
    ? Math.min(100, (playState.currentTime / playState.duration) * 100) : 0;
  const clipCount = clips.length;

  const asset = currentClipAsset;

  const renderView = () => {
    const bgColor = backgroundColor ?? (highContrast ? "#000000" : "#FBF4EA");
    // `contain` inside a fully-sized box: the recording always fits, never
    // overflows and never crops the signer's hands. Letterbox bars are fine.
    const fillBox: React.CSSProperties = {
      position: "absolute", inset: 0, width: "100%", height: "100%",
      objectFit: "contain", borderRadius: 8, background: bgColor,
    };
    // onCanPlay, not just onError: the recording is several megabytes and the
    // element shows nothing until it has decoded enough to start. Treating
    // "src assigned" as ready is what let the loader clear over a blank pane.
    const videoProps = {
      muted: true,
      playsInline: true,
      preload: "auto" as const,
      onCanPlay: handleVideoReady,
      onError: handleVideoError,
    };

    if (viewMode === "human") {
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {videoSrc && !videoFailed
            ? <video ref={videoRef} src={videoSrc} {...videoProps} style={fillBox} />
            : <canvas ref={canvasRef} width={renderWidth} height={renderHeight} style={fillBox} />}
        </div>
      );
    }

    if (viewMode === "overlay") {
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {videoSrc && !videoFailed && (
            <video ref={videoRef} src={videoSrc} {...videoProps} style={fillBox} />
          )}
          <canvas
            ref={canvasRef}
            width={renderWidth}
            height={renderHeight}
            style={{ ...fillBox, background: "transparent", opacity: overlayOpacity, pointerEvents: "none" }}
          />
        </div>
      );
    }

    if (viewMode === "split") {
      // Labels sit low so the stage's top bar cannot clip them.
      const paneLabel: React.CSSProperties = {
        position: "absolute", left: "50%", bottom: 56, transform: "translateX(-50%)",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "#475569", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(6px)",
        padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", pointerEvents: "none",
      };
      const unavailable: React.CSSProperties = {
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 600, color: "#94A3B8", textAlign: "center", padding: "0 16px",
      };
      const pane: React.CSSProperties = { position: "relative", flex: 1, minWidth: 0, height: "100%" };
      return (
        <div style={{ display: "flex", gap: 6, width: "100%", height: "100%" }}>
          <div style={pane}>
            {videoSrc && !videoFailed && (
              <video ref={videoRef} src={videoSrc} {...videoProps} style={fillBox} />
            )}
            {videoSrc && videoFailed && <span style={unavailable}>Recording unavailable</span>}
            <span style={paneLabel}>Human</span>
          </div>
          <div style={pane}>
            <canvas ref={canvasRef} width={renderWidth} height={renderHeight} style={fillBox} />
            <span style={paneLabel}>Skeleton</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas ref={canvasRef} width={renderWidth} height={renderHeight} style={fillBox} />
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", height: "100%" }}>
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