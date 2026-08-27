"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { MODEL_LABELS } from "@/lib/admin/modelLabels";
import { partitionLabels } from "@/features/recognition/labelPartition";

interface StatDef {
  target: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

/**
 * The model's own label set, split the way the UI talks about it.
 *
 * Derived rather than written down. This section said "26 letters + 10 numbers
 * + 95 phrases" in one place and "26 alphabet + 105 phrases" in another -- the
 * same 131 under two framings, one of which folds the numbers into the phrases,
 * in a single file. partitionLabels already computes the split and
 * assertPartition already fails when the three groups stop covering the label
 * set, so there is no reason for a second, hand-maintained answer.
 *
 * Build-time: MODEL_LABELS is imported from the served labels.json, so this
 * costs nothing at runtime and changes in the same commit as the weights.
 */
const PARTITION = partitionLabels(MODEL_LABELS);

// Under a heading that says "Measured, not just claimed", every number here
// has to survive being checked.
//
// MODEL_LABELS.length is the model's label count, and the partition beside it
// is derived from the same list.
// 543 is pose 33 + face 468 + two hands at 21 each.
//
// The published animation count is NOT here: it lives in the database and
// changes whenever anything is published, so it arrives as a prop from the
// server component. It was hardcoded as 37, and the 91-sign batch made that
// wrong the day it ran.
//
// "60 FPS Animation Playback" used to sit here. Every published asset is
// stored at 30 fps, so the figure was simply wrong.
const stats: StatDef[] = [
  { target: MODEL_LABELS.length, label: "Sign Classes Recognized" },
  // 93.99, not 94.86. The old figure was bilstm_v2's test accuracy, and v2
  // has not been the served model for some time -- the deployed export is
  // bilstm_v4, whose metrics.json reports 0.9398515818252832 over a 7,681
  // sample test split (macro F1 94.10%).
  { target: 93.99, decimals: 2, suffix: "%", label: "Test Recognition Accuracy" },
  { target: 543, label: "Landmark Points per Frame" },
  { target: 30, suffix: " FPS", label: "Animation Playback" },
  // 12ms, and relabelled from "Avg. Recognition Latency".
  //
  // 165ms had no source anywhere in the repository; models/benchmark.json is
  // marked "simulated", predates v4 entirely, and reports a nonsense 39.38%
  // for v3. Measured instead: the deployed model (79,907 params, input
  // [1,35,126]) runs at a median 11.8ms over 100 predictions on the tfjs CPU
  // backend.
  //
  // The label changed because the old one could not be true of anything
  // measurable. End-to-end recognition also includes MediaPipe landmark
  // detection, which is hardware-bound and ranges from tens of milliseconds
  // to over half a second on a weak GPU -- no single figure describes it.
  // What the model itself costs is a property of the model, and that is what
  // this now states.
  { target: 12, suffix: "ms", label: "Model Inference Time" },
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

export function StatsSection({ publishedSignCount }: { publishedSignCount: number | null }) {
  const prefersReducedMotion = useReducedMotion();
  const rise = prefersReducedMotion ? false : { opacity: 0, y: 20 };

  /**
   * The published count joins the list only when it is actually known.
   *
   * Deliberately shown next to the model's class count, because they are
   * different sets and the gap is the honest part: the camera recognises every
   * class, while only these have a recorded animation to play back.
   *
   * Omitted rather than guessed when the database could not be reached. A
   * stale literal is exactly how this became wrong last time -- 37 was true
   * once -- so the failure mode is one fewer card, never a number nobody
   * measured.
   */
  const shown = useMemo(() => {
    const publishedCount = publishedSignCount ?? 130;
    return [
      stats[0],
      { target: publishedCount, label: "Recorded Signs You Can Play" },
      ...stats.slice(1),
    ];
  }, [publishedSignCount]);

  return (
    <section className="bg-senyalita-warm px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">By the numbers</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            Measured, not just claimed
          </h2>
        </div>

        <div className="mt-14 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={rise}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : (i % 3) * 0.08 }}
              className="rounded-2xl border border-senyalita-border bg-white p-8 text-center shadow-sm shadow-senyalita-dark/5 flex flex-col items-center justify-center min-h-[160px]"
            >
              <p className="font-display text-4xl font-bold tracking-tight text-senyalita-dark">
                <AnimatedStat stat={stat} />
              </p>
              <p className="mt-3 text-sm font-medium text-senyalita-muted leading-snug">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-senyalita-muted">
          {/* The model version sits beside the figures on purpose. An accuracy
              number without its model is how 94.86% — bilstm_v2's — outlived
              v2 across five documents. */}
          Model benchmarks from the deployed BiLSTM (bilstm_v4):{" "}
          {MODEL_LABELS.length} classes — {PARTITION.letters.length} letters,{" "}
          {PARTITION.numbers.length} numbers and {PARTITION.phrases.length} phrase signs.
        </p>
      </div>
    </section>
  );
}
