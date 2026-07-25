"use client";

import { motion } from "framer-motion";
import { ArrowDown, SpellCheck } from "lucide-react";
import type { AnimationClip } from "@/features/sign-animation/types";

export interface BreakdownEntry {
  gloss: string;
  original: string;
  fingerspelled: boolean;
}

interface TranslationBreakdownProps {
  original: string;
  normalized: string;
  entries: BreakdownEntry[];
  clips: AnimationClip[];
}

function Stage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-fsl-faint">{label}</p>
      {children}
    </div>
  );
}

export function TranslationBreakdown({ original, normalized, entries, clips }: TranslationBreakdownProps) {
  const arrow = (
    <div className="flex justify-center py-1.5" aria-hidden="true">
      <ArrowDown className="h-3.5 w-3.5 text-fsl-faint" />
    </div>
  );

  return (
    <section
      aria-labelledby="breakdown-heading"
      className="rounded-2xl border border-fsl-border bg-fsl-surface p-5 shadow-[0_10px_30px_-20px_rgba(70,45,28,0.4)]"
    >
      <h2 id="breakdown-heading" className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-fsl-muted">
        Translation breakdown
      </h2>

      <Stage label="Input">
        <p className="text-[15px] leading-snug text-fsl-ink">{original}</p>
      </Stage>

      {arrow}

      <Stage label="Normalised">
        <p className="font-mono text-[13px] leading-snug text-fsl-body">{normalized}</p>
      </Stage>

      {arrow}

      <Stage label="FSL gloss">
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry, i) => (
            <motion.span
              key={`${entry.gloss}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035, duration: 0.2 }}
              className={`rounded-md px-2 py-1 font-mono text-xs font-semibold ${
                entry.fingerspelled
                  ? "bg-fsl-amber-soft text-fsl-amber"
                  : "bg-fsl-teal-soft text-fsl-teal"
              }`}
            >
              {entry.gloss}
            </motion.span>
          ))}
        </div>
      </Stage>

      {entries.some((e) => e.fingerspelled) && (
        <>
          {arrow}
          <Stage label="Fingerspelling">
            <div className="space-y-2">
              {entries.filter((e) => e.fingerspelled).map((entry, i) => (
                <div key={`${entry.gloss}-fs-${i}`} className="rounded-lg border border-fsl-amber-soft bg-fsl-amber-soft/50 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <SpellCheck className="h-3.5 w-3.5 shrink-0 text-fsl-amber" />
                    <span className="text-[11px] font-semibold text-fsl-amber">
                      No motion capture for {entry.gloss} — spelled letter by letter
                    </span>
                  </div>
                  <div className="space-y-1">
                    {entry.gloss.split(/\s+/).map((word, wi) => (
                      <div key={`${word}-${wi}`} className="flex flex-wrap items-center gap-1">
                        {word.split("").map((letter, li) => (
                          <span key={`${letter}-${li}`} className="flex items-center gap-1">
                            {li > 0 && <span className="text-fsl-faint" aria-hidden="true">→</span>}
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-white font-mono text-[11px] font-bold text-fsl-amber ring-1 ring-inset ring-fsl-amber/25">
                              {letter}
                            </span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Stage>
        </>
      )}

      {arrow}

      <Stage label={`Animation · ${clips.length} clip${clips.length === 1 ? "" : "s"}`}>
        <ol className="flex flex-wrap gap-1.5">
          {clips.map((clip, i) => (
            <li
              key={clip.id}
              className="flex items-center gap-1.5 rounded-md border border-fsl-border bg-fsl-raised px-2 py-1"
            >
              <span className="font-mono text-[10px] tabular-nums text-fsl-faint">{i + 1}</span>
              <span className="font-mono text-xs font-semibold text-fsl-ink">{clip.gesture}</span>
              <span className="text-[10px] tabular-nums text-fsl-faint">
                {(clip.asset.duration / 1000).toFixed(1)}s
              </span>
            </li>
          ))}
        </ol>
      </Stage>
    </section>
  );
}
