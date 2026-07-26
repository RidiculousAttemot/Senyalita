"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Card that tracks the pointer to render a soft radial highlight. The glow is
 * decorative only — it never encodes information, and it's simply absent for
 * keyboard and touch users, who get the standard focus/hover styling instead.
 */
export function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onPointerLeave={() => setPos(null)}
      className={cn("relative overflow-hidden", className)}
    >
      {pos && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(280px circle at ${pos.x}px ${pos.y}px, rgba(37,99,235,0.07), transparent 70%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
