export type RecognitionMode = "auto" | "alphabet-practice" | "conversation";

export type ModeConfig = {
  label: string;
  description: string;
  recommended: boolean;
};

export const MODE_CONFIGS: Record<RecognitionMode, ModeConfig> = {
  auto: { label: "Auto", description: "System automatically chooses the best approach", recommended: true },
  "alphabet-practice": { label: "Alphabet Practice", description: "Optimized for letters and handshapes", recommended: false },
  conversation: { label: "Conversation Mode", description: "Optimized for phrases and communication gestures", recommended: false },
};

export const DEFAULT_MODE: RecognitionMode = "auto";

/** a-z, as the model spells them. */
export const ALPHABET_LABELS: readonly string[] = "abcdefghijklmnopqrstuvwxyz".split("");

/**
 * The ten number signs, by their model label.
 *
 * They display as digits ("ONE" -> "1"), but every layer below the UI works in
 * source labels. There is no ZERO class — see inScopeLabels.ts.
 */
export const NUMBER_LABELS: readonly string[] = [
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
];

const CHARACTER_LABELS = new Set<string>([...ALPHABET_LABELS, ...NUMBER_LABELS]);

/**
 * Everything that is neither a letter nor a number: 95 phrase classes.
 *
 * 131 total = 26 letters + 10 numbers + 95 phrases. Worth stating because the
 * numbers are easy to miscount as phrases — they are multi-character labels
 * ("ONE".."TEN") sitting among them.
 */
export function phraseLabelsFrom(allLabels: readonly string[]): string[] {
  return allLabels.filter((l) => !CHARACTER_LABELS.has(l));
}

/**
 * Which classes may be predicted in each mode.
 *
 * This is a restriction on the argmax, not a filter applied afterwards —
 * discarding out-of-scope predictions leaves the UI blank whenever the model
 * prefers a class the mode excludes.
 *
 * Auto covers letters and numbers because that is what the transcript and the
 * suggestion engine are built around; phrases are opt-in via Conversation,
 * where the supported set is shown so the choice is informed rather than
 * guessed at.
 */
export function allowedLabelsForMode(
  mode: RecognitionMode,
  allLabels: readonly string[],
): ReadonlySet<string> {
  switch (mode) {
    case "alphabet-practice":
      return new Set(ALPHABET_LABELS);
    case "conversation":
      return new Set(phraseLabelsFrom(allLabels));
    case "auto":
    default:
      return CHARACTER_LABELS;
  }
}

/**
 * Hands to track, per mode.
 *
 * MediaPipe runs its landmark model once per tracked hand, so two costs
 * roughly double — measured 342ms vs 631ms per detection on a weak GPU. But
 * tracking one hand while two are in frame makes the detector flip between
 * them, which reads as recognition failing outright whenever both hands are
 * visible.
 *
 * So only Alphabet Practice takes the cheap path: FSL fingerspelling is
 * one-handed, and that mode exists for drilling letters. Auto and Conversation
 * track both, because phrases need the second hand and because a user resting
 * two hands in frame must not break recognition.
 */
export function handsForMode(mode: RecognitionMode): 1 | 2 {
  return mode === "alphabet-practice" ? 1 : 2;
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

  getWeight(mode: RecognitionMode, category: "alphabet" | "phrase"): number {
    switch (mode) {
      case "auto":
        return 1.0;
      case "alphabet-practice":
        return category === "alphabet" ? 1.3 : 0.9;
      case "conversation":
        return category === "phrase" ? 1.3 : 0.9;
    }
  }
}
