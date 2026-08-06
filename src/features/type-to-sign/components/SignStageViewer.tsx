"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Pause, Play,
  Presentation, Repeat, RotateCcw, Sparkles,
} from "lucide-react";
import { SignAnimationPlayer } from "@/features/sign-animation/player/SignAnimationPlayer";
import type {
  PlaybackProgress, SignAnimationPlayerHandle,
} from "@/features/sign-animation/player/SignAnimationPlayer";
import type { AnimationClip, ViewMode } from "@/features/sign-animation/types";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const VIEW_MODES: { value: ViewMode; label: string; hint: string }[] = [
  { value: "human", label: "Human", hint: "Original recording" },
  { value: "skeleton", label: "Skeleton", hint: "Extracted landmarks" },
  { value: "split", label: "Split", hint: "Recording and landmarks together" },
  { value: "overlay", label: "Overlay", hint: "Landmarks drawn on the recording" },
];

const MODE_LABEL: Record<ViewMode, string> = {
  human: "Human", skeleton: "Skeleton", split: "Split", overlay: "Overlay",
};

const STAGE_BACKGROUND = "#F1F5F9";

interface SignStageViewerProps {
  clips: AnimationClip[];
  sequenceKey: number;
  loading: boolean;
  /** Words resolved / words in the sentence, for a determinate loader. */
  loadedCount?: number;
  totalCount?: number;
  isStreaming?: boolean;
  fingerspelledGlosses: Set<string>;
}

