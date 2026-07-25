"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { HandSkeleton } from "./HandSkeleton";

const PHRASE = "Kamusta ka?";
const GLOSS = ["KAMUSTA", "KA"];

const STEPS = ["Typing", "Gloss conversion", "Generating sign", "Playback"] as const;
const STEP_MS = 2100;

export function InteractiveShowcaseSection() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [playing]);

  const typed = step >= 0;
  const showGloss = step >= 1;
  const showSkeleton = step >= 2;
  const showPlayback = step >= 3;

  return (
    <section className="bg-senyalita-warm px-6 py-24 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">See it in motion</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            Watch text become sign
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            A live look at how Senyalita turns a written phrase into a Filipino Sign
            Language animation — the same pipeline running behind <em>Translate</em>.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-senyalita-border bg-white shadow-xl shadow-senyalita-dark/5">
          <div className="grid md:grid-cols-2">
            <div className="flex flex-col justify-center gap-6 border-b border-senyalita-border p-8 md:border-b-0 md:border-r md:p-10">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted">Input</span>
                <div className="mt-2 flex min-h-[3.25rem] items-center rounded-xl border border-senyalita-border bg-senyalita-warm px-4 py-3 font-medium text-senyalita-dark">
                  {typed &&
                    PHRASE.split("").map((char, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.045 }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, repeatType: "reverse" }}
                    className="ml-0.5 inline-block h-4 w-[2px] bg-senyalita-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-senyalita-border">
                <ArrowRight className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted">Gloss</span>
              </div>

              <div className="flex min-h-[2.5rem] flex-wrap gap-2">
                <AnimatePresence>
                  {showGloss &&
                    GLOSS.map((g, i) => (
                      <motion.span
                        key={g}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.12 }}
                        className="rounded-full bg-senyalita-primary/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-senyalita-primary"
                      >
                        {g}
                      </motion.span>
                    ))}
                </AnimatePresence>
              </div>

              <p className="text-sm leading-relaxed text-senyalita-muted">
                Senyalita&apos;s translation engine maps everyday Filipino phrases to FSL
                gloss sequences, then hands them to the animation renderer.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-senyalita-primary/5 to-senyalita-accent/5 p-8 md:p-10">
              <div className="relative aspect-square w-full max-w-[260px]">
                <HandSkeleton
                  landmarksVisible={showSkeleton}
                  linesVisible={showSkeleton}
                  tone="accent"
                  className="h-full w-full"
                />
              </div>

              <div className="flex w-full max-w-[260px] items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause showcase" : "Play showcase"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-senyalita-dark text-white transition-transform hover:scale-105"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-senyalita-border">
                  <motion.div
                    key={step}
                    initial={{ width: "0%" }}
                    animate={{ width: playing ? "100%" : `${(step / (STEPS.length - 1)) * 100}%` }}
                    transition={{ duration: playing ? STEP_MS / 1000 : 0.2, ease: "linear" }}
                    className="h-full bg-senyalita-accent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {STEPS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      i === step ? "bg-senyalita-dark text-white" : "text-senyalita-muted hover:bg-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {showPlayback && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-medium text-senyalita-accent"
                >
                  Sign complete — &quot;Kamusta ka?&quot; = &quot;How are you?&quot;
                </motion.p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
