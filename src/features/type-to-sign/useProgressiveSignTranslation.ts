"use client";

import { useCallback, useRef, useState } from "react";
import { globalPipeline } from "@/features/translation-pipeline";
import { globalLoader } from "@/features/sign-animation/hooks/useAnimationClip";
import type { AnimationClip } from "@/features/sign-animation/types";
import type { AnimationPlanItem, TranslationPipelineResult } from "@/features/translation-pipeline/types";
import { computeReadyPrefix, type SettledSlot } from "./orderedFlush";

export type TranslationStage = "idle" | "translating" | "loading" | "done" | "error";

export interface ProgressiveTranslationState {
  stage: TranslationStage;
  clips: AnimationClip[];
  /** How many words have resolved (found or fallen back), regardless of
   * display order — for a "Loading signs: N of M" readout. */
  loadedCount: number;
  totalCount: number;
  error: string | null;
  fallbackWords: string[];
}

export interface UseProgressiveSignTranslationOptions {
  /** Resolve fallback clip(s) for a word the loader couldn't find a
   * published asset for (or that the pipeline already flagged
   * fallbackUsed) — e.g. fingerspelling, which can expand one gloss into
   * several letter clips. Return null/[] to drop the word from the
   * sequence, matching each surface's own existing fallback behavior. Runs
   * synchronously. */
  resolveFallback?: (item: AnimationPlanItem, index: number) => AnimationClip | AnimationClip[] | null;
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
    let settledCount = 0;
    const fallbackWords: string[] = [];

    const resolveItem = async (item: AnimationPlanItem, index: number): Promise<AnimationClip[]> => {
      if (!item.fallbackUsed) {
        const asset = await globalLoader.load(item.animationKey);
        if (asset) {
          return [{ id: `anim-${item.animationKey}-${index}-${Date.now()}`, gesture: item.gloss, asset }];
        }
      }
      const fallback = optionsRef.current.resolveFallback?.(item, index) ?? null;
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
        loadedCount: settledCount,
      }));
    };

    await Promise.all(items.map(async (item, index) => {
      const clips = await resolveItem(item, index);
      if (isStale()) return;
      settled[index] = { done: true, value: clips };
      settledCount++;
      optionsRef.current.onItemResolved?.(item, index, clips);
      flush();
    }));

    if (isStale()) return;
    setState((s) => ({
      ...s,
      stage: s.clips.length > 0 ? "done" : "error",
      error: s.clips.length > 0 ? null : "No signs could be found for this phrase.",
      loadedCount: items.length,
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
