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
    progress: FallbackProgress,
  ): Promise<AnimationClip[] | null> => {
    const engine = fingerspellingRef.current;

    // Spell what the user typed, not the gloss it resolved to.
    //
    // This read item.gloss, so typing "kamusta ka" -- which resolves to the
    // gloss HOW ARE YOU -- was spelled H-O-W-A-R-E-Y-O-U. That is nonsense to
    // a Filipino user: it spells English words they never wrote, and it does it
    // at the exact moment the system has nothing else to offer. The gloss is
    // still the identity used to look the asset up; only these characters and
    // the label follow the source.
    const source = fingerspellSource(item);

    // Letters and digits only: punctuation has no sign and would 404.
    //
    // Selected by what is actually spellable rather than by
    // engine.isFingerspellable, which is /^[A-Za-z]+$/ and so rejects any word
    // containing a digit. That was harmless while this spelled the gloss --
    // glosses are words -- but the source is the user's own text, where "10"
    // is both plausible and a real sign. It also means "don't" spells D-O-N-T
    // instead of being dropped whole for one apostrophe.
    const spelled = spellableCharacters(source);
    if (spelled.length === 0) return null;

    const stamp = Date.now();
    const clips: AnimationClip[] = [];

    // Fetch every distinct character at once, then assemble in order.
    //
    // This was `await` inside the character loop, so an 11-letter word made 11
    // round trips end to end. Measured against production, a published letter
    // takes ~3.4s to arrive, which put PROGRAMMING at roughly 38 seconds before
    // the item resolved -- and an item resolves as a unit, so not one clip of
    // it existed until the last letter landed. In parallel the same word costs
    // about one round trip.
    //
    // Distinct, not per-position: PROGRAMMING repeats R, G and M, and the
    // loader is a cache keyed by gloss but has no in-flight dedupe, so issuing
    // the same character twice concurrently would fetch 3.3MB twice.
    const characters = spelled.flat();
    const distinct = [...new Set(characters)];

    // Counted in signs the viewer will see, not in fetches. PROGRAMMING is 11
    // signs from 8 requests, and a bar that ran to 8 of 11 would stall at 73%
    // for no reason the reader could tell.
    progress.setSigns(characters.length);
    const occurrences = (c: string) => characters.filter((x) => x === c).length;

    const assets = new Map(await Promise.all(
      distinct.map(async (c) => {
        const asset = await globalLoader.load(c);
        progress.signsLoaded(occurrences(c));
        return [c, asset] as const;
      }),
    ));

    // Position across the whole expansion, not within each word.
    //
    // One item can cover several source words ("kamusta ka"), and a per-word
    // index repeats: A is at position 1 of both KAMUSTA and KA, so both clips
    // came out as `spell-A-0-1-<stamp>`. React drops or duplicates children
    // under a repeated key, and the timeline renders them by clip id.
    let position = 0;
    for (const characters of spelled) {
      for (const character of characters) {
        const published = assets.get(character);
        clips.push({
          id: published
            ? `spell-${character}-${index}-${position}-${stamp}`
            // No recorded animation for this character — synthesise it rather
            // than drop it, so the word still spells out in full.
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

  // No blanket cache warm on mount.
  //
  // This used to call preloadCommonAssets(), fetching all 26 letters the moment
  // the tab mounted: 16.1MB over the wire and 78MB decoded and JSON-parsed,
  // roughly 1.3s of blocked main thread, racing the model and the MediaPipe
  // WASM for bandwidth — before the user had typed anything, and on a tab they
  // may never use.
  //
  // The debounced typing-pause prefetch below already warms exactly the assets
  // a message needs, resolved through the real pipeline, and fires ~400ms after
  // typing stops — still ahead of the Translate click. Precise warming on
  // intent beats warming the whole alphabet on arrival.

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
  const prefetchCurrentMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      // Admin-added mappings first, or this warms the wrong keys. Measured on
      // production: "maraming salamat po" is one sign via an alias, but the
      // prefetch resolved it through the source dictionary alone and fetched
      // MANY as well — a request for a sign the translation never uses.
      await aliasIndex.load();
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
    // Forcing "tl-PH" made every English utterance (and plenty of Filipino
    // ones — browser support for it is patchy) come back empty or error out
    // with no visible sign why. The browser's own language is far more likely
    // to match what the user is actually about to say.
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      // Iterating from resultIndex (rather than assuming everything lives at
      // results[0]) is what the API actually specifies; reading only index 0
      // silently dropped later segments whenever the recognizer split one
      // utterance into more than one result.
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
      // Every one of these previously failed identically: the button flicked
      // back to "Dictate" and nothing appeared, with no way to tell a denied
      // permission from silence from an unsupported language.
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow microphone permission for this site and try again.",
        "service-not-allowed": "Microphone access was blocked. Allow microphone permission for this site and try again.",
        "no-speech": "No speech detected. Click Dictate and start speaking right away.",
        "audio-capture": "No microphone was found. Check your device and try again.",
        network: "Speech recognition needs an internet connection.",
        "language-not-supported": "Speech recognition isn't available in your browser's language on this device.",
        aborted: "", // user-initiated stop; nothing to report
      };
      const description = messages[event?.error] ?? "Couldn't start dictation. Try again, or type instead.";
      if (description) setDictationError(description);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // Most commonly: start() called while a previous session was still
      // tearing down. Safe to just let the user try again.
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
          dictationError={dictationError}
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
          // Raw, not `&& clips.length === 0`. The viewer decides when to drop
          // the loader now, and it waits for a painted frame rather than for
          // the first clip's JSON to land.
          loading={loading}
          loadedCount={translation.loadedCount}
          totalCount={translation.totalCount}
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

        {/* Swapped by plain conditionals, not AnimatePresence.

            These two were a single `<AnimatePresence mode="wait">` pair, and the
            result panel never appeared: the FSL gloss row and the "spelled letter
            by letter" note were unreachable on every translation the app has ever
            done. `mode="wait"` holds the incoming child until the outgoing one
            reports its exit animation complete, and that report never came, so
            the finished translation stayed hidden behind a progress checklist
            reading "Ready".

            The exit never starts when both of these hold, which is every
            translation this screen performs:

              - the pipeline has been on screen long enough to finish its enter
                animation (any real asset fetch), and
              - the update that removes it arrives outside a React event handler
                — here the hook's `stage: "done"` after `await Promise.all`.

            Removing it inside a click handler instead works fine, which is why
            nothing else on the page shows this. Giving each panel its own
            AnimatePresence does not help: the pipeline's exit still hangs, so it
            just sticks around next to the result instead of in place of it.

            So neither panel is allowed to gate on an exit animation. Both still
            animate in — `initial`/`animate` need no AnimatePresence — and each
            leaves the instant the other is due, which is the swap `mode="wait"`
            was there to stage in the first place. Content must not be reachable
            only via an animation callback. */}
        {loading && <TranslationPipeline activeStage={pipelineStage} />}
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
                onMouseEnter={() => { void prefetchCurrentMessage(phrase); }}
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
