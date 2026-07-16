import type { GlossTranslation } from "./glossTranslator";
import { mapWordToGesture } from "@/features/gesture-mapping";
import { fingerSpellAnimation, simplifyMorphology } from "./fallback";

export interface SequencedItem {
  gesture: string;
  original: string;
  priority: number;
  confidence: number;
  strategy: string;
  isPause: boolean;
  pauseDuration: number;
  displayLabel: string;
}

export interface SequenceOptions {
  pauseAfterSentence: number;
  pauseAfterComma: number;
  pauseAfterQuestion: number;
  pauseAfterExclamation: number;
  interGlossGap: number;
  minConfidence: number;
  phraseMerge: boolean;
}

const DEFAULT_SEQUENCE_OPTIONS: SequenceOptions = {
  pauseAfterSentence: 0.6,
  pauseAfterComma: 0.3,
  pauseAfterQuestion: 0.5,
  pauseAfterExclamation: 0.5,
  interGlossGap: 0.05,
  minConfidence: 0.3,
  phraseMerge: true,
};

export function buildSequence(
  glossSequence: GlossTranslation[],
  originalText: string,
  options?: Partial<SequenceOptions>,
): SequencedItem[] {
  const opts = { ...DEFAULT_SEQUENCE_OPTIONS, ...options };
  const items: SequencedItem[] = [];

  for (let i = 0; i < glossSequence.length; i++) {
    const g = glossSequence[i];
    const mapping = mapWordToGesture(g.gloss.toLowerCase());

    let isPause = false;
    let pauseDuration = 0;

    items.push({
      gesture: mapping.gloss,
      original: g.original,
      priority: g.strategy === "fingerspelling" || mapping.isFingerSpelling ? 2 : 0,
      confidence: g.confidence,
      strategy: g.strategy,
      isPause: false,
      pauseDuration: 0,
      displayLabel: mapping.gloss,
    });

    const next = glossSequence[i + 1];
    if (next) {
      const pause = computePause(g, next, originalText, opts);
      if (pause > 0) {
        items.push({
          gesture: "PAUSE",
          original: "",
          priority: -1,
          confidence: 1,
          strategy: "pause",
          isPause: true,
          pauseDuration: pause,
          displayLabel: "",
        });
      }
    }
  }

  if (opts.phraseMerge) {
    return mergeCompatibleItems(items);
  }

  return items;
}

function computePause(
  current: GlossTranslation,
  next: GlossTranslation,
  originalText: string,
  opts: SequenceOptions,
): number {
  const endIdx = originalText.toLowerCase().indexOf(current.original) + current.original.length;
  const between = originalText.slice(endIdx, originalText.toLowerCase().indexOf(next.original));

  if (/[.!?]+/.test(between)) {
    if (between.includes("?")) return opts.pauseAfterQuestion;
    if (between.includes("!")) return opts.pauseAfterExclamation;
    return opts.pauseAfterSentence;
  }
  if (/,/.test(between)) return opts.pauseAfterComma;

  const sameCategory = areSameCategory(current.gloss, next.gloss);
  if (sameCategory) return opts.interGlossGap * 0.5;

  return opts.interGlossGap;
}

function areSameCategory(a: string, b: string): boolean {
  const aCat = getCategory(a);
  const bCat = getCategory(b);
  return aCat === bCat;
}

function getCategory(label: string): string {
  const cats = ["greeting", "color", "family", "food", "time", "number", "emotion", "description", "politeness"];
  for (const c of cats) {
    if (label.toLowerCase().includes(c)) return c;
  }
  return "general";
}

export function mergeCompatibleItems(items: SequencedItem[]): SequencedItem[] {
  const merged: SequencedItem[] = [];

  for (const item of items) {
    const last = merged[merged.length - 1];
    if (last && !last.isPause && !item.isPause && canMerge(last, item)) {
      last.displayLabel = `${last.displayLabel} ${item.displayLabel}`;
      last.original = `${last.original} ${item.original}`;
      if (item.confidence < last.confidence) last.confidence = item.confidence;
      if (item.priority > last.priority) last.priority = item.priority;
    } else {
      merged.push({ ...item });
    }
  }

  return merged;
}

function canMerge(a: SequencedItem, b: SequencedItem): boolean {
  if (a.gesture === "PAUSE" || b.gesture === "PAUSE") return false;
  const aHand = getHandSide(a.gesture);
  const bHand = getHandSide(b.gesture);
  if (aHand !== "both" && bHand !== "both" && aHand !== bHand) return false;
  return true;
}

function getHandSide(label: string): "left" | "right" | "both" {
  const leftHanded = ["A", "B", "C", "D", "E", "F"];
  const rightHanded = ["G", "H", "I", "J", "K", "L", "M"];
  const upper = label.toUpperCase();
  if (leftHanded.includes(upper)) return "left";
  if (rightHanded.includes(upper)) return "right";
  return "both";
}
