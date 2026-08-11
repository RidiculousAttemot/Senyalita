"use client";

import { useCallback, useRef, useState } from "react";
import { globalPipeline } from "@/features/translation-pipeline";
import { globalLoader } from "@/features/sign-animation/hooks/useAnimationClip";
import { publishedGlosses, normalizeGloss } from "@/features/sign-animation/publishedGlosses";
import type { AnimationClip } from "@/features/sign-animation/types";
import type { AnimationPlanItem, TranslationPipelineResult } from "@/features/translation-pipeline/types";
import { computeReadyPrefix, type SettledSlot } from "./orderedFlush";
import { sourceLabel } from "./sourceLabel";

export type TranslationStage = "idle" | "translating" | "loading" | "done" | "error";

export interface ProgressiveTranslationState {
  stage: TranslationStage;
  clips: AnimationClip[];
  /**
   * Signs loaded / signs expected, for a "Loading sign N of M" readout.
   *
   * Counted in signs rather than words, because the two differ by an order of
   * magnitude exactly where the wait is longest: one word can fingerspell into
   * a dozen signs, and a readout that said "1 of 1" for the whole of it was
   * indistinguishable from a stuck one.
   *
   * A word is worth one sign until its resolver says otherwise, so `totalCount`
   * can rise once fingerspelling reports how many letters it is about to load.
   */
  loadedCount: number;
  totalCount: number;
  error: string | null;
  fallbackWords: string[];
}

/**
 * Handed to `resolveFallback` so an expansion can report its own size and
 * progress. Without it the hook can only count the word as a single unit,
 * which is the granularity the loader had before.
 */
export interface FallbackProgress {
  /** How many signs this word will contribute. Call before loading starts. */
  setSigns: (count: number) => void;
  /** Mark `count` of them loaded. */
  signsLoaded: (count?: number) => void;
}

export interface UseProgressiveSignTranslationOptions {
  /** Resolve fallback clip(s) for a word the loader couldn't find a
   * published asset for (or that the pipeline already flagged
   * fallbackUsed) — e.g. fingerspelling, which can expand one gloss into
   * several letter clips. Return null/[] to drop the word from the
   * sequence, matching each surface's own existing fallback behavior.
   *
   * May be async: fingerspelling loads one published alphabet animation per
   * letter, so the fallback itself performs network work. */
  resolveFallback?: (
    item: AnimationPlanItem,
    index: number,
    progress: FallbackProgress,
  ) => AnimationClip | AnimationClip[] | null | Promise<AnimationClip | AnimationClip[] | null>;
  /** Fired once per submission with the raw pipeline result, before any
   * asset loading starts — for callers that log analytics off it. */
  onPipelineResult?: (result: TranslationPipelineResult, inputText: string) => void;
  /** Fired once per item, in resolution order (not sentence order) — for
   * callers that build their own index-aligned side state (e.g. a
   * translation-breakdown list) alongside the streamed clips. */
  onItemResolved?: (item: AnimationPlanItem, index: number, clips: AnimationClip[]) => void;
}

const idleState: ProgressiveTranslationState = {
  stage: "idle", clips: [], loadedCount: 0, totalCount: 0, error: null, fallbackWords: [],
};

/**
 * Shared "translate text -> stream in sign animations" state machine used by
 * both /translate's TypeToSignInterface and /type-to-sign's
 * TypeToSignExperience. Loads every word's asset in parallel (via the app's
 * shared AnimationLoader cache) but only ever reveals a *consecutive* ready
 * prefix, so words always appear/play in sentence order even though they
 * can resolve out of order over the network.
 */
