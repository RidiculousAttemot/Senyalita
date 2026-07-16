import type { CoarticulationController as ICoarticulationController } from "../interfaces";

export interface CoarticulationConfig {
  enabled: boolean;
  blendDuration: number;
  wristContinuity: boolean;
  bodyContinuity: boolean;
  trajectoryOptimization: boolean;
  overlapEnabled: boolean;
  maxOverlapDuration: number;
}

const DEFAULT_CONFIG: CoarticulationConfig = {
  enabled: true,
  blendDuration: 200,
  wristContinuity: true,
  bodyContinuity: true,
  trajectoryOptimization: true,
  overlapEnabled: true,
  maxOverlapDuration: 150,
};

const SAME_HAND_GLOSSES = new Map<string, string[]>([
  ["HELLO", ["THANK YOU", "GOOD MORNING", "HI", "HOW ARE YOU"]],
  ["THANK YOU", ["YOURE WELCOME", "THANKS", "PLEASE"]],
  ["YES", ["NO", "OKAY", "SURE", "CORRECT"]],
  ["NO", ["YES", "NOT", "DONT", "WRONG"]],
  ["GOOD MORNING", ["GOOD AFTERNOON", "GOOD EVENING", "HELLO"]],
  ["HOW ARE YOU", ["IM FINE", "FINE", "GOOD", "HELLO"]],
  ["I", ["MY", "ME", "MINE", "AM"]],
  ["YOU", ["YOUR", "YOURE"]],
  ["PLEASE", ["THANK YOU", "SORRY"]],
  ["SORRY", ["PLEASE", "ITS OKAY"]],
]);

const HAND_TRANSITION_PENALTY: Record<string, number> = {
  "both_to_left": 0.15,
  "both_to_right": 0.15,
  "left_to_right": 0.12,
  "right_to_left": 0.12,
  "same_hand_same": 0.05,
};

export class CoarticulationBridgeService implements ICoarticulationController {
  readonly name = "CoarticulationBridge";
  private config: CoarticulationConfig;

