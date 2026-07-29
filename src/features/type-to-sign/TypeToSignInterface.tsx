"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { globalPipeline } from "@/features/translation-pipeline";
import type { AnimationPlanItem, TranslationPipelineResult } from "@/features/translation-pipeline/types";
import { FingerspellingEngine } from "@/features/sign-animation/player/FingerspellingEngine";
import type { AnimationClip } from "@/features/sign-animation/types";
import { preloadCommonAssets } from "@/lib/commonAssetsPreload";
import { globalLoader } from "@/features/sign-animation/hooks/useAnimationClip";
import { useProgressiveSignTranslation } from "./useProgressiveSignTranslation";
import { SignComposer } from "./components/SignComposer";
import { SignStageViewer } from "./components/SignStageViewer";
import {
  TranslationPipeline, TranslationResult, type TranslationEntry as BreakdownEntry,
} from "./components/TranslationResult";

const SUGGESTIONS = [
  "Kamusta ka?", "Salamat", "Magandang umaga", "Paalam",
  "Mahal kita", "Pakiusap", "Tulong", "Saan",
  "Doktor", "Masaya ako",
];

const LANGUAGE_LABEL = { en: "English", tl: "Filipino", mixed: "Mixed" } as const;

export function TypeToSignInterface() {
  const [message, setMessage] = useState("");
  const [sequenceKey, setSequenceKey] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const fingerspellingRef = useRef(new FingerspellingEngine());
  const recognitionRef = useRef<any>(null);

  // Index-aligned side state, filled in as each word resolves (possibly out
  // of order) — read back once translation finishes, matching the pipeline
  // item order regardless of network arrival order.
  const resultRef = useRef<TranslationPipelineResult | null>(null);
  const entriesRef = useRef<BreakdownEntry[]>([]);
  const fingerspelledRef = useRef<Set<string>>(new Set());
  const unsupportedRef = useRef<string[]>([]);
  const usedFallbackRef = useRef<boolean[]>([]);

  /**
   * A word with no published sign is fingerspelled from the published
   * alphabet: one recorded animation per character.
   *
   * Previously this synthesised poses with FingerspellingEngine. Those assets
   * carry a single hand and a stub pose with no face mesh, which the landmark
   * renderer skips entirely — the sequence reported a duration but drew
   * nothing. Every A-Z and 0-9 sign is published, so the recorded animations
   * are used instead and the fallback renders like any other sign.
   *
   * The synthesised engine is still the last resort for a character with no
   * published animation, so the sequence never silently loses a word.
   */
  const resolveFallback = useCallback(async (
    item: AnimationPlanItem,
    index: number,
  ): Promise<AnimationClip[] | null> => {
    const engine = fingerspellingRef.current;
    // Grammar rules can expand one word into a multi-word gloss
    // ("KUMUSTA" -> "HOW ARE YOU"), so spell each word separately.
    const words = item.gloss.split(/\s+/).filter((w) => engine.isFingerspellable(w));
    if (words.length === 0) return null;

    const stamp = Date.now();
    const clips: AnimationClip[] = [];

    for (const word of words) {
      // Letters and digits only: punctuation has no sign and would 404.
      const characters = word.toUpperCase().replace(/[^A-Z0-9]/g, "").split("");

      for (const [ci, character] of characters.entries()) {
        const published = await globalLoader.load(character);
        if (published) {
          clips.push({
            id: `spell-${character}-${index}-${ci}-${stamp}`,
            gesture: character,
            asset: published,
          });
          continue;
        }
        // No recorded animation for this character — synthesise it rather
        // than drop it, so the word still spells out in full.
        clips.push({
          id: `spell-synth-${character}-${index}-${ci}-${stamp}`,
          gesture: character,
          asset: engine.generateFingerspellingAsset(character),
        });
      }
    }

    if (clips.length === 0) return null;
    usedFallbackRef.current[index] = true;
    return clips;
  }, []);

  const onPipelineResult = useCallback((result: TranslationPipelineResult) => {
    const n = result.animationPlan.items.length;
    resultRef.current = result;
    entriesRef.current = new Array(n);
    fingerspelledRef.current = new Set();
    unsupportedRef.current = [];
    usedFallbackRef.current = new Array(n).fill(false);
  }, []);

  const onItemResolved = useCallback((item: AnimationPlanItem, index: number, clips: AnimationClip[]) => {
    const wasFallback = usedFallbackRef.current[index] === true;
    entriesRef.current[index] = { gloss: item.gloss, original: item.original, fingerspelled: wasFallback };
    if (wasFallback) {
      clips.forEach((c) => fingerspelledRef.current.add(c.gesture));
    } else if (clips.length === 0) {
      unsupportedRef.current.push(item.original);
    }
  }, []);

  const translation = useProgressiveSignTranslation({ resolveFallback, onPipelineResult, onItemResolved });
  const { stage, clips, error: translationError, isStreaming } = translation;
  const loading = stage === "translating" || stage === "loading";

  const warning = stage === "done" && unsupportedRef.current.length > 0
    ? `Skipped (no sign and not spellable): ${unsupportedRef.current.join(", ")}`
    : null;
  const error = stage === "error"
    ? (translationError ?? "No FSL signs could be generated for this input. Try plain words or letters.")
    : warning;

  useEffect(() => {
    const SpeechRecognition = typeof window !== "undefined"
      ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
      : undefined;
    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
  }, []);

  // Warm the shared asset cache with high-frequency words so the first real
  // translation (and any of the quick-suggestion chips) has a head start.
  useEffect(() => {
    preloadCommonAssets();
  }, []);

  const handleTranslate = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setSequenceKey((k) => k + 1);
    translation.translate(trimmed);
  }, [message, loading, translation]);

  // Warm the cache for whatever's currently typed (or about to be, on
  // hover) before the user even clicks Translate, so the click-to-first-frame
  // gap shrinks further. Runs the real (synchronous, sub-5ms) pipeline just
  // to get accurate gloss keys rather than guessing from raw words.
  const prefetchCurrentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const keys = globalPipeline.translate(trimmed).animationPlan.items.map((i) => i.animationKey);
      void globalLoader.preload(keys.filter(Boolean)).catch(() => {
        // Warming is best-effort; fetchAsset has already logged the reason.
      });
    } catch {
      // Best-effort prefetch — a malformed partial phrase mid-typing just skips warming.
    }
  }, []);

  // Debounced typing-pause prefetch — fires ~400ms after the user stops
  // typing, not on every keystroke (which would spam fetches for
  // constantly-changing partial words).
  useEffect(() => {
    if (!message.trim()) return;
    const timer = setTimeout(() => prefetchCurrentMessage(message), 400);
    return () => clearTimeout(timer);
  }, [message, prefetchCurrentMessage]);

  const handleSpeak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis || !message.trim()) return;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "tl-PH";
    window.speechSynthesis.speak(utterance);
  }, [message]);

  const handleListen = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "tl-PH";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const translationResult = useMemo(() => {
    if (stage !== "done" || !resultRef.current) return null;
    return {
      source: resultRef.current.originalText,
      normalized: resultRef.current.normalized.normalized,
      language: LANGUAGE_LABEL[resultRef.current.language.language],
      entries: entriesRef.current.filter(Boolean),
      // The surrounding values live in refs, so `clips` is what actually
      // signals that a streaming translation has produced more entries.
      clipCount: clips.length,
    };
  }, [stage, clips]);

  // Drives the progress list off real translation state rather than a timer:
  // "translating" is the synchronous pipeline, "loading" is asset fetching.
  const pipelineStage = stage === "translating" ? 1 : stage === "loading" ? 3 : 0;

  return (
    // rows: [auto, 1fr] keeps the composer row hugging its content — otherwise
    // the tall viewer spanning both rows stretches row 1 and leaves a gap.
    // Viewer gets the wider column so it dominates; rows [auto, 1fr] stop the
    // tall stage from stretching the composer row and opening a gap.
    <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_1fr] lg:items-start">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        // min-w-0: grid items default to min-width:auto and refuse to shrink
        // below their content, which overflows the track on narrow screens.
        className="min-w-0 lg:col-start-1 lg:row-start-1"
      >
        <SignComposer
          value={message}
          onChange={setMessage}
          onSubmit={handleTranslate}
          onSpeak={handleSpeak}
          onListen={handleListen}
          isListening={isListening}
          speechSupported={speechSupported}
          loading={loading}
          detectedLanguage={resultRef.current?.language.language ?? null}
          coverage={stage === "done" ? resultRef.current?.metrics.coverage ?? null : null}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06 }}
        className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <SignStageViewer
          clips={clips}
          sequenceKey={sequenceKey}
          loading={loading && clips.length === 0}
          isStreaming={isStreaming}
          fingerspelledGlosses={fingerspelledRef.current}
        />
      </motion.div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
        <AnimatePresence>
          {error && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 backdrop-blur-xl"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[13px] leading-snug text-amber-800">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {loading && <TranslationPipeline key="pipeline" activeStage={pipelineStage} />}
          {!loading && translationResult && (
            <TranslationResult
              key={`result-${sequenceKey}`}
              source={translationResult.source}
              normalized={translationResult.normalized}
              language={translationResult.language}
              entries={translationResult.entries}
              clipCount={translationResult.clipCount}
            />
          )}
        </AnimatePresence>

        <section
          aria-labelledby="suggestions-heading"
          className="rounded-[22px] border border-senyalita-border bg-white/70 p-5 backdrop-blur-xl"
        >
          <h2 id="suggestions-heading" className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-senyalita-muted">
            Try a phrase
          </h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => setMessage(phrase)}
                onMouseEnter={() => prefetchCurrentMessage(phrase)}
                className="rounded-full border border-senyalita-border bg-white px-4 py-2 text-[13px] font-medium text-senyalita-muted transition-all duration-150 hover:-translate-y-0.5 hover:border-senyalita-primary/40 hover:bg-senyalita-primary/5 hover:text-senyalita-primary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
              >
                {phrase}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
