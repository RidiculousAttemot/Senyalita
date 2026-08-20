"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Loader2, Sparkles } from "lucide-react";
import { SignSurface } from "./SignPlaybackDemo";

type GlossItem = { gloss: string; original: string; strategy: string };

type PipelineFn = (text: string) => {
  glossSequence: GlossItem[];
  language: { language: "en" | "tl" | "mixed" };
  totalProcessingTimeMs: number;
};

/**
 * The phrase shown before the visitor types anything.
 *
 * Its gloss is NOT written down here. It used to be -- `DEMO_GLOSS =
 * ["KAMUSTA", "KA"]` -- and it was wrong: the engine resolves "Kamusta ka?" to
 * a single HOW ARE YOU, which is a published sign, while neither KAMUSTA nor KA
 * exists as an asset. So the panel advertised a two-sign result that the system
 * would never produce, directly under the line "this runs Senyalita's real
 * translation engine". Everything on screen now comes back from the engine.
 */
const DEMO_PHRASE = "Kamusta ka?";
const EXAMPLES = ["Kamusta ka?", "Salamat po", "Mahal kita", "Good morning"];

const LANGUAGE_LABEL: Record<string, string> = { en: "English", tl: "Filipino", mixed: "Mixed" };

/**
 * THE LOAD POLICY, AND WHY THIS PANEL DOES NOT PREFETCH.
 *
 * This panel is a free-text box in front of a library of 2.3-4.4MB assets. The
 * naive wiring -- fetch the animation for whatever the box currently resolves
 * to -- would pull megabytes per debounced keystroke and be far worse than the
 * static hand it replaces.
 *
 * Split by cost, because the two halves are not comparable:
 *
 *   Resolving text to gloss is free. It is synchronous, local, and needs no
 *   network at all, so it runs on every pause in typing and the gloss appears
 *   immediately. That is the half the section's claim is actually about.
 *
 *   Fetching the animation is expensive, so it happens only when a visitor
 *   asks for one specific sign by pressing play. Not on typing, not on a
 *   preset chip, not on scroll. One in flight at a time, keyed by gloss, and
 *   repeats are served from the loader's cache.
 *
 * NOTHING IS PREFETCHED, including the four presets. The hero panel already
 * spends 2.34MB automatically when it scrolls into view; a second automatic
 * asset here would double that for a visitor who only scrolled past. The two
 * cheap things -- the engine chunk and the 547-byte published-gloss list -- are
 * pulled when the section comes into view, so the panel can name the sign and
 * say truthfully whether a recording exists before anyone spends a megabyte.
 *
 * The measured result: the landing page's transferred bytes are unchanged.
 */
