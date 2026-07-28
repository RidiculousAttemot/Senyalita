import { describe, expect, it } from "vitest";
import { GESTURE_CATEGORIES, WORD_TO_GLOSS } from "../glossDictionary";

/**
 * Repointed from pipelineIntegrity.test.ts, which was deleted with
 * gestureMapper.ts in the follow-up sweep.
 *
 * That file had two subjects. Four of its blocks exercised mapWordToGesture
 * and getAllGestureLabels — both gone, nothing to repoint them at. The two
 * blocks kept here cover glossDictionary, which is live: it is imported by
 * features/ai-assist/missingAnimationDetector.ts and read by
 * scripts/evaluate-unified-v4.mjs and scripts/validate-coverage.mjs.
 *
 * The invariant is worth keeping on its own: every label the recognition
 * model can emit must be describable by the dictionary. A label the model
 * predicts but the dictionary cannot categorise is a silent gap between the
 * two halves of Sign-to-Text.
 */

const MODEL_LABELS = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HELLO",
  "HOW ARE YOU", "IM FINE", "NICE TO MEET YOU", "THANK YOU",
  "YOURE WELCOME", "SEE YOU TOMORROW", "UNDERSTAND", "DON'T UNDERSTAND",
  "KNOW", "DON'T KNOW", "NO", "YES", "WRONG", "CORRECT", "SLOW", "FAST",
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST",
  "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
  "TODAY", "TOMORROW", "YESTERDAY",
  "FATHER", "MOTHER", "SON", "DAUGHTER", "GRANDFATHER", "GRANDMOTHER",
  "UNCLE", "AUNTIE", "COUSIN", "PARENTS",
  "BOY", "GIRL", "MAN", "WOMAN",
  "DEAF", "HARD OF HEARING", "WHEELCHAIR PERSON", "BLIND", "DEAF BLIND",
  "MARRIED",
  "BLUE", "GREEN", "RED", "BROWN", "BLACK", "WHITE", "YELLOW", "ORANGE",
  "GRAY", "PINK", "VIOLET", "LIGHT", "DARK",
  "BREAD", "EGG", "FISH", "MEAT", "CHICKEN", "SPAGHETTI", "RICE",
  "LONGANISA", "SHRIMP", "CRAB",
  "HOT", "COLD", "JUICE", "MILK", "COFFEE", "TEA", "BEER", "WINE",
  "SUGAR", "NO SUGAR",
];

/** The dictionary keys on straight apostrophes; the label list uses curly ones. */
const normalize = (label: string) => label.toUpperCase().replace(/['']/g, "'");

describe("gloss dictionary covers the recognition model's labels", () => {
  it.each(MODEL_LABELS)('"%s" has a GESTURE_CATEGORIES entry', (label) => {
    const category = GESTURE_CATEGORIES[normalize(label)];
    expect(category).toBeTruthy();
    expect(typeof category).toBe("string");
  });

  it("reports every uncategorised label at once rather than one per run", () => {
    // The per-label cases above fail one at a time. This one names the whole
    // gap in a single message, which is what you want after adding classes.
    const missing = MODEL_LABELS.filter((label) => !GESTURE_CATEGORIES[normalize(label)]);
    expect(missing, `labels with no category: ${missing.join(", ")}`).toEqual([]);
  });

  it("resolves every model label through WORD_TO_GLOSS or GESTURE_CATEGORIES", () => {
    const glossValues = new Set(Object.values(WORD_TO_GLOSS));
    const categoryKeys = new Set(Object.keys(GESTURE_CATEGORIES));
    const missing = MODEL_LABELS.filter(
      (label) => !glossValues.has(label) && !categoryKeys.has(normalize(label)),
    );
    expect(missing).toEqual([]);
  });
});
