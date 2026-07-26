"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";

interface LandmarkFieldProps {
  className?: string;
  density?: number;
  seed?: number;
}

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Subtle MediaPipe-inspired dot-and-joint network used as a decorative
 * backdrop. Pure CSS/SVG, no canvas — cheap enough to sit behind hero text.
 */
export function LandmarkField({ className, density = 26, seed = 7 }: LandmarkFieldProps) {
  const prefersReducedMotion = useReducedMotion();

  const nodes = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: density }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      r: 1.4 + rand() * 1.8,
      delay: rand() * 4,
      duration: 2.5 + rand() * 2.5,
    }));
  }, [density, seed]);

  const edges = useMemo(() => {
    const result: Array<{ a: (typeof nodes)[number]; b: (typeof nodes)[number]; delay: number }> = [];
    nodes.forEach((a, i) => {
      const b = nodes[(i + 1) % nodes.length];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 34) result.push({ a, b, delay: (a.delay + b.delay) / 2 });
    });
    return result;
  }, [nodes]);

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {edges.map(({ a, b, delay }, i) => (
        <line
          key={i}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="currentColor"
          strokeWidth="0.15"
          strokeOpacity="0.35"
          pathLength={1}
          strokeDasharray={1}
          className={prefersReducedMotion ? undefined : "animate-draw-line"}
          style={prefersReducedMotion ? undefined : { animationDelay: `${delay * 0.4}s` }}
        />
      ))}
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r={n.r * 0.35}
          fill="currentColor"
          className={prefersReducedMotion ? undefined : "animate-pulse-soft"}
          style={prefersReducedMotion ? undefined : { animationDelay: `${n.delay}s`, animationDuration: `${n.duration}s` }}
        />
      ))}
    </svg>
  );
}
