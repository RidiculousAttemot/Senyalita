"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hand, PlayCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "./SpotlightCard";

/**
 * The landing page's entry point to /learn.
 *
 * This section replaces "Recognition" in the nav. That entry pointed at
 * #recognition, which is the id on <RecognitionSequence> INSIDE the hero --
 * so "Home" and "Recognition" scrolled to the same place and one of the six
 * nav items did nothing.
 *
 * The figures below are the real ones and are worth keeping honest, because
 * the distinction is the whole point of /learn: 37 signs have a recorded
 * animation you can play, while the camera recognises 131 classes. Those are
 * different sets, and a visitor who assumes every recognisable sign has a
 * video to study would be misled.
 */

const highlights = [
  {
    icon: PlayCircle,
    title: "37 signs you can play",
    description:
      "Every letter A–Z and the numbers 0–10 have a recorded animation, played back frame by frame from real signing.",
  },
  {
    icon: Hand,
    title: "131 classes recognised",
    description:
      "26 letters, 10 numbers and 95 phrase signs the camera can identify — a larger set than the recorded library.",
  },
  {
    icon: Search,
    title: "Search the whole vocabulary",
    description:
      "Filter by letter, number or phrase to see exactly what the system knows, and what it does not yet.",
  },
];

export function LearnSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="learn" className="scroll-mt-20 bg-senyalita-surface px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">
            Learn FSL
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            See every sign the system knows
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            A reference built from what is actually published, not a wish list. Play a sign
            back at your own pace, slow it down, and compare it against your own hands.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : i * 0.08 }}
            >
              <SpotlightCard
                className={cn(
                  "group h-full rounded-2xl border border-senyalita-border bg-white p-7",
                  "transition-all duration-300 hover:-translate-y-1 hover:border-senyalita-primary/25 hover:shadow-xl hover:shadow-senyalita-primary/10",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-senyalita-primary/10 to-senyalita-secondary/10 text-senyalita-primary transition-transform duration-300 group-hover:scale-110">
                  <item.icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-senyalita-dark">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-senyalita-muted">{item.description}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/learn"
            className={cn(
              "group inline-flex items-center gap-2 rounded-full bg-senyalita-primary px-7 py-3.5",
              "text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25",
              "transition-all duration-150 hover:brightness-110 hover:shadow-xl hover:shadow-senyalita-primary/35",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary",
            )}
          >
            Browse the sign library
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
