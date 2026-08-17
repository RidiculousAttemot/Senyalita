"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, ScanSearch, Layers3, BrainCircuit, Wand2, Sparkles, Hand, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  icon: LucideIcon;
  label: string;
  detail: string;
  body: string;
}

const stages: Stage[] = [
  {
    icon: Camera,
    label: "Camera",
    detail: "Live webcam frame",
    body: "Frames are read straight from the browser's camera API and never leave the device — no video is uploaded, stored, or sent to a server.",
  },
  {
    icon: ScanSearch,
    label: "MediaPipe Holistic",
    detail: "Hand + pose tracking",
    body: "Google's MediaPipe locates both hands and the upper body in each frame, giving the model a consistent skeleton to reason about instead of raw pixels.",
  },
  {
    icon: Layers3,
    label: "Landmark Extraction",
    detail: "543 points / frame",
    body: "Each frame becomes 543 normalized 3D landmarks. Wrist-centering and max-abs scaling make the signal independent of where the signer sits or how far from the camera they are.",
  },
  {
    icon: BrainCircuit,
    label: "AI Recognition",
    detail: "Hybrid BiLSTM model",
    body: "A motion-aware router sends still handshapes to a lightweight static classifier and moving signs to a temporal BiLSTM, then fuses their confidence into one prediction.",
  },
  {
    icon: Wand2,
    label: "Translation Engine",
    detail: "Gloss + grammar rules",
    body: "Recognized signs are mapped through FSL gloss and grammar rules — FSL is its own language, not word-for-word English, so ordering and structure are adjusted here.",
  },
  {
    icon: Sparkles,
    label: "Animation Renderer",
    detail: "Skeletal playback",
    body: "For the reverse direction, gloss is resolved to recorded landmark clips and blended with coarticulation so signs flow into each other instead of snapping.",
  },
  {
    icon: Hand,
    label: "FSL Output",
    detail: "Signed on screen",
    body: "The result is rendered to canvas at 60 FPS with non-manual markers — the facial and posture cues that carry grammar in sign language.",
  },
];

export function ResearchPipelineSection() {
  const prefersReducedMotion = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const active = stages[selected];

  return (
    <section id="research" className="scroll-mt-20 bg-senyalita-surface px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">The research</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            From camera frame to signed word
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            Seven stages run in sequence, entirely in the browser. Select any stage
            to see what actually happens inside it.
          </p>
        </div>

        <div className="mt-16 overflow-x-auto pb-4">
          <div className="relative mx-auto flex min-w-[720px] max-w-6xl items-start justify-between px-4 lg:min-w-0">
            <div className="absolute left-0 right-0 top-7 h-px bg-senyalita-border" />
            <motion.div
              initial={prefersReducedMotion ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
              className="absolute left-0 right-0 top-7 h-px bg-gradient-to-r from-senyalita-primary to-senyalita-accent"
            />

            {stages.map((stage, i) => {
              const isActive = i === selected;
              return (
                <motion.button
                  key={stage.label}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={isActive}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : i * 0.12 }}
                  className="relative z-10 flex w-24 flex-col items-center rounded-xl px-1 py-2 text-center outline-none transition-colors hover:bg-senyalita-warm focus-visible:ring-2 focus-visible:ring-senyalita-primary/50"
                >
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm transition-all duration-300",
                      isActive
                        ? "scale-110 border-senyalita-primary bg-senyalita-primary text-white shadow-senyalita-primary/30"
                        : "border-senyalita-border bg-white text-senyalita-primary shadow-senyalita-dark/5",
                    )}
                  >
                    <stage.icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <p className={cn(
                    "mt-3 text-xs font-semibold leading-tight transition-colors",
                    isActive ? "text-senyalita-primary" : "text-senyalita-dark",
                  )}>
                    {stage.label}
                  </p>
                  <p className="mt-1 text-[0.6875rem] leading-tight text-senyalita-muted">{stage.detail}</p>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.label}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="rounded-2xl border border-senyalita-border bg-senyalita-warm p-6"
              aria-live="polite"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-senyalita-primary/10 text-[0.6875rem] font-bold text-senyalita-primary">
                  {selected + 1}
                </span>
                <h3 className="text-base font-semibold text-senyalita-dark">{active.label}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-senyalita-muted">{active.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
