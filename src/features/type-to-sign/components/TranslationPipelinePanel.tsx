"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

export const PIPELINE_STEPS = [
  "Detecting language",
  "Normalising text",
  "Segmenting sentences",
  "Mapping to FSL glosses",
  "Optimising gloss order",
  "Loading motion assets",
  "Generating sign sequence",
] as const;

export type PipelineStepState = "pending" | "active" | "done";

interface TranslationPipelinePanelProps {
  states: PipelineStepState[];
  processingMs: number | null;
  visible: boolean;
}

export function TranslationPipelinePanel({ states, processingMs, visible }: TranslationPipelinePanelProps) {
  const done = states.filter((s) => s === "done").length;
  const progress = (done / PIPELINE_STEPS.length) * 100;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          aria-labelledby="pipeline-heading"
          aria-live="polite"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-fsl-border bg-fsl-surface p-5 shadow-[0_10px_30px_-20px_rgba(70,45,28,0.4)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="pipeline-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-fsl-muted">
                Translation pipeline
              </h2>
              <span className="text-[11px] tabular-nums text-fsl-faint">
                {processingMs !== null ? `${processingMs.toFixed(0)} ms` : `${done}/${PIPELINE_STEPS.length}`}
              </span>
            </div>

            <div className="mb-4 h-1 overflow-hidden rounded-full bg-fsl-sunken">
              <motion.div
                className="h-full rounded-full bg-fsl-teal"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>

            <ol className="space-y-0.5">
              {PIPELINE_STEPS.map((label, i) => {
                const state = states[i] ?? "pending";
                return (
                  <li key={label} className="flex items-center gap-2.5 py-1">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                        state === "done"
                          ? "bg-fsl-success text-white"
                          : state === "active"
                            ? "bg-fsl-teal-soft text-fsl-teal"
                            : "bg-fsl-sunken text-transparent"
                      }`}
                    >
                      {state === "done" && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                      {state === "active" && <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={3} />}
                    </span>
                    <span
                      className={`text-[13px] transition-colors ${
                        state === "pending" ? "text-fsl-faint" : "text-fsl-body"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
