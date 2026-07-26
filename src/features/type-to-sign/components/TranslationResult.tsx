"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

export interface TranslationEntry {
  gloss: string;
  original: string;
  fingerspelled: boolean;
}

export const PIPELINE_STAGES = [
  "Detecting language",
  "Normalizing",
  "Finding glosses",
  "Loading assets",
  "Generating animation",
  "Ready",
] as const;

interface TranslationResultProps {
  source: string;
  normalized: string;
  language: string;
  entries: TranslationEntry[];
  clipCount: number;
}

/**
 * Compact animated pipeline. Shown only while a translation is in flight, so
 * the page communicates progress without leaving a permanent checklist behind.
 */
export function TranslationPipeline({ activeStage }: { activeStage: number }) {
  return (
    <motion.section
      aria-label="Translation progress"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-[22px] border border-senyalita-border bg-white/80 p-5 backdrop-blur-xl"
    >
      <ol className="space-y-0.5">
        {PIPELINE_STAGES.map((label, i) => {
          const done = i < activeStage;
          const active = i === activeStage;
          return (
            <motion.li
              key={label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="flex items-center gap-2.5 py-1"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                  done
                    ? "bg-senyalita-accent text-white"
                    : active
                      ? "bg-senyalita-primary/15 text-senyalita-primary"
                      : "bg-slate-100 text-transparent"
                }`}
              >
                {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                {active && <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={3} />}
              </span>
              <span className={`text-[13px] transition-colors ${
                done || active ? "text-senyalita-dark" : "text-slate-400"
              }`}>
                {label}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}

export function TranslationResult({
  source, normalized, language, entries, clipCount,
}: TranslationResultProps) {
  const spelled = entries.filter((e) => e.fingerspelled);

  return (
    <motion.section
      aria-labelledby="translation-heading"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[28px] border border-senyalita-border bg-white/80 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-5">
        <h2 id="translation-heading" className="font-display text-lg font-bold tracking-tight text-senyalita-dark">
          Translation
        </h2>
        <span className="rounded-full border border-senyalita-accent/20 bg-senyalita-accent/10 px-2.5 py-1 text-[11px] font-semibold text-senyalita-accent">
          {language}
        </span>
      </div>

      <div className="space-y-2 px-6 py-4">
        <Stage index={0} label="Input">
          <p className="text-[15px] leading-snug text-senyalita-dark">{source}</p>
        </Stage>

        <Stage index={1} label="Normalized">
          <p className="font-mono text-[13px] leading-snug text-senyalita-muted">{normalized}</p>
        </Stage>

        <Stage index={2} label="FSL gloss">
          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry, i) => (
              <motion.span
                key={`${entry.gloss}-${i}`}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-[13px] font-bold tracking-wide ${
                  entry.fingerspelled
                    ? "bg-amber-100 text-amber-800"
                    : "bg-senyalita-primary/10 text-senyalita-primary"
                }`}
              >
                {entry.gloss}
              </motion.span>
            ))}
          </div>
        </Stage>

        <Stage index={3} label="Animation" last>
          <p className="text-[13px] text-senyalita-muted">
            <span className="font-semibold text-senyalita-dark">{clipCount}</span>{" "}
            {clipCount === 1 ? "sign" : "signs"} ready to play
          </p>
        </Stage>
      </div>

      {spelled.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="border-t border-senyalita-border/70 bg-amber-50/60 px-6 py-3 text-[12px] leading-relaxed text-amber-800"
        >
          <span className="font-semibold">Spelled letter by letter:</span>{" "}
          {spelled.map((e) => e.gloss).join(", ")} — no recorded sign for these yet.
        </motion.p>
      )}
    </motion.section>
  );
}

function Stage({
  index, label, last, children,
}: {
  index: number;
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-5"
    >
      {/* Connector line makes the stages read as one flow rather than four cards. */}
      {!last && <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-senyalita-border" />}
      <span aria-hidden="true" className="absolute left-0 top-[7px] h-2.5 w-2.5 rounded-full border-2 border-senyalita-primary/40 bg-white" />
      <div className="rounded-xl bg-slate-50/70 px-3 py-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-senyalita-muted">{label}</p>
        {children}
      </div>
    </motion.div>
  );
}
