"use client";

import { motion } from "framer-motion";
import { Camera, ScanSearch, Layers3, BrainCircuit, Wand2, Sparkles, Hand, type LucideIcon } from "lucide-react";

interface Stage {
  icon: LucideIcon;
  label: string;
  detail: string;
}

const stages: Stage[] = [
  { icon: Camera, label: "Camera", detail: "Live webcam frame" },
  { icon: ScanSearch, label: "MediaPipe Holistic", detail: "Hand + pose tracking" },
  { icon: Layers3, label: "Landmark Extraction", detail: "543 points / frame" },
  { icon: BrainCircuit, label: "AI Recognition", detail: "Hybrid BiLSTM model" },
  { icon: Wand2, label: "Translation Engine", detail: "Gloss + grammar rules" },
  { icon: Sparkles, label: "Animation Renderer", detail: "Skeletal playback" },
  { icon: Hand, label: "FSL Output", detail: "Signed on screen" },
];

export function ResearchPipelineSection() {
  return (
    <section id="research" className="scroll-mt-20 bg-senyalita-surface px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">The research</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            From camera frame to signed word
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            Seven stages run in sequence, entirely in the browser, to turn a hand
            movement into recognized language — and back again.
          </p>
        </div>

        <div className="mt-16 overflow-x-auto pb-4">
          <div className="relative mx-auto flex min-w-[720px] max-w-6xl items-start justify-between px-4 lg:min-w-0">
            <div className="absolute left-0 right-0 top-7 h-px bg-senyalita-border" />
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
              className="absolute left-0 right-0 top-7 h-px bg-gradient-to-r from-senyalita-primary to-senyalita-accent"
            />

            {stages.map((stage, i) => (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="relative z-10 flex w-24 flex-col items-center text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-senyalita-border bg-white shadow-sm shadow-senyalita-dark/5">
                  <stage.icon className="h-6 w-6 text-senyalita-primary" strokeWidth={2} />
                </div>
                <p className="mt-3 text-xs font-semibold leading-tight text-senyalita-dark">{stage.label}</p>
                <p className="mt-1 text-[11px] leading-tight text-senyalita-muted">{stage.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
