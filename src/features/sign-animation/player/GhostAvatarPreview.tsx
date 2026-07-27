import { Skeleton } from "@/components/ui/skeleton";

const HAND_DOTS: Array<[number, number, number]> = [
  [38, 60, 0], [34, 52, 0.15], [36, 44, 0.3], [40, 38, 0.45], [44, 34, 0.6],
  [62, 60, 0.1], [66, 52, 0.25], [64, 44, 0.4], [60, 38, 0.55], [56, 34, 0.7],
];

interface GhostAvatarPreviewProps {
  label: string;
  sublabel?: string;
  className?: string;
}

/** Translucent placeholder avatar shown in place of an empty canvas while the
 * first animation clip is still loading — a "someone is about to sign here"
 * cue rather than a blank rectangle. */
export function GhostAvatarPreview({ label, sublabel, className }: GhostAvatarPreviewProps) {
  return (
    <div className={className} role="status" aria-live="polite">
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="relative h-40 w-40 animate-breathe-slow">
          <svg viewBox="0 0 100 100" className="h-full w-full text-senyalita-dark/20" aria-hidden="true">
            <circle cx="50" cy="24" r="14" fill="currentColor" />
            <path d="M28 92 Q28 54 50 54 Q72 54 72 92 Z" fill="currentColor" />
          </svg>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-senyalita-primary" aria-hidden="true">
            {HAND_DOTS.map(([x, y, delay], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2.2}
                fill="currentColor"
                className="animate-pulse-soft"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </svg>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-senyalita-muted">{label}</p>
          {sublabel && <p className="text-xs text-senyalita-muted/70">{sublabel}</p>}
          <Skeleton className="mt-1 h-1.5 w-32" />
        </div>
      </div>
    </div>
  );
}
