"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ScanLine, Languages, Layers3, BookOpen, Database, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "./SpotlightCard";
import { MODEL_LABELS } from "@/lib/admin/modelLabels";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: ScanLine,
    title: "Live Sign Recognition",
    description: "Recognize Filipino Sign Language in real time using your webcam — no download required.",
  },
  {
    icon: Languages,
    title: "AI Translation",
    description: "Convert spoken or written Filipino and English into natural Filipino Sign Language.",
  },
  {
    icon: Layers3,
    title: "Landmark Animation",
    // "not stiff pre-recorded clips" was backwards, and the two landing panels
    // now say so out loud: both play recorded landmark data and caption it as
    // such. The real distinction is skeleton versus video -- the landmarks are
    // recorded from a signer, then drawn, which is why playback is a few
    // hundred KB of coordinates instead of a video stream.
    description: "Visualize signs as MediaPipe skeletal animation, drawn from landmarks recorded from a signer rather than replayed as video.",
  },
  {
    icon: BookOpen,
    // Was "Learning Mode ... guided, interactive lessons". /learn is a
    // reference you browse and replay, not a lesson plan -- promising
    // coursework that does not exist is the kind of claim a visitor checks.
    title: "Sign Library",
    description: "Browse and replay every recorded sign — the alphabet, numbers, and the phrase list the camera knows.",
  },
  {
    icon: Database,
    // Was "Dataset Builder -- every contributed recording helps expand the
    // model". There is no public contribution path; recordings are ingested
    // by an admin, so this invited visitors to do something they cannot.
    title: "Research Dataset",
    // Derived: retraining changes this, and a literal would not notice.
    description: `Trained on ${MODEL_LABELS.length} sign classes extracted from recorded FSL video, with the pipeline documented end to end.`,
  },
  {
    icon: Settings,
    // Was "Admin Studio". The admin is a local-only authoring tool and
    // returns 404 on the deployed site, so advertising it to visitors
    // pointed at a door that is not there. /evaluation is public and real.
    title: "Live Evaluation",
    description: "Measure recognition accuracy yourself, class by class, against the same model the app runs on.",
  },
];

export function FeatureJourneySection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="features" className="scroll-mt-20 bg-senyalita-surface px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">What Senyalita does</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            One platform, the whole signing journey
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            From a first-time learner practicing the alphabet to real-time conversation
            between Deaf and hearing users — every step is built around clear,
            human communication.
          </p>
        </div>

        <div className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : (i % 3) * 0.08 }}
            >
              <SpotlightCard
                className={cn(
                  "group h-full rounded-2xl border border-senyalita-border bg-white p-7",
                  "transition-all duration-300 hover:-translate-y-1 hover:border-senyalita-primary/25 hover:shadow-xl hover:shadow-senyalita-primary/10",
                )}
              >
                {/*
                  Decorative watermark, not content. It measured 1.23:1 against a
                  3:1 floor for large text -- which is the design intent: it sits at
                  border-tone and stays at 15% opacity even on hover. The ordinal it
                  shows is already carried by the card's position, so hiding it from
                  assistive tech loses nothing and makes the contrast exemption
                  explicit rather than accidental.
                */}
                <span aria-hidden="true" className="absolute right-5 top-5 font-display text-3xl font-bold text-senyalita-border transition-colors group-hover:text-senyalita-primary/15">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-senyalita-primary/10 to-senyalita-secondary/10 text-senyalita-primary transition-transform duration-300 group-hover:scale-110">
                  <feature.icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-senyalita-dark">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-senyalita-muted">{feature.description}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
