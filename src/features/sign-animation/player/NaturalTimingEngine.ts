import type { GestureAnimationAsset, GestureTimingConfig, SentenceType } from "../types";

export interface PunctuationPause {
  char: string;
  duration: number;
}

export interface SentenceTiming {
  prePause: number;
  postPause: number;
  speedMultiplier: number;
}

const SENTENCE_PAUSES: Record<string, SentenceTiming> = {
  statement: { prePause: 100, postPause: 200, speedMultiplier: 1 },
  question: { prePause: 100, postPause: 350, speedMultiplier: 0.9 },
  exclamation: { prePause: 100, postPause: 400, speedMultiplier: 0.85 },
  command: { prePause: 80, postPause: 250, speedMultiplier: 0.95 },
  greeting: { prePause: 50, postPause: 300, speedMultiplier: 1 },
  unknown: { prePause: 100, postPause: 200, speedMultiplier: 1 },
};

const PAUSE_SYMBOLS: PunctuationPause[] = [
  { char: ".", duration: 300 },
  { char: "!", duration: 400 },
  { char: "?", duration: 350 },
  { char: ",", duration: 150 },
  { char: ";", duration: 200 },
  { char: ":", duration: 200 },
  { char: "-", duration: 100 },
  { char: "\u2014", duration: 250 },
];

export class NaturalTimingEngine {
  private config: GestureTimingConfig;
  private typeCache: Map<string, SentenceTiming> = new Map();
  private complexityCache: Map<string, number> = new Map();

  constructor(config?: Partial<GestureTimingConfig>) {
    this.config = {
      baseSpeed: 1,
      adjustByComplexity: true,
      adjustByPunctuation: true,
      minDuration: 300,
      maxDuration: 5000,
      ...config,
    };
  }

  setConfig(config: Partial<GestureTimingConfig>): void {
    Object.assign(this.config, config);
  }

  getSentenceTiming(sentenceType: string): SentenceTiming {
    const cached = this.typeCache.get(sentenceType);
    if (cached) return cached;
    const timing = SENTENCE_PAUSES[sentenceType] ?? SENTENCE_PAUSES.unknown;
    this.typeCache.set(sentenceType, timing);
    return timing;
  }

  getPunctuationPause(text: string): number {
    if (!this.config.adjustByPunctuation) return 0;
    let totalPause = 0;
    for (const sym of PAUSE_SYMBOLS) {
      const count = (text.match(new RegExp(`\\${sym.char}`, "g")) || []).length;
      totalPause += count * sym.duration;
    }
    return totalPause;
  }

  getSpeedForGesture(asset: GestureAnimationAsset, sentenceType?: string): number {
    if (!this.config.adjustByComplexity) return this.config.baseSpeed;

    const cacheKey = asset.label + (sentenceType ?? "");
    const cached = this.complexityCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const movementScore = this.computeMovementScore(asset);
    const frameCount = asset.totalFrames;
    const duration = asset.duration;
    const complexity = frameCount > 0 ? movementScore * frameCount / duration : 0.5;

    let speed = this.config.baseSpeed;
    if (complexity > 3) speed = this.config.baseSpeed * 0.65;
    else if (complexity > 1.5) speed = this.config.baseSpeed * 0.8;
    else if (complexity < 0.2) speed = this.config.baseSpeed * 1.3;
    else speed = this.config.baseSpeed;

    if (sentenceType) {
      const sentenceTiming = this.getSentenceTiming(sentenceType);
      speed *= sentenceTiming.speedMultiplier;
    }

    const effectiveDuration = duration / speed;
    if (effectiveDuration < this.config.minDuration) speed = duration / this.config.minDuration;
    if (effectiveDuration > this.config.maxDuration) speed = duration / this.config.maxDuration;

    speed = Math.max(0.1, Math.min(10, speed));
    this.complexityCache.set(cacheKey, speed);
    return speed;
  }

  getFingerspellSpeed(): number {
    return this.config.baseSpeed * 1.15;
  }

  getFingerspellLetterPause(): number {
    return 60;
  }

  getSentenceDuration(segmentsCount: number, sentenceLength: number, sentenceType: SentenceType): number {
    const timing = this.getSentenceTiming(sentenceType);
    const baseTime = segmentsCount * 800;
    const lengthFactor = Math.min(2, 1 + sentenceLength / 50);
    return baseTime * lengthFactor + timing.prePause + timing.postPause;
  }

  getEmphasisHold(text: string): number {
    const upper = text.toUpperCase();
    if (["NO", "STOP", "NEVER", "DONT", "YES", "LOVE"].includes(upper)) return 200;
    if (upper.endsWith("!") || upper.endsWith("?")) return 150;
    return 0;
  }

  computeMovementScore(asset: GestureAnimationAsset): number {
    if (asset.frames.length < 2) return 0;
    let totalMovement = 0;
    let count = 0;
    for (let i = 1; i < asset.frames.length; i++) {
      const prev = asset.frames[i - 1];
      const curr = asset.frames[i];
      for (let h = 0; h < Math.min(prev.landmarks.length, curr.landmarks.length); h++) {
        const pl = prev.landmarks[h].landmarks;
        const cl = curr.landmarks[h].landmarks;
        for (let j = 0; j < Math.min(pl.length, cl.length); j++) {
          totalMovement += Math.sqrt(
            (cl[j].x - pl[j].x) ** 2 +
            (cl[j].y - pl[j].y) ** 2 +
            (cl[j].z - pl[j].z) ** 2
          );
          count++;
        }
      }
    }
    return count > 0 ? totalMovement / count : 0;
  }

  computeInterWordPause(prevWord: string, nextWord: string): number {
    const endChars = prevWord.slice(-1);
    const startChars = nextWord.slice(0, 1);
    let pause = 150;
    if (endChars === "," || endChars === ";") pause += 100;
    if (endChars === "." || endChars === "!" || endChars === "?") pause += 250;
    if (startChars === startChars.toUpperCase() && startChars !== startChars.toLowerCase()) pause += 100;

    const upperNext = nextWord.toUpperCase();
    if (["AND", "OR", "BUT", "SO", "BECAUSE"].includes(upperNext)) pause += 80;
    if (["YES", "NO", "OK", "OH", "WELL"].includes(upperNext)) pause += 60;

    return pause;
  }

  clearCache(): void {
    this.typeCache.clear();
    this.complexityCache.clear();
  }
}
