"use client";

import { motion } from "framer-motion";
import { Contrast, KeyRound, Smartphone, Type, Gauge, MonitorPlay, Accessibility, type LucideIcon } from "lucide-react";

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

export function AccessibilitySection() {
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

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
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