export function InteractiveShowcaseSection() {
  const prefersReducedMotion = useReducedMotion();

  const [input, setInput] = useState("");
  const [sequence, setSequence] = useState<GlossItem[] | null>(null);
  const [meta, setMeta] = useState<{ language: string; ms: number } | null>(null);
  const [engineState, setEngineState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  /** Null until the registry answers; distinguishes "no" from "not yet known". */
  const [playable, setPlayable] = useState<Set<string> | null>(null);

  const pipelineRef = useRef<PipelineFn | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  /** The real translation engine, pulled in only once it is about to be used. */
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
    const pipeline = await ensureEngine();
    if (!pipeline) return;
    try {
      const result = pipeline(trimmed || DEMO_PHRASE);
      setSequence(result.glossSequence);
      setMeta({
        language: LANGUAGE_LABEL[result.language.language] ?? "Detected",
        ms: result.totalProcessingTimeMs,
      });
    } catch {
      setEngineState("failed");
    }
  }, [ensureEngine]);

  /**
   * Both cheap things arrive together, when the section is on screen.
   *
   * Neither is an animation asset: the engine is a JS chunk and the registry is
   * 547 bytes. Doing it here rather than on mount keeps them off the landing
   * page's first load, which is the number this panel is judged on.
   */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      // No observer (older browser, or a test environment): resolve the demo
      // phrase rather than leaving the panel permanently blank.
      void runTranslation("");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void runTranslation("");
        void import("@/features/sign-animation/publishedGlosses")
          .then((m) => m.publishedGlosses.load())
          .then(setPlayable)
          // Silent: the registry already logs, and a failure here must only
          // mean the panel cannot promise a recording exists.
          .catch(() => setPlayable(new Set()));
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [runTranslation]);

  // Re-resolve as the visitor types, once they pause. Free -- no network.
  useEffect(() => {
    if (!input.trim()) return;
    const timer = setTimeout(() => void runTranslation(input), 350);
    return () => clearTimeout(timer);
  }, [input, runTranslation]);

  const isLive = input.trim().length > 0;
  const shownGloss = sequence?.map((g) => g.gloss) ?? [];

  /**
   * The sign the panel offers to play: the first resolved gloss that actually
   * has a recording. "Mahal kita" resolves to LOVE and KITA, of which LOVE is
   * not published and KITA is fingerspelled -- offering LOVE would be a play
   * button that can only fail.
   */
  const firstPlayable = playable
    ? shownGloss.find((g) => playable.has(g)) ?? null
    : null;
  const recordedCount = playable ? shownGloss.filter((g) => playable.has(g)).length : 0;

  return (
    <section id="showcase" ref={sectionRef} className="scroll-mt-20 bg-senyalita-warm px-6 py-24 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-primary">Try it yourself</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-senyalita-dark md:text-4xl">
            Type anything. Watch it become sign.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-senyalita-muted">
            This runs Senyalita&apos;s real translation engine, right here on the page —
            the same one behind <em>Translate</em>, playing the same recorded signs.
            No sign-up, nothing to install.
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
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setInput(ex)}
                      onMouseEnter={() => ensureEngine()}
                      className="rounded-full border border-senyalita-border bg-white px-2.5 py-1 text-[0.6875rem] font-medium text-senyalita-muted transition-colors hover:border-senyalita-primary/40 hover:text-senyalita-primary"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-senyalita-border">
                <ArrowRight className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider text-senyalita-muted">
                  FSL gloss
                </span>
                {meta && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-senyalita-accent/10 px-2 py-0.5 text-[0.625rem] font-semibold text-senyalita-accent">
                    <Sparkles className="h-3 w-3" />
                    {meta.language} · {meta.ms.toFixed(0)}ms
                  </span>
                )}
              </div>

              <div className="flex min-h-[2.5rem] flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {shownGloss.map((g, i) => (
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
                {sequence !== null && shownGloss.length === 0 && (
                  <span className="text-xs text-senyalita-muted">No signs matched — try simpler words.</span>
                )}
              </div>

              <p className="text-sm leading-relaxed text-senyalita-muted">
                {engineState === "failed"
                  ? "The live engine could not start here — the full experience is available in the app."
                  : /* Says what the panel can and cannot show. It plays one sign;
                       the app plays the whole sequence, with fingerspelling for
                       the words that have no recording. */
                    shownGloss.length > 1
                    ? `Senyalita mapped this to ${shownGloss.length} signs${playable ? `, ${recordedCount} of them recorded` : ""}. The panel plays the first recorded one — open the app for the full sequence.`
                    : "Senyalita maps everyday Filipino and English to FSL gloss, then plays the recorded sign for it."}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-senyalita-primary/5 to-senyalita-accent/5 p-8 md:p-10">
              {/*
                The same component the hero uses, so this panel and that one are
                the same renderer over the same recorded landmarks. It was a
                HandSkeleton here: 21 hardcoded coordinates, identical for every
                input, sitting under a stage label that read "Signing".

                trigger="manual" is the load policy above -- nothing is fetched
                until the play control is pressed. It also settles the
                reduced-motion question for free: there is no autoplay path to
                suppress, so that visitor gets the same button as everyone else.
              */}
              <div className="w-full max-w-[260px]">
                <SignSurface
                  gloss={firstPlayable}
                  trigger="manual"
                  showCaption={false}
                  className="rounded-2xl shadow-none"
                  emptyNote={
                    shownGloss.length === 0
                      ? "Type a phrase to see its sign"
                      : playable
                        ? "No recording for these signs yet"
                        : "Checking for a recording…"
                  }
                />
              </div>

              {isLive && (
                <a
                  href="/translate"
                  className="group flex items-center gap-2 rounded-full bg-senyalita-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-senyalita-primary/25 transition-all hover:shadow-lg hover:brightness-105"
                >
                  Open the full translator
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              )}

              <p className="text-center text-xs text-senyalita-muted">
                {isLive
                  ? "Recorded landmark data, played by the same engine as the app."
                  : "Or type above to run it on your own words."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
