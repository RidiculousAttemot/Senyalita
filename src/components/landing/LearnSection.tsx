"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hand, PlayCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "./SpotlightCard";
import { MODEL_LABELS } from "@/lib/admin/modelLabels";
import { partitionLabels } from "@/features/recognition/labelPartition";

/**
 * The landing page's entry point to /learn.
 *
 * This section replaces "Recognition" in the nav. That entry pointed at
 * #recognition, which is the id on <SignPlaybackDemo> INSIDE the hero --
 * so "Home" and "Recognition" scrolled to the same place and one of the six
 * nav items did nothing.
 *
 * The figures below are the real ones and are worth keeping honest, because
 * the distinction is the whole point of /learn: only some signs have a recorded
 * animation you can play, while the camera recognises every model class. Both
 * counts are derived below rather than written down. Those are
 * different sets, and a visitor who assumes every recognisable sign has a
 * video to study would be misled.
 */

/** Split from the model's own labels, never restated. See StatsSection. */
const PARTITION = partitionLabels(MODEL_LABELS);

/**
 * Both counts are derived, and they are deliberately different sets.
 *
 * The recorded count comes from the database, because publishing changes it;
 * the recognised count comes from the model's labels, because retraining
 * changes it. Writing either one down is what went wrong before: "37 signs you
 * can play" was true until the 91-sign batch, and then it was on the landing
 * page being wrong by a factor of three and a half.
 */
function highlightsFor(publishedSignCount: number | null) {
  return [
    {
      icon: PlayCircle,
      title: publishedSignCount === null
        ? "Signs you can play"
        : `${publishedSignCount} signs you can play`,
      description:
        "Each one has a recorded animation, played back frame by frame from the landmarks of real signing.",
    },
    {
      icon: Hand,
      title: `${MODEL_LABELS.length} classes recognised`,
      description:
        `${PARTITION.letters.length} letters, ${PARTITION.numbers.length} numbers and `
        + `${PARTITION.phrases.length} phrase signs the camera can identify — a different set from the recorded library.`,
    },
    {
      icon: Search,
      title: "Search the whole vocabulary",
      description:
        "Filter by letter, number or phrase to see exactly what the system knows, and what it does not yet.",
    },
  ];
}

export function LearnSection({ publishedSignCount }: { publishedSignCount: number | null }) {
  const prefersReducedMotion = useReducedMotion();
  const highlights = highlightsFor(publishedSignCount);

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