export function SignStageViewer({
  clips, sequenceKey, loading, loadedCount = 0, totalCount = 0,
  isStreaming = false, fingerspelledGlosses,
}: SignStageViewerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SignAnimationPlayerHandle | null>(null);

  const [size, setSize] = useState({ width: 640, height: 640 });
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /**
   * Room-legible type for demoing to an audience.
   *
   * The stage's readouts sit at 9–13px, which is right for one person at a
   * laptop and unreadable from three metres. The gloss currently being signed
   * and the "Sign i of n" counter are the two things an audience needs to
   * follow, so those are what scale; the controls stay put, because the person
   * driving the demo is standing at the machine.
   */
  const [presentationMode, setPresentationMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("skeleton");
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);
  const [showTrails, setShowTrails] = useState(false);

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
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  }, []);

  /** Saves the current stage frame, so a sign can go straight into a slide. */
  const downloadFrame = useCallback(() => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${clips[index]?.gesture ?? "sign"}-frame.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [clips, index]);

  const hasClips = clips.length > 0;
  /**
   * Whether the player has put anything on screen for this sequence.
   *
   * The loader used to clear on `clips.length > 0` — the moment the first
   * landmark JSON resolved. Everything after that was invisible to it: the
   * player mounting, thirteen engine and renderer objects being constructed,
   * the first animation frame, and in the modes that show the recording a
   * multi-megabyte video fetching and decoding. All of it rendered as an empty
   * stage with no loader over it.
   */
  const [painted, setPainted] = useState(false);
  useEffect(() => { setPainted(false); }, [sequenceKey]);
  const handleFirstFrame = useCallback(() => setPainted(true), []);
  // Streaming keeps `loading` true while later clips arrive, so this cannot
  // simply be `loading || !painted` — that would re-cover a stage that is
  // already playing.
  const showLoader = (loading && !hasClips) || (hasClips && !painted);
  const current = hasClips ? clips[Math.min(index, clips.length - 1)] : null;
  const clipProgress = progress && progress.clipDuration > 0
    ? Math.min(1, progress.clipTime / progress.clipDuration)
    : 0;
  const totalDuration = clips.reduce((sum, c) => sum + c.asset.duration, 0) / 1000;

  const frameTotal = clips.reduce((sum, c) => sum + c.asset.totalFrames, 0);
  const framesBefore = clips.slice(0, index).reduce((sum, c) => sum + c.asset.totalFrames, 0);
  const secondsBefore = clips.slice(0, index).reduce((sum, c) => sum + c.asset.duration, 0) / 1000;
  const localFrame = current
    ? Math.min(current.asset.totalFrames - 1, Math.round((progress?.clipTime ?? 0) * current.asset.fps))
    : 0;
  const frameNumber = hasClips ? framesBefore + localFrame + 1 : 0;
  const elapsedSeconds = secondsBefore + (progress?.clipTime ?? 0);

  const scrubToFrame = useCallback((globalFrame: number) => {
    let remaining = globalFrame;
    for (let i = 0; i < clips.length; i++) {
      const count = clips[i].asset.totalFrames;
      if (remaining < count || i === clips.length - 1) {
        playerRef.current?.seekTo(i, Math.max(0, Math.min(count - 1, remaining)) / clips[i].asset.fps);
        setIndex(i);
        setFinished(false);
        return;
      }
      remaining -= count;
    }
  }, [clips]);

  return (
    <div className="flex flex-col gap-3">
      {/* Fixed height at every breakpoint: switching view mode must never
          reflow the page around it. Content scales inside instead. */}
      {/*
        The stage carries a fixed height at every breakpoint, and that height
        went on applying in fullscreen — so requesting fullscreen blacked out
        the rest of the screen and left the canvas at its windowed 720px. On a
        1080p projector that wasted about a third of the vertical space.
        Fullscreen now fills the viewport; the ResizeObserver on the surface
        below picks the new size up and the canvas follows.
      */}
      <div
        ref={stageRef}
        data-testid="sign-stage"
        data-fullscreen={isFullscreen ? "true" : "false"}
        className={`group relative overflow-hidden bg-white ${
          isFullscreen
            ? "h-screen w-screen rounded-none border-0"
            : "h-[420px] rounded-[28px] border border-senyalita-border shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] sm:h-[560px] lg:h-[650px] xl:h-[720px]"
        }`}
      >
        <div ref={surfaceRef} className="absolute inset-0">
          {hasClips && (
            <div className="absolute inset-0 [&>div]:h-full [&>div]:w-full [&>div]:gap-0">
              <SignAnimationPlayer
                key={sequenceKey}
                ref={playerRef}
                clips={clips}
                width={size.width}
                height={size.height}
                speed={speed}
                loop={loop}
                isStreaming={isStreaming}
                viewMode={viewMode}
                overlayOpacity={overlayOpacity}
                showTrails={showTrails}
                showControls={false}
                backgroundColor={STAGE_BACKGROUND}
                onGestureChange={handleGestureChange}
                onProgress={handleProgress}
                onComplete={handleComplete}
              />
            </div>
          )}

          <AnimatePresence>{showLoader && <LoadingStage loaded={loadedCount} total={totalCount} />}</AnimatePresence>
          {!hasClips && !showLoader && <EmptyStage />}
        </div>

        {hasClips && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-white/95 via-white/70 to-transparent p-4">
              <div className="flex flex-col gap-1.5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current?.gesture}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <span
                      data-testid="stage-gloss"
                      className={`font-display font-bold tracking-tight text-senyalita-dark ${
                        presentationMode ? "text-[clamp(2rem,4vw,4rem)] leading-none" : "text-xl"
                      }`}
                    >
                      {current?.gesture}
                    </span>
                    {current && fingerspelledGlosses.has(current.gesture) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        spelled
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
                {clips.length > 1 && (
                  <span
                    data-testid="stage-counter"
                    className={`font-medium tabular-nums text-senyalita-muted ${
                      presentationMode ? "text-[clamp(1rem,1.6vw,1.5rem)]" : "text-[11px]"
                    }`}
                  >
                    Sign {index + 1} of {clips.length}
                  </span>
                )}
              </div>

              <dl className="flex shrink-0 gap-4 text-right">
                <MetaStat label="Duration" value={`${totalDuration.toFixed(1)}s`} />
                <MetaStat label="FPS" value={`${current?.asset.fps ?? 30}`} />
                <MetaStat label="Mode" value={MODE_LABEL[viewMode]} />
              </dl>
            </div>

            <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
              <ViewModeSwitch value={viewMode} onChange={setViewMode} />
            </div>

            <AnimatePresence>
              {viewMode === "overlay" && (
                <motion.label
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/70 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-md"
                >
                  <span className="text-[11px] font-semibold text-senyalita-muted">Skeleton</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                    aria-label="Skeleton opacity"
                    className="h-1 w-28 cursor-pointer accent-senyalita-primary"
                  />
                  <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-senyalita-dark">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </motion.label>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="rounded-[22px] border border-senyalita-border bg-white/80 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)] backdrop-blur-xl">
        <div className="mb-2 flex items-baseline justify-between text-[11px] font-medium tabular-nums text-senyalita-muted">
          <span>{formatTime(elapsedSeconds)}</span>
          <span>−{formatTime(Math.max(0, totalDuration - elapsedSeconds))}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, frameTotal - 1)}
          value={Math.max(0, frameNumber - 1)}
          onChange={(e) => scrubToFrame(Number(e.target.value))}
          disabled={!hasClips}
          aria-label="Seek through the sign sequence"
          className="h-1.5 w-full cursor-pointer accent-senyalita-primary disabled:cursor-not-allowed disabled:opacity-40"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IconButton label="Previous sign" onClick={() => jumpTo(index - 1)} disabled={!hasClips || index === 0}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <IconButton label="Restart" onClick={restart} disabled={!hasClips}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
          <motion.button
            type="button"
            onClick={togglePlay}
            disabled={!hasClips}
            whileTap={{ scale: 0.94 }}
            aria-label={isPaused || finished ? "Play" : "Pause"}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-senyalita-primary text-white shadow-lg shadow-senyalita-primary/30 transition-all hover:shadow-xl hover:shadow-senyalita-primary/40 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:bg-slate-300 disabled:shadow-none"
          >
            {isPaused || finished ? <Play className="ml-0.5 h-6 w-6" /> : <Pause className="h-6 w-6" />}
          </motion.button>
          <IconButton label="Next sign" onClick={() => jumpTo(index + 1)} disabled={!hasClips || index >= clips.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            <label className="sr-only" htmlFor="playback-speed">Playback speed</label>
            <select
              id="playback-speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={!hasClips}
              className="h-9 rounded-xl border border-senyalita-border bg-white px-2 text-xs font-semibold tabular-nums text-senyalita-dark outline-none transition-colors hover:border-senyalita-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-senyalita-primary disabled:opacity-40"
            >
              {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
            </select>
            <IconButton
              label="Motion trail"
              onClick={() => setShowTrails((v) => !v)}
              disabled={!hasClips || viewMode === "human"}
              active={showTrails}
            >
              <Sparkles className="h-4 w-4" />
            </IconButton>
            <IconButton label="Loop sequence" onClick={() => setLoop((v) => !v)} disabled={!hasClips} active={loop}>
              <Repeat className="h-4 w-4" />
            </IconButton>
            <IconButton label="Download frame" onClick={downloadFrame} disabled={!hasClips || viewMode === "human"}>
              <Download className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={presentationMode ? "Exit presentation mode" : "Presentation mode"}
              onClick={() => setPresentationMode((v) => !v)}
              active={presentationMode}
            >
              <Presentation className="h-4 w-4" />
            </IconButton>
            <IconButton label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} disabled={!hasClips}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconButton>
          </div>
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

function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Viewer mode"
      className="flex gap-0.5 rounded-full border border-white/70 bg-white/75 p-1 shadow-lg shadow-slate-900/10 backdrop-blur-xl"
    >
      {VIEW_MODES.map((mode) => {
        const selected = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={mode.hint}
            onClick={() => onChange(mode.value)}
            className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary ${
              selected ? "text-white" : "text-senyalita-muted hover:text-senyalita-dark"
            }`}
          >
            {selected && (
              // Shared layoutId slides the pill between options instead of
              // snapping, which is what makes the control feel native.
              <motion.span
                layoutId="view-mode-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-senyalita-primary shadow-sm"
              />
            )}
            <span className="relative">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-senyalita-muted">{label}</dt>
      <dd className="text-[13px] font-bold tabular-nums text-senyalita-dark">{value}</dd>
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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
        active
          ? "border-senyalita-primary/30 bg-senyalita-primary/10 text-senyalita-primary shadow-sm"
          : "border-senyalita-border bg-white text-senyalita-muted hover:-translate-y-0.5 hover:border-senyalita-primary/30 hover:text-senyalita-dark hover:shadow-md"
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
    <section aria-label="Sign sequence" className="rounded-[22px] border border-senyalita-border bg-white/80 p-3 backdrop-blur-xl">
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
              className={`group/chip relative min-w-[76px] shrink-0 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-all duration-150 hover:-translate-y-0.5 ${
                active
                  ? "border-senyalita-primary/40 bg-senyalita-primary/10"
                  : done
                    ? "border-senyalita-accent/30 bg-senyalita-accent/10"
                    : "border-senyalita-border bg-white hover:border-senyalita-primary/30"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 transition-[width] duration-100 ${active ? "bg-senyalita-primary/15" : "bg-transparent"}`}
                style={{ width: `${fill * 100}%` }}
              />
              <span className={`relative block truncate font-mono text-[11px] font-bold ${
                active ? "text-senyalita-primary" : done ? "text-senyalita-accent" : "text-senyalita-muted"
              }`}>
                {clip.gesture}
              </span>
              <span className="relative block text-[9px] tabular-nums text-senyalita-muted/70">
                {(clip.asset.duration / 1000).toFixed(1)}s
                {fingerspelledGlosses.has(clip.gesture) && " · spelled"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const LOADING_STAGES = [
  "Preparing translation…",
  "Extracting landmarks…",
  "Loading animation…",
  "Almost ready…",
];

/**
 * @param loaded how many words have resolved
 * @param total  how many the sentence has
 *
 * Determinate whenever there is more than one word, because the indefinite bar
 * is indistinguishable from a stuck one. A single word stays indeterminate:
 * the count the hook reports is per word, and a fingerspelled word is one
 * word however many letters it spells.
 */
function LoadingStage({ loaded, total }: { loaded: number; total: number }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, LOADING_STAGES.length - 1)), 900);
    return () => clearInterval(timer);
  }, []);
  const determinate = total > 1;
  const pct = determinate ? Math.round((Math.min(loaded, total) / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-white/80 backdrop-blur-sm"
    >
      <SkeletonPlaceholder />
      <div className="w-56 space-y-2.5 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-[13px] font-semibold text-senyalita-dark"
          >
            {determinate ? `Loading sign ${Math.min(loaded + 1, total)} of ${total}` : LOADING_STAGES[stage]}
          </motion.p>
        </AnimatePresence>
        <div className="h-1.5 overflow-hidden rounded-full bg-senyalita-border">
          {determinate ? (
            <motion.div
              data-testid="loader-progress"
              className="h-full rounded-full bg-senyalita-primary"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          ) : (
            <motion.div
              className="h-full w-1/3 rounded-full bg-senyalita-primary"
              animate={{ x: ["-110%", "320%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Stand-in figure so the stage is never blank while assets are fetched. */
function SkeletonPlaceholder() {
  return (
    <svg width="104" height="130" viewBox="0 0 96 120" aria-hidden="true" className="animate-breathe-slow">
      <g stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <circle cx="48" cy="22" r="14" />
        <line x1="48" y1="36" x2="48" y2="52" />
        <line x1="24" y1="58" x2="72" y2="58" />
        <line x1="24" y1="58" x2="18" y2="86" />
        <line x1="72" y1="58" x2="78" y2="86" />
        <line x1="30" y1="106" x2="24" y2="58" />
        <line x1="66" y1="106" x2="72" y2="58" />
      </g>
      <g fill="#93C5FD">
        <circle cx="18" cy="86" r="5.5" />
        <circle cx="78" cy="86" r="5.5" />
      </g>
    </svg>
  );
}

function EmptyStage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="mb-7 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-senyalita-primary/10 to-senyalita-accent/10 text-5xl"
        aria-hidden="true"
      >
        🤟
      </motion.div>
      <h3 className="mb-2 font-display text-2xl font-bold tracking-tight text-senyalita-dark">
        Translate to Filipino Sign Language
      </h3>
      <p className="mb-7 max-w-[320px] text-[15px] leading-relaxed text-senyalita-muted">
        Type a sentence and press Translate. The generated animation will appear here.
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {["Letters", "Numbers", "Words", "Phrases", "Fingerspelling"].map((item) => (
          <li key={item} className="rounded-full border border-senyalita-border bg-white px-3 py-1 text-[11px] font-medium text-senyalita-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
