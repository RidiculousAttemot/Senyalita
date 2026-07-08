import type { NonManualFeatures } from "../types";

const EXPRESSION_PROFILES: Record<string, Partial<NonManualFeatures>> = {
  neutral: { eyebrowRaise: 0, headNod: 0, headShake: 0, mouthOpen: 0, bodyOrientation: 0, facialExpression: "neutral" },
  happy: { eyebrowRaise: 0.5, mouthOpen: 0.4, headNod: 0.1, facialExpression: "happy" },
  sad: { eyebrowRaise: 0.2, mouthOpen: 0.1, headNod: 0, facialExpression: "sad" },
  surprised: { eyebrowRaise: 0.9, mouthOpen: 0.7, bodyOrientation: 0.1, facialExpression: "surprised" },
  angry: { eyebrowRaise: 0.1, mouthOpen: 0.3, headShake: 0.1, bodyOrientation: -0.1, facialExpression: "angry" },
  fearful: { eyebrowRaise: 0.7, mouthOpen: 0.5, bodyOrientation: -0.2, facialExpression: "fearful" },
  disgusted: { eyebrowRaise: 0.2, mouthOpen: 0.2, headShake: 0.2, facialExpression: "disgusted" },
  questioning: { eyebrowRaise: 0.7, headNod: 0.2, headShake: 0.1, mouthOpen: 0.2, facialExpression: "questioning" },
  affirmative: { headNod: 0.8, mouthOpen: 0.2, eyebrowRaise: 0.2, facialExpression: "affirmative" },
  negative: { headShake: 0.6, mouthOpen: 0.3, eyebrowRaise: 0.1, facialExpression: "negative" },
  grateful: { headNod: 0.5, mouthOpen: 0.4, eyebrowRaise: 0.3, facialExpression: "grateful" },
  apologetic: { eyebrowRaise: 0.4, headNod: 0.3, mouthOpen: 0.2, facialExpression: "apologetic" },
  pleading: { eyebrowRaise: 0.5, headNod: 0.2, mouthOpen: 0.3, facialExpression: "pleading" },
  cheerful: { eyebrowRaise: 0.5, mouthOpen: 0.3, headNod: 0.3, facialExpression: "cheerful" },
  understanding: { headNod: 0.4, eyebrowRaise: 0.2, facialExpression: "understanding" },
  uncertain: { headShake: 0.5, eyebrowRaise: 0.7, mouthOpen: 0.2, facialExpression: "uncertain" },
  thinking: { eyebrowRaise: 0.3, headNod: 0, headShake: 0, mouthOpen: 0.1, bodyOrientation: 0.1, facialExpression: "thinking" },
  excited: { eyebrowRaise: 0.8, mouthOpen: 0.6, headNod: 0.4, bodyOrientation: 0.2, facialExpression: "excited" },
  tired: { eyebrowRaise: 0.1, mouthOpen: 0.2, headNod: 0, bodyOrientation: -0.1, facialExpression: "tired" },
  emphatic: { eyebrowRaise: 0.6, headNod: 0.3, mouthOpen: 0.3, bodyOrientation: 0.15, facialExpression: "emphatic" },
};

export class NonManualController {
  private current: NonManualFeatures = {
    eyebrowRaise: 0,
    headNod: 0,
    headShake: 0,
    mouthOpen: 0,
    bodyOrientation: 0,
    facialExpression: "neutral",
  };

  private target: NonManualFeatures = { ...this.current };

  getFeatures(): NonManualFeatures {
    return { ...this.current };
  }

  setTarget(target: Partial<NonManualFeatures>): void {
    Object.assign(this.target, target);
  }

  update(dt: number): void {
    const smoothFactor = 1 - Math.exp(-5 * dt);

    this.current.eyebrowRaise += (this.target.eyebrowRaise - this.current.eyebrowRaise) * smoothFactor;
    this.current.headNod += (this.target.headNod - this.current.headNod) * smoothFactor;
    this.current.headShake += (this.target.headShake - this.current.headShake) * smoothFactor;
    this.current.mouthOpen += (this.target.mouthOpen - this.current.mouthOpen) * smoothFactor;
    this.current.bodyOrientation += (this.target.bodyOrientation - this.current.bodyOrientation) * smoothFactor;

    if (Math.abs(this.target.eyebrowRaise - this.current.eyebrowRaise) < 0.01) {
      this.current.eyebrowRaise = this.target.eyebrowRaise;
    }
  }

  setGestureExpression(gestureLabel: string): void {
    const upper = gestureLabel.toUpperCase();
    const expressionMap: Record<string, string> = {
      "HELLO": "cheerful",
      "HOW ARE YOU": "questioning",
      "IM FINE": "happy",
      "THANK YOU": "grateful",
      "YES": "affirmative",
      "NO": "negative",
      "SORRY": "apologetic",
      "PLEASE": "pleading",
      "GOOD MORNING": "cheerful",
      "GOOD AFTERNOON": "cheerful",
      "GOOD EVENING": "cheerful",
      "NICE TO MEET YOU": "happy",
      "DON'T KNOW": "uncertain",
      "DON'T UNDERSTAND": "uncertain",
      "UNDERSTAND": "understanding",
      "KNOW": "understanding",
      "SAD": "sad",
      "HAPPY": "happy",
      "SURPRISED": "surprised",
      "WRONG": "negative",
      "CORRECT": "affirmative",
      "HOT": "tired",
      "COLD": "neutral",
      "SLOW": "thinking",
      "FAST": "excited",
      "GOOD": "happy",
      "BAD": "sad",
      "BEAUTIFUL": "happy",
      "LOVE": "happy",
      "LIKE": "happy",
      "TIRED": "tired",
      "HUNGRY": "tired",
      "THIRSTY": "tired",
      "STOP": "negative",
      "HELP": "pleading",
      "NEED": "pleading",
      "WANT": "pleading",
      "WHY": "questioning",
      "WHAT": "questioning",
      "WHERE": "questioning",
      "WHEN": "questioning",
      "WHO": "questioning",
      "HOW": "questioning",
    };

    const profileName = expressionMap[upper] ?? "neutral";
    const profile = EXPRESSION_PROFILES[profileName];
    if (profile) {
      this.setTarget(profile);
    }
  }

  setExpression(profileName: string): void {
    const profile = EXPRESSION_PROFILES[profileName];
    if (profile) {
      this.setTarget(profile);
    }
  }

  getExpressionProfiles(): string[] {
    return Object.keys(EXPRESSION_PROFILES);
  }

  reset(): void {
    this.current = {
      eyebrowRaise: 0, headNod: 0, headShake: 0,
      mouthOpen: 0, bodyOrientation: 0, facialExpression: "neutral",
    };
    this.target = { ...this.current };
  }
}
