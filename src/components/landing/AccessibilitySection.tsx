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

const items: AccessItem[] = [
  { icon: Contrast, title: "High Contrast UI", description: "Clear color separation designed to meet WCAG 2.1 AA contrast ratios throughout." },
  { icon: KeyRound, title: "Keyboard Navigation", description: "Every control is reachable and operable without a mouse or trackpad." },
  { icon: Smartphone, title: "Responsive Design", description: "A mobile-first layout that stays usable from a small phone to a wide desktop." },
  { icon: Type, title: "Readable Typography", description: "Generous type scale, spacing, and line lengths built for easy scanning." },
  { icon: Gauge, title: "Real-Time Feedback", description: "Confidence, latency, and recognition state are always visible, never hidden." },
  { icon: MonitorPlay, title: "Visual Sign Playback", description: "Every translation is rendered as a clear, controllable sign animation." },
];

const TEXT_SIZES = [
  { label: "Default", px: 15 },
  { label: "Large", px: 17 },
  { label: "Larger", px: 20 },
];

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
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Contrast</p>
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
                <span className="sr-only">Toggle high contrast preview</span>
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }} className="h-6 w-6 rounded-full bg-white" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Text size</p>
              <div className="flex gap-1.5">
                {TEXT_SIZES.map((s, i) => (
                  <button
                    key={s.label}
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
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="ml-auto max-w-[13rem] text-xs leading-relaxed text-slate-500">
              These controls are real — they change the whole app, and are kept
              on this device.
            </p>
          </div>

          {/* The sample that actually responds */}
          <div
            className={cn(
              "mt-6 rounded-2xl border p-5 transition-colors duration-300",
              highContrast ? "border-white bg-black" : "border-senyalita-border bg-white",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <span
                className={cn(
                  "font-mono font-bold tracking-wide transition-colors",
                  highContrast ? "text-white" : "text-senyalita-dark",
                )}
                style={{ fontSize: TEXT_SIZES[sizeIdx].px + 1 }}
              >
                KAMUSTA
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors",
                  highContrast ? "bg-white text-black" : "bg-senyalita-accent/10 text-senyalita-accent",
                )}
              >
                <Check className="h-3 w-3" /> 96% match
              </span>
            </div>
            <p
              className={cn("mt-2 leading-relaxed transition-colors", highContrast ? "text-slate-200" : "text-senyalita-muted")}
              style={{ fontSize: TEXT_SIZES[sizeIdx].px }}
            >
              Recognized sign, shown the way a user would see it during a conversation.
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
