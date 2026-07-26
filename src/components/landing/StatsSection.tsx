"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Radio } from "lucide-react";

interface StatDef {
  target: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

const stats: StatDef[] = [
  { target: 131, label: "Sign Classes Recognized" },
  { target: 94.86, decimals: 2, suffix: "%", label: "Test Recognition Accuracy" },
  { target: 543, suffix: "+", label: "Landmark Points per Frame" },
  { target: 60, suffix: " FPS", label: "Animation Playback" },
  { target: 165, suffix: "ms", label: "Avg. Recognition Latency" },
];

function AnimatedStat({ stat }: { stat: StatDef }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // Counting up is the whole point of the effect — with reduced motion we
    // just show the final figure rather than animating to it.
    if (prefersReducedMotion) {
      setValue(stat.target);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(stat.target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, stat.target, prefersReducedMotion]);

  return (
    <span ref={ref}>
      {stat.prefix}
      {value.toFixed(stat.decimals ?? 0)}
      {stat.suffix}
    </span>
  );
}

export function StatsSection() {
  const prefersReducedMotion = useReducedMotion();
  const rise = prefersReducedMotion ? false : { opacity: 0, y: 20 };

  return (
    <section className="bg-senyalita-warm px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">By the numbers</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            Measured, not just claimed
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={rise}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : (i % 3) * 0.08 }}
              className="rounded-2xl border border-senyalita-border bg-white p-7 text-center shadow-sm shadow-senyalita-dark/5"
            >
              <p className="font-display text-4xl font-bold tracking-tight text-senyalita-dark">
                <AnimatedStat stat={stat} />
              </p>
              <p className="mt-2 text-sm font-medium text-senyalita-muted">{stat.label}</p>
            </motion.div>
          ))}

          <motion.div
            initial={rise}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : 0.4 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-senyalita-primary/20 bg-gradient-to-br from-senyalita-primary to-senyalita-secondary p-7 text-center text-white shadow-lg shadow-senyalita-primary/20"
          >
            <Radio className="h-6 w-6 animate-pulse-soft" />
            <p className="mt-3 font-display text-2xl font-bold tracking-tight">Real-Time Translation</p>
            <p className="mt-1 text-sm text-white/80">Signed and spoken, in sync</p>
          </motion.div>
        </div>

        <p className="mt-6 text-center text-xs text-senyalita-muted">
          Model benchmarks from the current production BiLSTM model (131 classes, 26 alphabet + 105 phrases).
        </p>
      </div>
    </section>
  );
}
