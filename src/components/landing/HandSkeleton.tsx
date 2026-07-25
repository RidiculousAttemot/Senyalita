"use client";

import { cn } from "@/lib/utils";

// Approximate MediaPipe Hand Landmarker topology (21 points / 5 digits),
// normalized to a 100x100 box — mirrors the real rig this project runs
// in src/features/recognition, simplified for a decorative hero visual.
const POINTS: Record<number, [number, number]> = {
  0: [50, 88],
  1: [38, 78], 2: [28, 68], 3: [20, 58], 4: [14, 48],
  5: [42, 55], 6: [40, 38], 7: [39, 24], 8: [38, 12],
  9: [50, 52], 10: [50, 32], 11: [50, 16], 12: [50, 4],
  13: [58, 55], 14: [59, 36], 15: [60, 20], 16: [61, 8],
  17: [66, 60], 18: [69, 45], 19: [71, 32], 20: [73, 21],
};

const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

interface HandSkeletonProps {
  landmarksVisible: boolean;
  linesVisible: boolean;
  className?: string;
  tone?: "primary" | "accent";
}

export function HandSkeleton({ landmarksVisible, linesVisible, className, tone = "primary" }: HandSkeletonProps) {
  const color = tone === "accent" ? "#22C55E" : "#2563EB";

  return (
    <svg viewBox="0 0 100 100" className={cn("transition-opacity duration-500", className)} aria-hidden="true">
      <g
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        className="transition-opacity duration-500"
        style={{ opacity: linesVisible ? 0.85 : 0 }}
      >
        {CONNECTIONS.map(([a, b], i) => {
          const [x1, y1] = POINTS[a];
          const [x2, y2] = POINTS[b];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <g
        fill={color}
        className="transition-opacity duration-500"
        style={{ opacity: landmarksVisible ? 1 : 0 }}
      >
        {Object.entries(POINTS).map(([idx, [x, y]]) => (
          <circle
            key={idx}
            cx={x}
            cy={y}
            r={idx === "0" ? 2.6 : 1.9}
            className={landmarksVisible ? "animate-pulse-soft" : ""}
            style={{ animationDelay: `${(Number(idx) % 7) * 0.12}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
