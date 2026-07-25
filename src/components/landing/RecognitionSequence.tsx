"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hand, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HandSkeleton } from "./HandSkeleton";

const STAGES = [
  { label: "Capturing", detail: "Camera feed active" },
  { label: "Detecting landmarks", detail: "MediaPipe Hand Landmarker" },
  { label: "Mapping skeleton", detail: "21-point hand rig" },
  { label: "Recognizing sign", detail: "Confidence 96%" },
  { label: "Translating", detail: "Gloss: KAMUSTA" },
  { label: "Rendering FSL output", detail: "Playing animation" },
] as const;

const STAGE_MS = 1700;

export function RecognitionSequence({ id }: { id?: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), STAGE_MS);
    return () => clearInterval(t);
  }, []);

  const landmarksVisible = stage >= 1;
  const linesVisible = stage >= 2;
  const recognized = stage >= 3;
  const translating = stage >= 4;
  const rendering = stage === 5;

  return (
    <div id={id} className="relative w-full max-w-md scroll-mt-28">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-senyalita-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-senyalita-accent" />
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={STAGES[stage].label}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted"
            >
              {STAGES[stage].label}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s.label}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === stage ? "w-4 bg-senyalita-primary" : "w-1.5 bg-senyalita-border",
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative aspect-square overflow-hidden rounded-3xl border border-senyalita-border bg-gradient-to-br from-white to-senyalita-warm shadow-xl shadow-senyalita-dark/5">
        <div className="absolute inset-0 flex items-center justify-center">
          <Hand className="h-40 w-40 text-senyalita-primary/10" strokeWidth={1.5} />
        </div>

        <div className="absolute inset-[18%]">
          <HandSkeleton
            landmarksVisible={landmarksVisible}
            linesVisible={linesVisible}
            tone={rendering ? "accent" : "primary"}
            className="h-full w-full"
          />
        </div>

        {recognized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-4 top-4 rounded-full border border-senyalita-accent/30 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-senyalita-accent shadow-sm backdrop-blur"
          >
            96% match
          </motion.div>
        )}

        <AnimatePresence>
          {translating && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-senyalita-border bg-white px-4 py-2.5 shadow-lg"
            >
              {rendering && <Volume2 className="h-4 w-4 shrink-0 text-senyalita-accent" />}
              <div className="text-center leading-tight">
                <p className="text-sm font-bold text-senyalita-dark">Kamusta</p>
                <p className="text-[11px] text-senyalita-muted">{rendering ? "Playing FSL animation" : "Hello — recognized"}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-3 px-1 text-xs text-senyalita-muted">{STAGES[stage].detail} &middot; loops continuously</p>
    </div>
  );
}
