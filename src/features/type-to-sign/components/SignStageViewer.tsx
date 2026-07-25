"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play,
  Repeat, RotateCcw,
} from "lucide-react";
import { SignAnimationPlayer } from "@/features/sign-animation/player/SignAnimationPlayer";
import type {
  PlaybackProgress, SignAnimationPlayerHandle,
} from "@/features/sign-animation/player/SignAnimationPlayer";
import type { AnimationClip } from "@/features/sign-animation/types";

const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

interface SignStageViewerProps {
  clips: AnimationClip[];
  sequenceKey: number;
  loading: boolean;
  isStreaming?: boolean;
  fingerspelledGlosses: Set<string>;
}

export function SignStageViewer({
  clips, sequenceKey, loading, isStreaming = false, fingerspelledGlosses,
}: SignStageViewerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SignAnimationPlayerHandle | null>(null);

  const [size, setSize] = useState({ width: 480, height: 560 });
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIndex(0);
    setProgress(null);
    setIsPaused(false);
    setFinished(false);
  }, [sequenceKey]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleGestureChange = useCallback((_gesture: string, current: number) => {
    setIndex(current);
    setFinished(false);
  }, []);

  const handleProgress = useCallback((p: PlaybackProgress) => setProgress(p), []);
  const handleComplete = useCallback(() => setFinished(true), []);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (finished) {
      player.replay();
      setFinished(false);
      setIsPaused(false);
      return;
    }
    if (isPaused) {
      player.play();
      setIsPaused(false);
    } else {
      player.pause();
      setIsPaused(true);
    }
  }, [finished, isPaused]);

  const restart = useCallback(() => {
    playerRef.current?.replay();
    setIsPaused(false);
    setFinished(false);
  }, []);

  const jumpTo = useCallback((target: number) => {
    if (target < 0 || target >= clips.length) return;
    playerRef.current?.seekToClip(target);
    setIndex(target);
    setIsPaused(false);
    setFinished(false);
  }, [clips.length]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      stageRef.current?.requestFullscreen?.();
    }
  }, []);

  const hasClips = clips.length > 0;
  const current = hasClips ? clips[Math.min(index, clips.length - 1)] : null;
  const next = hasClips ? clips[index + 1] : null;
  const clipProgress = progress && progress.clipDuration > 0
    ? Math.min(1, progress.clipTime / progress.clipDuration)
    : 0;
  const overallProgress = hasClips
    ? Math.min(100, ((index + clipProgress) / clips.length) * 100)
    : 0;
  const totalDuration = clips.reduce((sum, c) => sum + c.asset.duration, 0) / 1000;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-3xl border border-fsl-border bg-fsl-sunken shadow-[0_20px_50px_-30px_rgba(70,45,28,0.7)]"
      >
        <div ref={surfaceRef} className="relative aspect-[4/5] w-full sm:aspect-square lg:aspect-[4/5]">
          {hasClips && (
            <div className="absolute inset-0 [&_canvas]:h-full [&_canvas]:w-full [&>div]:h-full [&>div]:gap-0">
              <SignAnimationPlayer
                key={sequenceKey}
                ref={playerRef}
                clips={clips}
                width={size.width}
                height={size.height}
                speed={speed}
                loop={loop}
                isStreaming={isStreaming}
                showControls={false}
                backgroundColor="#FBF4EA"
                onGestureChange={handleGestureChange}
                onProgress={handleProgress}
                onComplete={handleComplete}
              />
            </div>
          )}

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-fsl-sunken/85 backdrop-blur-[2px]"
              >
                <div className="h-20 w-20 animate-breathe-slow rounded-full bg-fsl-coral-soft" />
                <p className="text-[13px] font-medium text-fsl-muted">Preparing sign sequence…</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!hasClips && !loading && <EmptyStage />}

          {hasClips && (
            <>
              <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5">
                <motion.div
                  key={current?.gesture}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-fsl-ink/85 px-3 py-1.5 backdrop-blur-sm"
                >
                  <span className="font-mono text-sm font-bold tracking-wide text-white">
                    {current?.gesture}
                  </span>
                  {current && fingerspelledGlosses.has(current.gesture) && (
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      spelled
                    </span>
                  )}
                </motion.div>
                {next && (
                  <span className="w-fit rounded-md bg-white/70 px-2 py-1 font-mono text-[11px] text-fsl-muted backdrop-blur-sm">
                    next · {next.gesture}
                  </span>
                )}
              </div>

              <dl className="pointer-events-none absolute right-4 top-4 space-y-1 text-right">
                <StatChip label="sign" value={`${index + 1}/${clips.length}`} />
                <StatChip label="fps" value={`${progress?.fps ?? current?.asset.fps ?? 0}`} />
                <StatChip label="total" value={`${totalDuration.toFixed(1)}s`} />
              </dl>
            </>
          )}
        </div>

        {hasClips && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-fsl-border/50">
            <motion.div
              className="h-full bg-fsl-coral"
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.08, ease: "linear" }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-fsl-border bg-fsl-surface px-3 py-2.5">
        <IconButton label="Previous sign" onClick={() => jumpTo(index - 1)} disabled={!hasClips || index === 0}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label="Restart" onClick={restart} disabled={!hasClips}>
          <RotateCcw className="h-4 w-4" />
        </IconButton>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasClips}
          aria-label={isPaused || finished ? "Play" : "Pause"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fsl-coral text-white shadow-[0_6px_16px_-8px_rgba(216,105,74,0.9)] transition-colors hover:bg-fsl-coral-dark disabled:bg-fsl-faint disabled:shadow-none"
        >
          {isPaused || finished ? <Play className="ml-0.5 h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
        <IconButton label="Next sign" onClick={() => jumpTo(index + 1)} disabled={!hasClips || index >= clips.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>

        <div className="ml-auto flex items-center gap-1.5">
          <label className="sr-only" htmlFor="playback-speed">Playback speed</label>
          <select
            id="playback-speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            disabled={!hasClips}
            className="h-8 rounded-lg border border-fsl-border bg-fsl-raised px-1.5 text-xs font-medium tabular-nums text-fsl-body outline-none focus-visible:ring-2 focus-visible:ring-fsl-coral/40 disabled:opacity-40"
          >
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          <IconButton label="Loop sequence" onClick={() => setLoop((v) => !v)} disabled={!hasClips} active={loop}>
            <Repeat className="h-4 w-4" />
          </IconButton>
          <IconButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} disabled={!hasClips}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>

      {hasClips && (
        <MotionTimeline
          clips={clips}
          index={index}
          clipProgress={clipProgress}
          finished={finished}
          fingerspelledGlosses={fingerspelledGlosses}
          onSelect={jumpTo}
        />
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-1.5 rounded-md bg-white/70 px-2 py-0.5 backdrop-blur-sm">
      <dt className="text-[9px] uppercase tracking-wider text-fsl-faint">{label}</dt>
      <dd className="font-mono text-[11px] font-semibold tabular-nums text-fsl-body">{value}</dd>
    </div>
  );
}

function IconButton({
  label, onClick, disabled, active, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "border-fsl-coral bg-fsl-coral-soft text-fsl-coral-dark"
          : "border-fsl-border bg-fsl-raised text-fsl-body hover:border-fsl-border-strong hover:bg-fsl-sunken"
      }`}
    >
      {children}
    </button>
  );
}

function MotionTimeline({
  clips, index, clipProgress, finished, fingerspelledGlosses, onSelect,
}: {
  clips: AnimationClip[];
  index: number;
  clipProgress: number;
  finished: boolean;
  fingerspelledGlosses: Set<string>;
  onSelect: (i: number) => void;
}) {
  return (
    <section aria-label="Motion timeline" className="rounded-2xl border border-fsl-border bg-fsl-surface p-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {clips.map((clip, i) => {
          const done = finished || i < index;
          const active = !finished && i === index;
          const fill = done ? 1 : active ? clipProgress : 0;
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-current={active ? "step" : undefined}
              style={{ flexGrow: clip.asset.duration }}
              className={`group relative min-w-[68px] shrink-0 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-colors ${
                active
                  ? "border-fsl-coral bg-fsl-coral-soft"
                  : done
                    ? "border-fsl-success/30 bg-fsl-success-soft"
                    : "border-fsl-border bg-fsl-raised hover:border-fsl-border-strong"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 transition-[width] duration-100 ${active ? "bg-fsl-coral/15" : "bg-transparent"}`}
                style={{ width: `${fill * 100}%` }}
              />
              <span className={`relative block truncate font-mono text-[11px] font-bold ${
                active ? "text-fsl-coral-dark" : done ? "text-fsl-success" : "text-fsl-muted"
              }`}>
                {clip.gesture}
              </span>
              <span className="relative block text-[9px] tabular-nums text-fsl-faint">
                {(clip.asset.duration / 1000).toFixed(1)}s
                {fingerspelledGlosses.has(clip.gesture) && " · FS"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EmptyStage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-fsl-coral-soft text-3xl" aria-hidden="true">
        🤟
      </div>
      <h3 className="mb-1.5 text-lg font-semibold text-fsl-ink">
        Translate text into Filipino Sign Language
      </h3>
      <p className="mb-6 max-w-[280px] text-[14px] leading-relaxed text-fsl-muted">
        Type a sentence above to begin. The signing preview renders locally in your browser.
      </p>
      <ul className="flex flex-wrap justify-center gap-1.5">
        {["Letters", "Numbers", "Words", "Common phrases", "Fingerspelling"].map((item) => (
          <li key={item} className="rounded-full border border-fsl-border bg-fsl-surface px-2.5 py-1 text-[11px] font-medium text-fsl-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
