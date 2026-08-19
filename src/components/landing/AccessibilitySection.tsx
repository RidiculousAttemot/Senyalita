"use client";

import {
  TEXT_SIZES as ACCESSIBILITY_TEXT_SIZES,
  useAccessibility,
} from "@/features/accessibility/AccessibilityProvider";
import { motion, useReducedMotion } from "framer-motion";
import {
  Contrast, KeyRound, Smartphone, Type, Gauge, MonitorPlay, Accessibility, Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Every line here is meant to be checkable.
 *
 * The previous set was written as aspiration and read as fact. "Meets WCAG 2.1
 * AA contrast ratios throughout" was the worst of them: measured, the palette
 * does pass for body and muted text, but this very section was using
 * text-slate-500 on the dark background at 3.75:1 — below the 4.5:1 floor — so
 * the claim was being broken by the paragraph making it. It now uses
 * slate-400, which is 6.96:1 there. "Confidence, latency, and recognition
 * state are always visible" named a latency readout the public UI does not
 * have at all.
 *
 * The ratios below are measured against the real palette. If the tokens move,
 * these numbers are wrong and should move with them.
 */
const items: AccessItem[] = [
  {
    icon: Contrast,
    title: "High Contrast",
    description:
      "Body text sits at 14.6:1 on its surface. Turning contrast on lifts the lighter text to 18.7:1 and darkens the hairline borders.",
  },
  {
    icon: KeyRound,
    title: "Keyboard Navigation",
    description:
      "Every control is a real button or link with a visible focus ring — nothing here is a click handler bolted onto a div.",
  },
  {
    icon: Smartphone,
    title: "Responsive Design",
    description:
      "One layout from a 390px phone to a wide desktop, checked for sideways scrolling rather than assumed.",
  },
  {
    icon: Type,
    title: "Readable Typography",
    description:
      "Every size is set in rem, so the text control above, your browser zoom and your system font size all actually take effect.",
  },
  {
    icon: Gauge,
    title: "Honest Recognition",
    description:
      "The camera shows how confident it is as a percentage, and says plainly when it is still waiting for a steady sign.",
  },
  {
    icon: MonitorPlay,
    title: "Controllable Playback",
    description:
      "Pause, replay, change speed, or step sign by sign. A word with no recorded sign is fingerspelled rather than silently dropped.",
  },
];

/**
 * Labels only. These used to carry pixel sizes that the sample card applied
 * inline, which simulated the setting instead of using it — and once the
 * control became real, the card was scaling twice and disagreeing with the
 * rest of the page.
 */
const TEXT_SIZE_LABELS = ["Default", "Large", "Larger"] as const;

export function AccessibilitySection() {
  const prefersReducedMotion = useReducedMotion();
  // These are the real settings, not a preview.
  //
  // They were local useState beside the line "These controls are real. Watch
  // the sample below respond." — they moved the sample card and nothing else,
  // and were discarded on navigation. For a product whose stated audience is
  // Deaf and Hard-of-Hearing users, an accessibility control that only
  // pretends to work is worse than none at all.
  const { highContrast, setHighContrast, textSize, setTextSize } = useAccessibility();
  const sizeIdx = Math.max(0, ACCESSIBILITY_TEXT_SIZES.indexOf(textSize));

  return (
    <section id="accessibility" className="scroll-mt-20 bg-senyalita-dark px-6 py-24 text-white md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Accessibility className="h-6 w-6 text-senyalita-accent" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Designed for Accessibility
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Senyalita is built with Deaf and Hard-of-Hearing users first — everything
            else, including our own admin tools, has to earn its place around that.
          </p>
        </div>

        {/* Live demo — the claims above, actually working. */}
        <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Contrast</p>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                onClick={() => setHighContrast(!highContrast)}
                className={cn(
                  "flex h-8 w-14 items-center rounded-full border px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-senyalita-accent",
                  highContrast ? "justify-end border-senyalita-accent bg-senyalita-accent/30" : "justify-start border-white/20 bg-white/10",
                )}
              >
                <span className="sr-only">Toggle high contrast</span>
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }} className="h-6 w-6 rounded-full bg-white" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Text size</p>
              <div className="flex gap-1.5">
                {TEXT_SIZE_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setTextSize(ACCESSIBILITY_TEXT_SIZES[i])}
                    aria-pressed={i === sizeIdx}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-senyalita-accent",
                      i === sizeIdx
                        ? "border-senyalita-accent bg-senyalita-accent/15 text-white"
                        : "border-white/15 text-slate-400 hover:border-white/30 hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="ml-auto max-w-[13rem] text-xs leading-relaxed text-slate-400">
              These are the real settings, not a preview. They apply to every
              page and are remembered on this device.
            </p>
          </div>

          {/* The sample that actually responds */}
          <div className="mt-6 rounded-2xl border border-senyalita-border bg-white p-5 transition-colors duration-300">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[1rem] font-bold tracking-wide text-senyalita-dark">
                KAMUSTA
              </span>
              {/* Green on white is 2.28:1, so the label carries its own dark
                  ink rather than tinted text.

                  Reads "FSL gloss", not "96% match". The card demonstrates the
                  colour tokens; it does not recognise anything, and the figure
                  it used to show was a literal rather than a measurement. */}
              <span className="inline-flex items-center gap-1 rounded-full bg-senyalita-accent/15 px-2.5 py-1 text-[0.6875rem] font-semibold text-emerald-800">
                <Check className="h-3 w-3" /> FSL gloss
              </span>
            </div>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-senyalita-muted">
              A sign written as a gloss, on an ordinary surface. This card uses
              the same tokens as the rest of the app, so the controls above change it the
              way they change every other screen.
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : (i % 3) * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-senyalita-accent/30 hover:bg-white/[0.06]"
            >
              <item.icon className="h-5 w-5 text-senyalita-accent" strokeWidth={2} />
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
