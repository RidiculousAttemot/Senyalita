"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which section is currently in view. Uses a top-biased rootMargin so
 * a section counts as "active" once it reaches the upper third of the
 * viewport, which matches how people read a scrolling page.
 */
export function useScrollSpy(sectionIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        });

        if (visible.size === 0) return;
        // Whichever tracked section occupies the most of the band wins.
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
        setActiveId(best[0]);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}
