"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import type { PlaybackProgress } from "@/features/sign-animation/player/SignAnimationPlayer";
import type { AnimationClip } from "@/features/sign-animation/types";
import { trimToActiveSpan } from "@/features/sign-animation/activeSpan";
import { cn } from "@/lib/utils";
import { HandSkeleton } from "./HandSkeleton";

/**
 * The player is code-split, not just its data.
 *
 * Importing it statically put the whole playback graph -- engine, both
 * renderers, coarticulation, transitions, fingerspelling, the resolver and the
 * cache -- into the landing page's first load: measured at 163kB before and
 * 193kB after, a 30kB regression on a page most visitors bounce from, paid
 * even by someone who never scrolls to the panel.
 *
 * Deferring it means the 30kB and the multi-megabyte asset arrive together, on
 * the same trigger, and neither is on the critical path. ssr:false because the
 * player builds canvas renderers on mount and has nothing to render on the
 * server.
 */
const SignAnimationPlayer = dynamic(
  () => import("@/features/sign-animation/player/SignAnimationPlayer").then((m) => m.SignAnimationPlayer),
  { ssr: false },
);

/**
 * The smallest published asset: 134 frames, 4.4s, 2.34MB over the wire.
 *
 * Chosen by measurement rather than meaning. Assets run 2.3-4.4MB and this is a
 * page most visitors bounce from, so the cheapest sign that is still a whole
 * word wins. Next smallest are COLD (2.57MB) and SUGAR (2.59MB).
 */
const HERO_GLOSS = "KNOW";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; clip: AnimationClip }
  | { status: "unavailable" };

/**
 * When the asset is allowed to be fetched.
 *
 * "visible" is the hero: one known sign, pulled once the panel is on screen.
 * "manual" is the showcase, which sits behind a free-text box -- see the note
 * on the load policy in InteractiveShowcaseSection. Nothing there is fetched
 * until the visitor asks for a specific sign.
 */
export type SurfaceTrigger = "visible" | "manual";

interface SignSurfaceProps {
  /** The sign to play. `null` means there is nothing playable to offer yet. */
  gloss: string | null;
  trigger?: SurfaceTrigger;
  /** Classes for the surface box itself, so callers can size it. */
  className?: string;
  /** The honest one-liner under the stage. */
  showCaption?: boolean;
  /** Shown in place of the play button when `gloss` is null. */
  emptyNote?: string;
}

/**
 * A real published sign, playing on the landing page.
 *
 * This replaced a fabricated hand rig that stepped through six scripted stages
 * and reported "96% match". None of it was measured: the skeleton was drawn
 * from hardcoded coordinates and the number was a literal, so a visitor's first
 * impression of the system was a claim the system had never made.
 *
 * What runs here is the same player the translator uses, in skeleton mode, over
 * landmark data recorded from a signer. There is no accuracy figure, because a
 * pre-recorded playback cannot produce one. Naming the sign is both true and the
 * better demonstration -- it shows the vocabulary exists.
 *
 * NOT A SECOND RENDERER, AND NOT A THIRD. Drawing a panel independently is how
 * the four view modes drifted apart before. Both landing panels mount this one
 * component, which mounts SignAnimationPlayer -- the one verified in all four
 * modes on production.
 */
