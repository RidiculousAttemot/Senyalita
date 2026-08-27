"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { globalPipeline } from "@/features/translation-pipeline";
import type { AnimationPlanItem, TranslationPipelineResult } from "@/features/translation-pipeline/types";
import { FingerspellingEngine } from "@/features/sign-animation/player/FingerspellingEngine";
import type { AnimationClip } from "@/features/sign-animation/types";
import { globalLoader } from "@/features/sign-animation/hooks/useAnimationClip";
import { useProgressiveSignTranslation } from "./useProgressiveSignTranslation";
import type { FallbackProgress } from "./useProgressiveSignTranslation";
import { fingerspellSource, spellableCharacters } from "./sourceLabel";
import { aliasIndex } from "@/features/fsl-translation/dictionary/aliasIndex";
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
  const [dictationError, setDictationError] = useState<string | null>(null);

  const fingerspellingRef = useRef(new FingerspellingEngine());
  const recognitionRef = useRef<any>(null);

  const resultRef = useRef<TranslationPipelineResult | null>(null);
  const entriesRef = useRef<BreakdownEntry[]>([]);
  const fingerspelledRef = useRef<Set<string>>(new Set());
  const unsupportedRef = useRef<string[]>([]);
  const usedFallbackRef = useRef<boolean[]>([]);

  const resolveFallback = useCallback(async (
    item: AnimationPlanItem,
    index: number,
    progress: FallbackProgress,
  ): Promise<AnimationClip[] | null> => {
    const engine = fingerspellingRef.current;

    const source = fingerspellSource(item);
    const spelled = spellableCharacters(source);
    if (spelled.length === 0) return null;

    const stamp = Date.now();
    const clips: AnimationClip[] = [];

    const characters = spelled.flat();
    const distinct = [...new Set(characters)];

    progress.setSigns(characters.length);
    const occurrences = (c: string) => characters.filter((x) => x === c).length;

    const assets = new Map(await Promise.all(
      distinct.map(async (c) => {
        const asset = await globalLoader.load(c);
        progress.signsLoaded(occurrences(c));
        return [c, asset] as const;
      }),
    ));

    let position = 0;
    for (const characters of spelled) {
      for (const character of characters) {
        const published = assets.get(character);
        clips.push({
          id: published
            ? `spell-${character}-${index}-${position}-${stamp}`
            : `spell-synth-${character}-${index}-${position}-${stamp}`,
          gesture: character,
          asset: published ?? engine.generateFingerspellingAsset(character),
        });
        position += 1;
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

  const handleTranslate = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setSequenceKey((k) => k + 1);
    translation.translate(trimmed);
  }, [message, loading, translation]);

  const prefetchCurrentMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await aliasIndex.load();
      const keys = globalPipeline.translate(trimmed).animationPlan.items.map((i) => i.animationKey);
      void globalLoader.preload(keys.filter(Boolean)).catch(() => {});
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!message.trim()) return;
    const timer = setTimeout(() => { void prefetchCurrentMessage(message); }, 400);
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

    setDictationError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0]?.transcript ?? "";
      }
      finalTranscript = finalTranscript.trim();
      if (finalTranscript) setMessage((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow microphone permission for this site and try again.",
        "service-not-allowed": "Microphone access was blocked. Allow microphone permission for this site and try again.",
        "no-speech": "No speech detected. Click Dictate and start speaking right away.",
        "audio-capture": "No microphone was found. Check your device and try again.",
        network: "Speech recognition needs an internet connection.",
        "language-not-supported": "Speech recognition isn't available in your browser's language on this device.",
        aborted: "",
      };
      const description = messages[event?.error] ?? "Couldn't start dictation. Try again, or type instead.";
      if (description) setDictationError(description);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setDictationError("Couldn't start dictation. Try again.");
      setIsListening(false);
    }
  }, [isListening]);

  const translationResult = useMemo(() => {
    if (stage !== "done" || !resultRef.current) return null;
    return {
      source: resultRef.current.originalText,
      normalized: resultRef.current.normalized.normalized,
      language: LANGUAGE_LABEL[resultRef.current.language.language],
      entries: entriesRef.current.filter(Boolean),
      clipCount: clips.length,
    };
  }, [stage, clips]);

  const pipelineStage = stage === "translating" ? 1 : stage === "loading" ? 3 : 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:gap-8">
        <div className="space-y-6">
          <SignComposer
            value={message}
            onChange={setMessage}
            onSubmit={handleTranslate}
            onSpeak={handleSpeak}
            onListen={handleListen}
            isListening={isListening}
            speechSupported={speechSupported}
            dictationError={dictationError}
            loading={loading}
            detectedLanguage={resultRef.current?.language.language ?? null}
            coverage={stage === "done" ? resultRef.current?.metrics.coverage ?? null : null}
          />

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
                <p className="text-[0.8125rem] leading-snug text-amber-800">{error}</p>
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
            <h2 id="suggestions-heading" className="mb-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-senyalita-muted">
              Try a phrase
            </h2>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setMessage(phrase)}
                  onMouseEnter={() => { void prefetchCurrentMessage(phrase); }}
                  className="rounded-full border border-senyalita-border bg-white px-4 py-2 text-[0.8125rem] font-medium text-senyalita-muted transition-all duration-150 hover:-translate-y-0.5 hover:border-senyalita-primary/40 hover:bg-senyalita-primary/5 hover:text-senyalita-primary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <SignStageViewer
            clips={clips}
            sequenceKey={sequenceKey}
            loading={loading}
            loadedCount={translation.loadedCount}
            totalCount={translation.totalCount}
            isStreaming={isStreaming}
            fingerspelledGlosses={fingerspelledRef.current}
          />
        </div>
      </div>
    </div>
  );
}