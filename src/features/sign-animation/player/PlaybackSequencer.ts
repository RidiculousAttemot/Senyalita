import type {
  PlaybackPlan,
  PlaybackSegment,
  SentenceType,
  GestureAnimationAsset,
  AnimationFrame,
} from "../types";
import { SentenceChunker } from "./SentenceChunker";
import { SmartAnimationResolver } from "./SmartAnimationResolver";
import { FingerspellingEngine } from "./FingerspellingEngine";
import { NaturalTimingEngine } from "./NaturalTimingEngine";
import { TransitionEngine } from "./TransitionEngine";
import { NonManualController } from "../engine/nonManualFeatures";
import { AnimationCache } from "./AnimationCache";

export class PlaybackSequencer {
  private sentenceChunker: SentenceChunker;
  private resolver: SmartAnimationResolver;
  private fingerspellEngine: FingerspellingEngine;
  private timingEngine: NaturalTimingEngine;
  private transitionEngine: TransitionEngine;
  private nonManualController: NonManualController;
  private cache: AnimationCache | null;

  constructor(
    resolver: SmartAnimationResolver,
    fingerspellEngine: FingerspellingEngine,
    timingEngine?: NaturalTimingEngine,
    transitionEngine?: TransitionEngine,
    nonManualController?: NonManualController,
    cache?: AnimationCache | null,
  ) {
    this.resolver = resolver;
    this.fingerspellEngine = fingerspellEngine;
    this.timingEngine = timingEngine ?? new NaturalTimingEngine();
    this.transitionEngine = transitionEngine ?? new TransitionEngine();
    this.nonManualController = nonManualController ?? new NonManualController();
    this.cache = cache ?? null;
    this.sentenceChunker = new SentenceChunker();
  }

  async generatePlan(inputText: string): Promise<PlaybackPlan> {
    const sentenceType = this.sentenceChunker.detectSentenceType(inputText);
    const cleaned = this.cleanText(inputText);
    const tokens = this.tokenize(cleaned);
    const resolvedSegments: PlaybackSegment[] = [];
    const resolutionChain: string[] = [];

    const phraseMatches = this.sentenceChunker.getPhraseDetector().detectPhrases(tokens);
    const usedIndices = new Set<number>();

    for (const match of phraseMatches) {
      if (match.indices.some((i) => usedIndices.has(i))) continue;
      for (const i of match.indices) usedIndices.add(i);

      const phraseKey = match.phrase.canonicalKey;
      const segment = await this.resolveSegment(
        match.phrase.phrase,
        phraseKey,
        sentenceType,
        resolutionChain,
      );
      resolvedSegments.push(segment);
    }

    for (let i = 0; i < tokens.length; i++) {
      if (usedIndices.has(i)) continue;
      usedIndices.add(i);

      const token = tokens[i];
      if (this.isFingerspellCandidate(token)) {
        const asset = this.fingerspellEngine.generateFingerspellingAsset(token);
        const pause = this.timingEngine.computeInterWordPause("", token);
        resolvedSegments.push({
          type: "fingerspell",
          originalText: token,
          resolvedText: token,
          asset,
          duration: asset.duration + pause,
          strategy: "fingerspell",
          expression: "neutral",
        });
        resolutionChain.push("fingerspell");
      } else {
        const segment = await this.resolveSegment(
          token,
          token.toUpperCase().replace(/\s+/g, "_"),
          sentenceType,
          resolutionChain,
        );
        resolvedSegments.push(segment);
      }
    }

    const totalDuration = resolvedSegments.reduce((sum, s) => sum + (s.asset?.duration ?? 0) + 150, 0);

    const expressionTimeline = this.buildExpressionTimeline(resolvedSegments, sentenceType);
    const pauseTimeline = this.buildPauseTimeline(resolvedSegments);
    const transitionTimeline = this.buildTransitionTimeline(resolvedSegments);

    const phraseCount = resolvedSegments.filter((s) => s.strategy === "exact_phrase" || s.strategy === "phrase_alias").length;
    const glossCount = resolvedSegments.filter((s) => s.strategy === "exact_gloss" || s.strategy === "gloss_alias" || s.strategy === "synonym" || s.strategy === "morphological" || s.strategy === "category_mapping").length;
    const fingerspellCount = resolvedSegments.filter((s) => s.type === "fingerspell").length;
    const fallbackCount = resolvedSegments.filter((s) => s.strategy !== "exact_phrase" && s.strategy !== "exact_gloss").length;

    return {
      inputText,
      language: "FSL",
      sentenceType,
      segments: resolvedSegments,
      totalDuration,
      expressionTimeline,
      pauseTimeline,
      transitionTimeline,
      metadata: {
        phraseCount,
        glossCount,
        fingerspellCount,
        pauseCount: pauseTimeline.length,
        fallbackCount,
        resolutionChain: [...new Set(resolutionChain)],
      },
    };
  }