export function SignSurface({
  gloss,
  trigger = "visible",
  className,
  showCaption = true,
  emptyNote,
}: SignSurfaceProps) {
  const prefersReducedMotion = useReducedMotion();
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [painted, setPainted] = useState(false);
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);
  const [size, setSize] = useState({ width: 320, height: 320 });

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  /**
   * The gloss already requested, not a boolean.
   *
   * It was a boolean when only the hero used this, where the sign never
   * changes. The showcase changes it as the visitor types, and a boolean would
   * have latched after the first fetch and left every later sign showing the
   * previous one's skeleton.
   */
  const requestedRef = useRef<string | null>(null);

  const fetchClip = useCallback(async (target: string) => {
    // Once per gloss. Both the observer and the button reach this, and the
    // loader has no in-flight dedupe -- two calls would fetch megabytes twice.
    if (requestedRef.current === target) return;
    requestedRef.current = target;
    setPainted(false);
    setProgress(null);
    setLoad({ status: "loading" });
    // Imported here rather than at module scope for the same reason the player
    // is: a static import would put the loader and its cache in the landing
    // page's first load, for a fetch that may never happen.
    const { globalLoader } = await import("@/features/sign-animation/hooks/useAnimationClip");
    const asset = await globalLoader.load(target);
    // The visitor kept typing while this was in flight; this sign is no longer
    // the one on screen.
    if (requestedRef.current !== target) return;
    if (!asset) {
      // A landing page must not break because one asset is unpublished. The
      // placeholder stays and the panel says plainly that nothing is playing.
      setLoad({ status: "unavailable" });
      return;
    }
    setLoad({
      status: "ready",
      // Trimmed so the panel opens on the sign rather than on the rest pose it
      // was recorded with. See activeSpan: KNOW stands still for its first 15
      // frames, and a looping panel replays that every cycle.
      clip: { id: `landing-${target}`, gesture: target, asset: trimToActiveSpan(asset) },
    });
  }, []);

  // A new sign clears the old one immediately, so the panel never shows the
  // previous word's skeleton under the new word's label.
  useEffect(() => {
    if (requestedRef.current !== null && requestedRef.current !== gloss) {
      requestedRef.current = null;
      setLoad({ status: "idle" });
      setPainted(false);
      setProgress(null);
    }
  }, [gloss]);

  /**
   * Fetched on scroll into view, never on mount, and only for the hero.
   *
   * The landing page transfers ~258KB today. Pulling an asset eagerly would be
   * roughly a tenfold increase for a panel many visitors never reach, so the
   * cost is paid only once the panel is actually on screen.
   *
   * Under reduced motion nothing is fetched automatically either. That user has
   * not asked for the content, so the button is the only trigger -- see the
   * note on the play control below.
   */
  useEffect(() => {
    if (trigger !== "visible" || prefersReducedMotion || !gloss) return;
    const el = surfaceRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void fetchClip(gloss);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchClip, prefersReducedMotion, trigger, gloss]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clips = load.status === "ready" ? [load.clip] : [];
  const totalFrames = load.status === "ready" ? load.clip.asset.totalFrames : 0;
  const frame = progress && load.status === "ready"
    ? Math.min(totalFrames, Math.round(progress.clipTime * (progress.fps || 30)) + 1)
    : 0;

  // Only true once the canvas has actually drawn. The placeholder stays up
  // until then, because a panel that goes blank while a multi-megabyte asset
  // decodes is a failure that has already shipped here twice.
  const showPlaceholder = !painted || load.status !== "ready";

  return (
    <>
      <div
        ref={surfaceRef}
        className={cn(
          "relative aspect-square overflow-hidden rounded-3xl border border-senyalita-border bg-gradient-to-br from-white to-senyalita-warm shadow-xl shadow-senyalita-dark/5",
          className,
        )}
      >
        {load.status === "ready" && (
          <div className="absolute inset-0 [&>div]:h-full [&>div]:w-full [&>div]:gap-0">
            <SignAnimationPlayer
              clips={clips}
              width={size.width}
              height={size.height}
              viewMode="skeleton"
              showControls={false}
              loop
              backgroundColor="#FFFFFF"
              onFirstFrame={() => setPainted(true)}
              onProgress={setProgress}
            />
          </div>
        )}

        {showPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white to-senyalita-warm">
            <div className="absolute inset-[18%]">
              {/* Stylised and unlabelled. It is a placeholder for a panel that
                  would otherwise be blank, and claims nothing about the sign. */}
              <HandSkeleton landmarksVisible linesVisible className="h-full w-full opacity-40" />
            </div>

            {(load.status === "idle" || load.status === "unavailable") && (
              /**
               * The play control, and why reduced motion stops here rather than
               * at the player.
               *
               * globals.css exempts canvas and video from the reduced-motion
               * block, because a sign IS its movement and freezing it removes
               * the information rather than the decoration. That reasoning is
               * about a user who asked to see a sign. On a landing page nobody
               * asked: an auto-looping panel beside the headline is closer to
               * decoration, and it is also megabytes they did not request. So
               * the exemption still holds once playback starts -- it just does
               * not start on its own here.
               */
              gloss ? (
                <button
                  type="button"
                  onClick={() => void fetchClip(gloss)}
                  disabled={load.status === "unavailable"}
                  className="relative flex items-center gap-2 rounded-full bg-senyalita-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:bg-slate-500"
                >
                  <Play className="h-4 w-4" />
                  {load.status === "unavailable" ? "Sign unavailable" : `Play ${gloss}`}
                </button>
              ) : emptyNote ? (
                <span className="relative max-w-[80%] rounded-full bg-white/90 px-4 py-2 text-center text-xs font-medium text-senyalita-muted shadow-sm backdrop-blur">
                  {emptyNote}
                </span>
              ) : null
            )}

            {load.status === "loading" && (
              <motion.span
                animate={prefersReducedMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="relative rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-senyalita-muted shadow-sm backdrop-blur"
              >
                Loading recorded landmarks…
              </motion.span>
            )}
          </div>
        )}
      </div>

      {/* Says what is on screen and no more. The line this replaces reported a
          confidence figure and a step counter, and neither existed. */}
      {showCaption && (
        <p className="mt-3 px-1 text-xs text-senyalita-muted">
          {load.status === "ready" && painted
            ? `Recorded landmark data · frame ${frame} of ${totalFrames}`
            : "Recorded landmark data from a published sign"}
        </p>
      )}
    </>
  );
}

/** The hero panel: one known sign, fetched once the panel is on screen. */
export function SignPlaybackDemo({ id }: { id?: string }) {
  return (
    <div id={id} className="relative w-full max-w-md scroll-mt-28">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted">
          Filipino Sign Language
        </span>
        <span className="font-mono text-xs font-bold tracking-wide text-senyalita-primary">
          {HERO_GLOSS}
        </span>
      </div>
      <SignSurface gloss={HERO_GLOSS} trigger="visible" />
    </div>
  );
}
