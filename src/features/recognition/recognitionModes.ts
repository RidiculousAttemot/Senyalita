import { partitionLabels } from "./labelPartition";

/**
 * Two modes, deliberately — there is no "auto".
 *
 * Auto-switching decided the vocabulary on the model's behalf, which makes
 * behaviour unpredictable exactly when it matters most: a live demo. The mode
 * is now an explicit choice, and it IS the scope filter — alphabet restricts
 * predictions to letters and numbers, phrase-signs to the phrase classes.
 *
 * features/recognition/ stays capable of the whole label set: omit the
 * restriction entirely and every class competes, which is what /evaluation
 * relies on to measure all 131.
 */
export type RecognitionMode = "alphabet" | "phrase-signs";

export type ModeConfig = {
  label: string;
  description: string;
  /** Shown as a badge, and paired with an honest caveat below the mode. */
  beta?: boolean;
  /** Sets expectations where accuracy is known to be uneven. */
  caveat?: string;
};

export const MODE_CONFIGS: Record<RecognitionMode, ModeConfig> = {
  alphabet: {
    label: "Alphabet",
    description: "Letters a–z and numbers 1–10",
  },
  "phrase-signs": {
    label: "Phrase Signs",
    description: "Words and phrases signed as single gestures",
    beta: true,
    caveat: "Experimental — accuracy varies by sign.",
  },
};

/** Alphabet is the default because it is the path that works. */
export const DEFAULT_MODE: RecognitionMode = "alphabet";

export const MODE_ORDER: readonly RecognitionMode[] = ["alphabet", "phrase-signs"];

/**
 * Which classes may be predicted in each mode.
 *
 * A restriction on the argmax, not a filter applied afterwards — discarding
 * out-of-scope predictions leaves the UI blank whenever the model prefers a
 * class the mode excludes, which is most noisy frames.
 *
 * Derived from the model's own labels so it cannot disagree with what the
 * panel advertises.
 */
export function allowedLabelsForMode(
  mode: RecognitionMode,
  allLabels: readonly string[],
): ReadonlySet<string> {
  const { letters, numbers, phrases } = partitionLabels(allLabels);
  return mode === "phrase-signs"
    ? new Set(phrases)
    : new Set([...letters, ...numbers]);
}

/**
 * Hands to track, per mode.
 *
 * MediaPipe runs its landmark model once per tracked hand, so two costs
 * roughly double — measured 342ms vs 631ms per detection on a weak GPU. But
 * tracking one hand while two are in frame makes the detector flip between
 * them, which reads as recognition failing outright.
 *
 * Alphabet takes the cheap path because FSL fingerspelling is one-handed.
 * Phrase signs need the second hand.
 *
 * `trackBothHands` lifts alphabet to two, opt-in and off by default. It exists
 * because the flip above is worst for a left-handed signer whose resting hand
 * is in frame, and because the alphabet training data is uneven between hands:
 * 58% of letter sequences are right-hand-only against 24% left-only, so a
 * left-handed signer already has less margin before a wrong lock-on costs them
 * the prediction. The model tolerates the second hand — 18% of letter
 * sequences carry both.
 *
 * It is off by default because the cost is a third of the frame rate on a weak
 * GPU, and that is not a trade to make for everyone silently.
 *
 * Phrase signs ignore the flag: they are 93% two-handed in training and cannot
 * work with one.
 */
export function handsForMode(mode: RecognitionMode, trackBothHands = false): 1 | 2 {
  if (mode !== "alphabet") return 2;
  return trackBothHands ? 2 : 1;
}

export class ModeManager {
  private mode: RecognitionMode = DEFAULT_MODE;

  getMode(): RecognitionMode {
    return this.mode;
  }

  setMode(mode: RecognitionMode): void {
    this.mode = mode;
  }

  reset(): void {
    this.mode = DEFAULT_MODE;
  }
}
