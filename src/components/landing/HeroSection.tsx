"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { LandmarkField } from "./LandmarkField";
import { RecognitionSequence } from "./RecognitionSequence";

export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden bg-senyalita-warm px-6 pb-20 pt-16 md:pb-28 md:pt-20 scroll-mt-16">
      <LandmarkField
        className="pointer-events-none absolute inset-0 h-full w-full text-senyalita-primary/70 opacity-[0.35]"
        density={34}
        seed={11}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-senyalita-warm via-senyalita-warm/95 to-senyalita-warm" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-senyalita-primary/20 bg-white px-4 py-1.5 text-sm font-medium text-senyalita-primary shadow-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-senyalita-accent" />
            AI-powered Filipino Sign Language
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-senyalita-dark sm:text-5xl lg:text-6xl"
          >
            Making Filipino Sign
            <br className="hidden sm:block" /> Language{" "}
            <span className="bg-gradient-to-r from-senyalita-primary to-senyalita-secondary bg-clip-text text-transparent">
              More Accessible
            </span>{" "}
            Through AI
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-senyalita-muted"
          >
            Recognize signs, translate text into Filipino Sign Language, and visualize
            natural signing using AI-powered landmark animation — built to bridge
            communication between Deaf, Hard-of-Hearing, and hearing Filipinos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/translate"
              className="group flex items-center justify-center gap-2 rounded-full bg-senyalita-primary px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-105"
            >
              Try Live Translation
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#showcase"
              className="flex items-center justify-center gap-2 rounded-full border border-senyalita-border bg-white px-7 py-3.5 text-sm font-semibold text-senyalita-text transition-colors hover:border-senyalita-primary/30 hover:text-senyalita-primary"
            >
              <PlayCircle className="h-4 w-4" />
              Watch Demo
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-senyalita-muted"
          >
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-senyalita-accent" /> No sign-up required
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-senyalita-border sm:block" />
            <span>On-device recognition</span>
            <span className="hidden h-1 w-1 rounded-full bg-senyalita-border sm:block" />
            <span>Privacy-first</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center lg:justify-end"
        >
          <RecognitionSequence id="recognition" />
        </motion.div>
      </div>
    </section>
  );
}
