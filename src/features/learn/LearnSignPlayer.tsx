"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SignAnimationPlayer } from "@/features/sign-animation/player/SignAnimationPlayer";
import { useAnimationClip } from "@/features/sign-animation/hooks/useAnimationClip";
import { Badge } from "@/components/ui/surfaces";

/**
 * Plays one published sign.
 *
 * Deliberately thin: it delegates loading to useAnimationClip and drawing to
 * SignAnimationPlayer, the same pair /translate uses. There is no second
 * renderer here — that player is the only one exercised against real assets,
 * and a learning page is a bad place to debut a new one.
 *
 * A miss is shown, never swallowed. If the asset 404s the card says so and
 * offers the human recording instead of leaving an empty canvas, which is the
 * failure mode the animation work earlier this month was about.
 */
export function LearnSignPlayer({ gloss, size = 320 }: { gloss: string; size?: number }) {
  const { clip, loading, error } = useAnimationClip(gloss);
  const [showVideo, setShowVideo] = useState(false);

  // A new selection starts from the animation again, not from whatever the
  // previous sign's video toggle was left on.
  useEffect(() => setShowVideo(false), [gloss]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        data-testid="learn-stage"
        data-gloss={gloss}
        className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-senyalita-border bg-white"
        style={{ width: size, height: size }}
      >
        {loading && (
          <span className="flex items-center gap-2 text-sm text-senyalita-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sign…
          </span>
        )}

        {!loading && error && (
          <div className="px-6 text-center">
            <p className="text-sm font-semibold text-senyalita-dark">No animation for “{gloss}”</p>
            <p className="mt-1 text-xs text-senyalita-muted">
              The recording exists but its animation could not be loaded.
            </p>
          </div>
        )}

        {!loading && !error && clip && !showVideo && (
          <SignAnimationPlayer
            clips={[clip]}
            width={size}
            height={size}
            loop
            showControls={false}
            backgroundColor="#ffffff"
          />
        )}

        {showVideo && (
          // All 37 published versions carry a source recording, served as a
          // short-lived signed Storage URL by /api/videos.
          <video
            key={gloss}
            className="h-full w-full object-cover"
            src={`/api/videos/${encodeURIComponent(gloss)}/source`}
            controls
            playsInline
            preload="metadata"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge tone="info">{gloss}</Badge>
        <button
          type="button"
          onClick={() => setShowVideo((v) => !v)}
          className="rounded-full border border-senyalita-border px-3 py-1 text-xs font-semibold text-senyalita-muted transition-colors hover:border-senyalita-primary/40 hover:text-senyalita-primary"
        >
          {showVideo ? "Show animation" : "Watch the recording"}
        </button>
      </div>
    </div>
  );
}
