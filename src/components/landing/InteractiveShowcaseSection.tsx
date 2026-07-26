"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Loader2, Pause, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { HandSkeleton } from "./HandSkeleton";

type PipelineFn = (text: string) => {
  glossSequence: Array<{ gloss: string; original: string; strategy: string }>;
  language: { language: "en" | "tl" | "mixed" };
  totalProcessingTimeMs: number;
};

const DEMO_PHRASE = "Kamusta ka?";
const DEMO_GLOSS = ["KAMUSTA", "KA"];
const EXAMPLES = ["Kamusta ka?", "Salamat po", "Mahal kita", "Good morning"];

const STEPS = ["Reading text", "Detecting language", "Mapping to FSL", "Signing"] as const;
const STEP_MS = 2100;

const LANGUAGE_LABEL: Record<string, string> = { en: "English", tl: "Filipino", mixed: "Mixed" };

export function InteractiveShowcaseSection() {
  const prefersReducedMotion = useReducedMotion();

  // --- Ambient demo loop (runs until the visitor takes over) ---
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  // --- Live mode (visitor typed something) ---
  const [input, setInput] = useState("");
  const [liveGloss, setLiveGloss] = useState<string[] | null>(null);
  const [liveMeta, setLiveMeta] = useState<{ language: string; ms: number } | null>(null);
  const [engineState, setEngineState] = useState<"idle" | "loading" | "ready" | "failed">("idle");

  const pipelineRef = useRef<PipelineFn | null>(null);
  const isLive = liveGloss !== null;

  useEffect(() => {
    if (!playing || isLive || prefersReducedMotion) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [playing, isLive, prefersReducedMotion]);

  /** The real translation engine is pulled in only once a visitor actually
   * engages, so it never weighs down the landing page's first load. */
  const ensureEngine = useCallback(async (): Promise<PipelineFn | null> => {
    if (pipelineRef.current) return pipelineRef.current;
    setEngineState("loading");
    try {
      const { globalPipeline } = await import("@/features/translation-pipeline");
      const fn = ((text: string) => globalPipeline.translate(text)) as PipelineFn;
      pipelineRef.current = fn;
      setEngineState("ready");
      return fn;
    } catch {
      setEngineState("failed");
      return null;
    }
  }, []);

  const runTranslation = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setLiveGloss(null);
      setLiveMeta(null);
      return;
    }
    const pipeline = await ensureEngine();
    if (!pipeline) return;
    try {
      const result = pipeline(trimmed);
      setLiveGloss(result.glossSequence.map((g) => g.gloss));
      setLiveMeta({
        language: LANGUAGE_LABEL[result.language.language] ?? "Detected",
        ms: result.totalProcessingTimeMs,
      });
    } catch {
      setEngineState("failed");
    }
  }, [ensureEngine]);

  // Translate as the visitor types, once they pause briefly.
  useEffect(() => {
    if (!input.trim()) {
      setLiveGloss(null);
      setLiveMeta(null);
      return;
    }
    const timer = setTimeout(() => runTranslation(input), 350);
    return () => clearTimeout(timer);
  }, [input, runTranslation]);

  const shownPhrase = isLive ? input.trim() : DEMO_PHRASE;
  const shownGloss = liveGloss ?? DEMO_GLOSS;
  const showSkeleton = isLive || step >= 2 || Boolean(prefersReducedMotion);
  const showGloss = isLive || step >= 1 || Boolean(prefersReducedMotion);

  return (
    <section id="showcase" className="scroll-mt-20 bg-senyalita-warm px-6 py-24 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">Try it yourself</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            Type anything. Watch it become sign.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            This runs Senyalita&apos;s real translation engine, right here on the page —
            the same one behind <em>Translate</em>. No sign-up, nothing to install.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-senyalita-border bg-white shadow-xl shadow-senyalita-dark/5">
          <div className="grid md:grid-cols-2">
            <div className="flex flex-col gap-5 border-b border-senyalita-border p-8 md:border-b-0 md:border-r md:p-10">
              <div>
                <label htmlFor="showcase-input" className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted">
                  Your message
                </label>
                <div className="relative mt-2">
                  <input
                    id="showcase-input"
                    type="text"
                    value={input}
                    maxLength={80}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => ensureEngine()}
                    placeholder={DEMO_PHRASE}
                    className="w-full rounded-xl border border-senyalita-border bg-senyalita-warm px-4 py-3 pr-10 font-medium text-senyalita-dark outline-none transition-colors placeholder:text-senyalita-muted/60 focus:border-senyalita-primary focus:bg-white focus:ring-2 focus:ring-senyalita-primary/20"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-senyalita-muted/50">
                    {engineState === "loading"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <CornerDownLeft className="h-4 w-4" />}
                  </span>
                </div>
                {!isLive && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setInput(ex)}
                        onMouseEnter={() => ensureEngine()}
                        className="rounded-full border border-senyalita-border bg-white px-2.5 py-1 text-[11px] font-medium text-senyalita-muted transition-colors hover:border-senyalita-primary/40 hover:text-senyalita-primary"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-senyalita-border">
                <ArrowRight className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted">
                  FSL gloss
                </span>
                {isLive && liveMeta && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-senyalita-accent/10 px-2 py-0.5 text-[10px] font-semibold text-senyalita-accent">
                    <Sparkles className="h-3 w-3" />
                    {liveMeta.language} · {liveMeta.ms.toFixed(0)}ms
                  </span>
                )}
              </div>

              <div className="flex min-h-[2.5rem] flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {showGloss &&
                    shownGloss.map((g, i) => (
                      <motion.span
                        key={`${g}-${i}`}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.22, delay: prefersReducedMotion ? 0 : i * 0.05 }}
                        className="rounded-full bg-senyalita-primary/10 px-3.5 py-1.5 text-xs font-bold tracking-wide text-senyalita-primary"
                      >
                        {g}
                      </motion.span>
                    ))}
                </AnimatePresence>
                {showGloss && shownGloss.length === 0 && (
                  <span className="text-xs text-senyalita-muted">No signs matched — try simpler words.</span>
                )}
              </div>

              <p className="text-sm leading-relaxed text-senyalita-muted">
                {engineState === "failed"
                  ? "The live engine could not start here — the full experience is available in the app."
                  : isLive
                    ? "Senyalita mapped your words to FSL gloss. Open the app to watch the full signed animation."
                    : "Senyalita's engine maps everyday Filipino and English to FSL gloss, then hands it to the animation renderer."}
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
                {isLive && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute inset-x-0 bottom-0 text-center"
                  >
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-senyalita-dark shadow-sm backdrop-blur">
                      {shownGloss.length} sign{shownGloss.length === 1 ? "" : "s"} ready
                    </span>
                  </motion.div>
                )}
              </div>

              {isLive ? (
                <a
                  href="/translate"
                  className="group flex items-center gap-2 rounded-full bg-senyalita-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-senyalita-primary/25 transition-all hover:shadow-lg hover:brightness-105"
                >
                  Watch it signed
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <>
                  <div className="flex w-full max-w-[260px] items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? "Pause demo" : "Play demo"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-senyalita-dark text-white transition-transform hover:scale-105"
                    >
                      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-senyalita-border">
                      <motion.div
                        key={step}
                        initial={{ width: "0%" }}
                        animate={{ width: playing && !prefersReducedMotion ? "100%" : `${(step / (STEPS.length - 1)) * 100}%` }}
                        transition={{ duration: playing && !prefersReducedMotion ? STEP_MS / 1000 : 0.2, ease: "linear" }}
                        className="h-full bg-senyalita-accent"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {STEPS.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => { setStep(i); setPlaying(false); }}
                        aria-current={i === step ? "step" : undefined}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                          i === step ? "bg-senyalita-dark text-white" : "text-senyalita-muted hover:bg-white",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-xs text-senyalita-muted">
                    Or type above to run it on your own words.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