  private async resolveSegment(
    text: string,
    key: string,
    sentenceType: SentenceType,
    resolutionChain: string[],
  ): Promise<PlaybackSegment> {
    const cached = this.cache?.getResolution(key);
    const result = cached ?? (await this.resolver.resolve(key));
    if (cached) resolutionChain.push("cache_hit");

    if (result.asset) {
      resolutionChain.push(result.strategy);
      const expression = this.getExpressionForStrategy(text, sentenceType, result.strategy);
      return {
        type: "gloss",
        originalText: text,
        resolvedText: result.resolvedGloss,
        asset: result.asset,
        duration: result.asset.duration,
        strategy: result.strategy,
        expression,
      };
    }

    const fingerspellAsset = this.fingerspellEngine.generateFingerspellingAsset(text);
    resolutionChain.push("fingerspell");
    return {
      type: "fingerspell",
      originalText: text,
      resolvedText: text,
      asset: fingerspellAsset,
      duration: fingerspellAsset.duration,
      strategy: "fingerspell",
      expression: "neutral",
    };
  }

  private getExpressionForStrategy(text: string, sentenceType: SentenceType, strategy: string): string {
    const upper = text.toUpperCase();
    const questionWords = ["WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW"];
    if (sentenceType === "question" || questionWords.some((qw) => upper.startsWith(qw))) return "questioning";
    if (sentenceType === "exclamation") return "excited";
    if (["THANK", "PLEASE", "SORRY"].some((w) => upper.includes(w))) return "grateful";
    if (["HAPPY", "LOVE", "BEAUTIFUL", "GOOD"].some((w) => upper.includes(w))) return "happy";
    if (["SAD", "BAD", "SORRY"].some((w) => upper.includes(w))) return "sad";
    if (["YES", "SURE", "CORRECT"].some((w) => upper === w)) return "affirmative";
    if (["NO", "WRONG", "DONT"].some((w) => upper.includes(w))) return "negative";
    if (["GREETINGS", "HELLO", "HI", "GOOD_MORNING"].some((w) => upper.includes(w))) return "cheerful";
    return "neutral";
  }

  private buildExpressionTimeline(
    segments: PlaybackSegment[],
    sentenceType: SentenceType,
  ): Array<{ time: number; expression: string; intensity: number }> {
    const timeline: Array<{ time: number; expression: string; intensity: number }> = [];
    let time = 0;
    for (const segment of segments) {
      timeline.push({
        time,
        expression: segment.expression,
        intensity: segment.type === "fingerspell" ? 0.3 : 0.7,
      });
      time += segment.duration + 150;
    }
    return timeline;
  }

  private buildPauseTimeline(segments: PlaybackSegment[]): Array<{ time: number; duration: number; reason: string }> {
    const timeline: Array<{ time: number; duration: number; reason: string }> = [];
    let time = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i > 0) {
        const pauseDuration = seg.type === "fingerspell" ? 60 : 150;
        timeline.push({ time, duration: pauseDuration, reason: `transition_to_${seg.type}` });
        time += pauseDuration;
      }
      time += seg.duration;
    }
    return timeline;
  }

  private buildTransitionTimeline(segments: PlaybackSegment[]): Array<{ time: number; from: string; to: string; duration: number }> {
    const timeline: Array<{ time: number; from: string; to: string; duration: number }> = [];
    let time = 0;
    for (let i = 1; i < segments.length; i++) {
      time += segments[i - 1].duration;
      timeline.push({
        time,
        from: segments[i - 1].resolvedText,
        to: segments[i].resolvedText,
        duration: 200,
      });
    }
    return timeline;
  }

  private cleanText(text: string): string {
    return text.replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim();
  }

  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter((t) => t.length > 0);
  }

  private isFingerspellCandidate(token: string): boolean {
    const upper = token.toUpperCase();
    if (upper.length <= 1) return false;
    if (this.resolver.isFingerspellFallback(upper)) {
      return this.fingerspellEngine.isFingerspellable(token);
    }
    return false;
  }

  getChunker(): SentenceChunker {
    return this.sentenceChunker;
  }
}