export function useProgressiveSignTranslation(options: UseProgressiveSignTranslationOptions = {}) {
  const [state, setState] = useState<ProgressiveTranslationState>(idleState);
  const generationRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const translate = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const myGeneration = ++generationRef.current;
    const isStale = () => generationRef.current !== myGeneration;

    setState({ ...idleState, stage: "translating" });

    let result: TranslationPipelineResult;
    try {
      result = globalPipeline.translate(trimmed);
    } catch {
      if (!isStale()) setState({ ...idleState, stage: "error", error: "An unexpected error occurred during translation." });
      return;
    }
    if (isStale()) return;
    optionsRef.current.onPipelineResult?.(result, trimmed);

    const items = result.animationPlan.items;
    if (items.length === 0) {
      setState({ ...idleState, stage: "error", error: "Nothing to translate." });
      return;
    }

    setState((s) => ({ ...s, stage: "loading", totalCount: items.length }));

    // Each slot holds zero or more clips: normally one, empty when the word
    // is dropped entirely, or several when a fallback (e.g. fingerspelling)
    // expands one gloss into multiple letter clips.
    const settled: SettledSlot<AnimationClip[]>[] = items.map(() => ({ done: false, value: null }));
    let flushedTo = 0;
    const fallbackWords: string[] = [];

    // One sign per word until a resolver reports an expansion. Kept per word
    // rather than as running totals so a late `setSigns` can correct a word's
    // share without double-counting what it already reported loaded.
    const signsPerItem = items.map(() => 1);
    const signsDone = items.map(() => 0);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const pushCounts = () => {
      if (isStale()) return;
      setState((s) => ({ ...s, loadedCount: sum(signsDone), totalCount: sum(signsPerItem) }));
    };
    const progressFor = (index: number): FallbackProgress => ({
      setSigns: (count) => {
        signsPerItem[index] = Math.max(1, count);
        // A word cannot report more loaded than it will produce.
        signsDone[index] = Math.min(signsDone[index], signsPerItem[index]);
        pushCounts();
      },
      signsLoaded: (count = 1) => {
        signsDone[index] = Math.min(signsPerItem[index], signsDone[index] + count);
        pushCounts();
      },
    });

    const resolveItem = async (item: AnimationPlanItem, index: number): Promise<AnimationClip[]> => {
      // A published asset for the typed word outranks whatever the dictionary
      // guessed for it.
      //
      // Animation keys come from a hardcoded vocabulary file, and a word it
      // does not name gets a first-letter fingerspelling stand-in as its key.
      // So publishing a gloss outside that file was inert -- the upload was
      // never requested, and the only way to add vocabulary was a code deploy.
      // Asking the server what exists is what makes an upload playable.
      //
      // Checked first, not last: by the time the dictionary's key resolves to
      // something loadable, the word has already been answered incorrectly.
      const typed = normalizeGloss(item.original);
      if (typed && typed !== normalizeGloss(item.animationKey ?? "") && (await publishedGlosses.has(typed))) {
        const asset = await globalLoader.load(typed);
        if (asset) {
          return [{ id: `anim-${typed}-${index}-${Date.now()}`, gesture: typed, displayLabel: sourceLabel(item.original, typed), asset }];
        }
      }

      if (!item.fallbackUsed) {
        // gesture stays the gloss -- it is the lookup key and the
        // fingerspelledGlosses membership test. Only displayLabel follows the
        // source, so typing "salamat" plays the published THANK YOU asset and
        // is captioned SALAMAT.
        const asset = await globalLoader.load(item.animationKey);
        if (asset) {
          return [{ id: `anim-${item.animationKey}-${index}-${Date.now()}`, gesture: item.gloss, displayLabel: sourceLabel(item.original, item.gloss), asset }];
        }
      }
      const fallback = (await optionsRef.current.resolveFallback?.(item, index, progressFor(index))) ?? null;
      if (!fallback) return [];
      fallbackWords.push(item.gloss);
      return Array.isArray(fallback) ? fallback : [fallback];
    };

    const flush = () => {
      if (isStale()) return;
      const { ready, nextIndex } = computeReadyPrefix(settled, flushedTo);
      flushedTo = nextIndex;
      const flat = ready.flat();
      setState((s) => ({
        ...s,
        clips: flat.length > 0 ? [...s.clips, ...flat] : s.clips,
        loadedCount: sum(signsDone),
        totalCount: sum(signsPerItem),
      }));
    };

    await Promise.all(items.map(async (item, index) => {
      const clips = await resolveItem(item, index);
      if (isStale()) return;
      settled[index] = { done: true, value: clips };
      // A word that produced clips without reporting per-sign progress — the
      // published-asset path, or a fallback that never called setSigns —
      // settles all of its share at once. Resolvers that did report are
      // already at their total, so this is a no-op for them.
      signsPerItem[index] = Math.max(1, clips.length || 1);
      signsDone[index] = signsPerItem[index];
      optionsRef.current.onItemResolved?.(item, index, clips);
      flush();
    }));

    if (isStale()) return;
    setState((s) => ({
      ...s,
      stage: s.clips.length > 0 ? "done" : "error",
      error: s.clips.length > 0 ? null : "No signs could be found for this phrase.",
      loadedCount: sum(signsDone),
      totalCount: sum(signsPerItem),
      fallbackWords,
    }));
  }, []);

  const reset = useCallback(() => {
    generationRef.current++;
    setState(idleState);
  }, []);

  return {
    ...state,
    /** True for the whole window where more clips may still arrive —
     * pass straight through to SignAnimationPlayer's `isStreaming` prop. */
    isStreaming: state.stage === "loading",
    translate,
    reset,
  };
}
