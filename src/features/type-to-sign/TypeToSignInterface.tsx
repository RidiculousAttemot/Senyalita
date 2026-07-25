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
import { TranslationBreakdown, type BreakdownEntry } from "./components/TranslationBreakdown";
import { AiInsightsPanel } from "./components/AiInsightsPanel";
import {
  PIPELINE_STEPS, TranslationPipelinePanel, type PipelineStepState,
} from "./components/TranslationPipelinePanel";

const SUGGESTIONS = [
  "Kamusta ka?", "Salamat", "Magandang umaga", "Paalam",
  "Mahal kita", "Pakiusap", "Tulong", "Saan",
  "Doktor", "Masaya ako",
];

const LANGUAGE_LABEL = { en: "English", tl: "Filipino", mixed: "Mixed" } as const;

export function TypeToSignInterface() {
  const [message, setMessage] = useState("");
  const [sequenceKey, setSequenceKey] = useState(0);
  const [stepStates, setStepStates] = useState<PipelineStepState[]>(() => PIPELINE_STEPS.map(() => "pending"));
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const fingerspellingRef = useRef(new FingerspellingEngine());
  const recognitionRef = useRef<any>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Index-aligned side state, filled in as each word resolves (possibly out
  // of order) — read back once translation finishes, matching the pipeline
  // item order regardless of network arrival order.
  const resultRef = useRef<TranslationPipelineResult | null>(null);
  const entriesRef = useRef<BreakdownEntry[]>([]);
  const fingerspelledRef = useRef<Set<string>>(new Set());
  const unsupportedRef = useRef<string[]>([]);
  const usedFallbackRef = useRef<boolean[]>([]);

  const resolveFallback = useCallback((item: AnimationPlanItem, index: number): AnimationClip[] | null => {
    const engine = fingerspellingRef.current;
    // Grammar rules can expand one word into a multi-word gloss
    // ("KUMUSTA" -> "HOW ARE YOU"), so spell each word separately.
    const words = item.gloss.split(/\s+/).filter((w) => engine.isFingerspellable(w));
    if (words.length === 0) return null;
    usedFallbackRef.current[index] = true;
    return words.map((word, wi) => ({
      id: `spell-${word}-${index}-${wi}-${Date.now()}`,
      gesture: word,
      asset: engine.generateFingerspellingAsset(word),
    }));
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
    stepTimersRef.current.forEach(clearTimeout);
    recognitionRef.current?.stop?.();
  }, []);

  // Warm the shared asset cache with high-frequency words so the first real
  // translation (and any of the quick-suggestion chips) has a head start.
  useEffect(() => {
    preloadCommonAssets();
  }, []);

  const runStepAnimation = useCallback(() => {
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
    setStepStates(PIPELINE_STEPS.map((_, i) => (i === 0 ? "active" : "pending")));

    PIPELINE_STEPS.forEach((_, i) => {
      const timer = setTimeout(() => {
        setStepStates((prev) => {
          const next = [...prev];
          next[i] = "done";
          if (i + 1 < next.length) next[i + 1] = "active";
          return next;
        });
      }, 110 * (i + 1));
      stepTimersRef.current.push(timer);
    });
  }, []);

  const handleTranslate = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    runStepAnimation();
    setSequenceKey((k) => k + 1);
    translation.translate(trimmed);
  }, [message, loading, runStepAnimation, translation]);

  // Warm the cache for whatever's currently typed (or about to be, on
  // hover) before the user even clicks Translate, so the click-to-first-frame
  // gap shrinks further. Runs the real (synchronous, sub-5ms) pipeline just
  // to get accurate gloss keys rather than guessing from raw words.
  const prefetchCurrentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const keys = globalPipeline.translate(trimmed).animationPlan.items.map((i) => i.animationKey);
      globalLoader.preload(keys.filter(Boolean));
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

  const insights = useMemo(() => {
    if (stage !== "done" || !resultRef.current) return null;
    const result = resultRef.current;
    const fingerspelled = fingerspelledRef.current;
    return {
      language: LANGUAGE_LABEL[result.language.language],
      signsUsed: clips.length - fingerspelled.size,
      fingerSpelled: fingerspelled.size,
      durationSeconds: clips.reduce((sum, c) => sum + c.asset.duration, 0) / 1000,
      confidence: result.metrics.averageConfidence,
      coverage: result.metrics.coverage,
    };
  }, [stage, clips]);

  return (
    <div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="lg:col-start-1 lg:row-start-1"
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
        className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <SignStageViewer
          clips={clips}
          sequenceKey={sequenceKey}
          loading={loading && clips.length === 0}
          isStreaming={isStreaming}
          fingerspelledGlosses={fingerspelledRef.current}
        />
      </motion.div>

      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
        <TranslationPipelinePanel
          states={stepStates}
          processingMs={loading ? null : resultRef.current?.totalProcessingTimeMs ?? null}
          visible={loading || stage === "done"}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-2.5 rounded-xl border border-fsl-amber-soft bg-fsl-amber-soft/60 p-3"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-fsl-amber" />
              <p className="text-[13px] leading-snug text-fsl-amber">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {stage === "done" && resultRef.current && insights && (
          <>
            <TranslationBreakdown
              original={resultRef.current.originalText}
              normalized={resultRef.current.normalized.normalized}
              entries={entriesRef.current.filter(Boolean)}
              clips={clips}
            />
            <AiInsightsPanel {...insights} />
          </>
        )}

        <section aria-labelledby="suggestions-heading" className="rounded-2xl border border-fsl-border bg-fsl-surface p-5">
          <h2 id="suggestions-heading" className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fsl-muted">
            Try a phrase
          </h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => setMessage(phrase)}
                onMouseEnter={() => prefetchCurrentMessage(phrase)}
                className="rounded-full border border-fsl-border bg-fsl-raised px-3 py-1.5 text-[13px] text-fsl-body transition-colors hover:border-fsl-coral hover:bg-fsl-coral-soft hover:text-fsl-coral-dark"
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