  constructor(config?: Partial<CoarticulationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  computeTransition(fromGloss: string, toGloss: string): { duration: number; blendType: string } {
    if (!this.config.enabled) {
      return { duration: 0, blendType: "none" };
    }

    const sameHand = this.areSameHand(fromGloss, toGloss);
    const compatible = this.areCompatible(fromGloss, toGloss);
    const natural = this.isNaturalSequence(fromGloss, toGloss);

    let duration = this.config.blendDuration;
    let blendType: string = "ease";

    if (compatible && sameHand) {
      duration = this.config.blendDuration * 0.6;
      blendType = "linear";
    } else if (natural) {
      duration = this.config.blendDuration * 0.8;
      blendType = "anticipate";
    } else if (!sameHand) {
      duration = this.config.blendDuration * 1.3;
      blendType = "ease";
    }

    if (this.config.overlapEnabled) {
      const overlapDuration = Math.min(
        this.config.maxOverlapDuration,
        duration * 0.4
      );
      duration = Math.max(duration - overlapDuration, 50);
      blendType = "overlap";
    }

    return {
      duration: Math.round(duration),
      blendType: blendType as "linear" | "ease" | "anticipate" | "overlap" | "none",
    };
  }

  private areSameHand(a: string, b: string): boolean {
    const aUpper = a.toUpperCase();
    const bUpper = b.toUpperCase();

    const aCompat = SAME_HAND_GLOSSES.get(aUpper);
    if (aCompat && aCompat.includes(bUpper)) return true;

    const bCompat = SAME_HAND_GLOSSES.get(bUpper);
    if (bCompat && bCompat.includes(aUpper)) return true;

    const singleLetters = /^[A-Z]$/;
    if (singleLetters.test(aUpper) && singleLetters.test(bUpper)) {
      const aIdx = aUpper.charCodeAt(0) - 65;
      const bIdx = bUpper.charCodeAt(0) - 65;
      const diff = Math.abs(aIdx - bIdx);
      if (diff <= 3) return true;
    }

    return false;
  }

  private areCompatible(a: string, b: string): boolean {
    if (a === b) return false;

    const categoryPairs: Array<[string, string]> = [
      ["greeting", "greeting"],
      ["greeting", "politeness"],
      ["politeness", "politeness"],
      ["affirmation", "negation"],
      ["emotion", "emotion"],
      ["color", "color"],
      ["number", "number"],
      ["family", "family"],
      ["food", "food"],
      ["time", "time"],
    ];

    return categoryPairs.some(
      ([c1, c2]) =>
        this.getRoughCategory(a) === c1 && this.getRoughCategory(b) === c2
    );
  }

  private isNaturalSequence(a: string, b: string): boolean {
    const naturalPairs: Array<[string, string]> = [
      ["HELLO", "HOW ARE YOU"],
      ["HOW ARE YOU", "IM FINE"],
      ["THANK YOU", "YOURE WELCOME"],
      ["GOOD MORNING", "GOOD AFTERNOON"],
      ["YES", "PLEASE"],
      ["NO", "THANK YOU"],
      ["SORRY", "ITS OKAY"],
      ["I LOVE YOU", "I LOVE YOU TOO"],
      ["HELLO", "GOOD MORNING"],
      ["GOOD MORNING", "HELLO"],
      ["PLEASE", "THANK YOU"],
      ["MAHAL", "KITA"],
      ["I", "LOVE"],
      ["LOVE", "YOU"],
    ];

    return naturalPairs.some(
      ([aUpper, bUpper]) =>
        a.toUpperCase() === aUpper && b.toUpperCase() === bUpper
    );
  }

  private getRoughCategory(gloss: string): string {
    const greeting = ["HELLO", "HI", "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HOW ARE YOU", "KUMUSTA", "KAMUSTA"];
    const politeness = ["THANK YOU", "PLEASE", "SORRY", "YOURE WELCOME", "SALAMAT", "PAKIUSAP"];
    const affirmation = ["YES", "OKAY", "OK", "SURE", "CORRECT", "RIGHT", "TRUE", "OO", "OPO"];
    const negation = ["NO", "NOT", "DONT", "WRONG", "INCORRECT", "FALSE", "HINDI", "WAG"];
    const emotion = ["HAPPY", "SAD", "ANGRY", "LOVE", "LIKE", "MASAPA", "MALUNGKOT", "GALIT"];
    const time = ["TODAY", "TOMORROW", "YESTERDAY", "NOW", "LATER", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const family = ["FATHER", "MOTHER", "SON", "DAUGHTER", "BROTHER", "SISTER", "UNCLE", "AUNTIE", "COUSIN", "GRANDFATHER", "GRANDMOTHER", "PARENTS"];
    const color = ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE", "PINK", "BLACK", "WHITE", "BROWN", "GRAY", "VIOLET"];
    const number = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ZERO"];
    const food = ["RICE", "BREAD", "EGG", "FISH", "MEAT", "CHICKEN", "SPAGHETTI", "LONGANISA", "SHRIMP", "CRAB", "SUGAR", "FOOD"];

    const upper = gloss.toUpperCase();
    if (greeting.includes(upper)) return "greeting";
    if (politeness.includes(upper)) return "politeness";
    if (affirmation.includes(upper)) return "affirmation";
    if (negation.includes(upper)) return "negation";
    if (emotion.includes(upper)) return "emotion";
    if (time.includes(upper)) return "time";
    if (family.includes(upper)) return "family";
    if (color.includes(upper)) return "color";
    if (number.includes(upper)) return "number";
    if (food.includes(upper)) return "food";
    return "general";
  }

  setConfig(config: Partial<CoarticulationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CoarticulationConfig {
    return { ...this.config };
  }
}

export const defaultCoarticulationBridge = new CoarticulationBridgeService();
