import { describe, it, expect } from "vitest";
import { mapWordToGesture, getAllGestureLabels } from "../gestureMapper";
import { WORD_TO_GLOSS, GESTURE_CATEGORIES } from "../glossDictionary";

describe("pipeline integrity", () => {
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

  describe("every model label resolves to a gloss", () => {
    for (const label of MODEL_LABELS) {
      it(`"${label}" maps to a valid gloss`, () => {
        const result = mapWordToGesture(label);
        expect(result.gloss).toBeTruthy();
        expect(result.gloss.length).toBeGreaterThan(0);
      });
    }
  });

  describe("every model label has a GESTURE_CATEGORIES entry", () => {
    for (const label of MODEL_LABELS) {
      it(`"${label}" has a GESTURE_CATEGORIES category`, () => {
        const normalized = label.toUpperCase().replace(/['']/g, "'");
        const category = GESTURE_CATEGORIES[normalized];
        expect(category).toBeTruthy();
        expect(typeof category).toBe("string");
      });
    }
  });

  describe("every model label is in getAllGestureLabels output", () => {
    const allLabels = getAllGestureLabels().map((l) => l.toUpperCase());
    for (const label of MODEL_LABELS) {
      it(`"${label}" appears in gesture labels list`, () => {
        expect(allLabels).toContain(label.toUpperCase());
      });
    }
  });

  describe("every model label produces a consistent mapping result", () => {
    for (const label of MODEL_LABELS) {
      it(`"${label}" has correct category detection`, () => {
        const result = mapWordToGesture(label);
        if (label.length === 1 && /^[a-z]$/i.test(label)) {
          expect(result.isFingerSpelling).toBe(true);
        }
      });
    }
  });

  describe("gloss dictionary completeness", () => {
    it("contains all model labels as keys in GESTURE_CATEGORIES", () => {
      for (const label of MODEL_LABELS) {
        const normalized = label.toUpperCase().replace(/['']/g, "'");
        expect(GESTURE_CATEGORIES[normalized]).toBeDefined();
      }
    });

    it("every model label appears in WORD_TO_GLOSS values or GESTURE_CATEGORIES", () => {
      const glossValues = new Set(Object.values(WORD_TO_GLOSS));
      const categoryKeys = new Set(Object.keys(GESTURE_CATEGORIES));
      const missing: string[] = [];
      for (const label of MODEL_LABELS) {
        const normalized = label.toUpperCase().replace(/['']/g, "'");
        if (!glossValues.has(label) && !categoryKeys.has(normalized)) {
          missing.push(label);
        }
      }
      expect(missing).toEqual([]);
    });
  });

  describe("alphabet labels produce correct finger spelling detection", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    for (const letter of letters) {
      it(`"${letter}" is detected as finger spelling`, () => {
        const result = mapWordToGesture(letter);
        expect(result.isFingerSpelling).toBe(true);
      });
    }

    it('"HELLO" is not detected as finger spelling', () => {
      const result = mapWordToGesture("HELLO");
      expect(result.isFingerSpelling).toBe(false);
    });
  });
});
