import type {
  AnimationPlan,
  GestureAnimationAsset,
  ResolverResult,
  PlaybackAnalyticsEvent,
  PlaybackPlan,
  AnimationRecommendation,
} from "../types";
import { normalizeGloss } from "../gloss";

export class AnimationCache {
  private assetCache: Map<string, GestureAnimationAsset> = new Map();
  private planCache: Map<string, AnimationPlan> = new Map();
  private resolutionCache: Map<string, ResolverResult> = new Map();
  private expressionPlanCache: Map<string, Array<{ time: number; expression: string; intensity: number }>> = new Map();
  private playbackPlanCache: Map<string, PlaybackPlan> = new Map();
  private transitionPlanCache: Map<string, AnimationPlan["transitions"]> = new Map();
  private fingerspellCache: Map<string, GestureAnimationAsset> = new Map();
  private hits = 0;
  private misses = 0;

  getAsset(key: string): GestureAnimationAsset | null {
    const normalized = normalizeGloss(key);
    const cached = this.assetCache.get(normalized);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    return null;
  }

  setAsset(key: string, asset: GestureAnimationAsset): void {
    const normalized = normalizeGloss(key);
    this.assetCache.set(normalized, asset);
  }

  getPlan(key: string): AnimationPlan | null {
    const cached = this.planCache.get(key);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    return null;
  }

  setPlan(key: string, plan: AnimationPlan): void {
    this.planCache.set(key, plan);
  }

  getPlaybackPlan(key: string): PlaybackPlan | null {
    const cached = this.playbackPlanCache.get(key);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    return null;
  }

  setPlaybackPlan(key: string, plan: PlaybackPlan): void {
    this.playbackPlanCache.set(key, plan);
  }

  getResolution(key: string): ResolverResult | null {
    const normalized = normalizeGloss(key);
    const cached = this.resolutionCache.get(normalized);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    return null;
  }

  setResolution(key: string, result: ResolverResult): void {
    const normalized = normalizeGloss(key);
    this.resolutionCache.set(normalized, result);
  }

  getExpressionPlan(key: string): Array<{ time: number; expression: string; intensity: number }> | null {
    const cached = this.expressionPlanCache.get(key);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    return null;
  }

  setExpressionPlan(key: string, plan: Array<{ time: number; expression: string; intensity: number }>): void {
    this.expressionPlanCache.set(key, plan);
  }

  getFingerspell(key: string): GestureAnimationAsset | null {
    const cached = this.fingerspellCache.get(key);
    if (cached) { this.hits++; return cached; }
    this.misses++;
    return null;
  }

  setFingerspell(key: string, asset: GestureAnimationAsset): void {
    this.fingerspellCache.set(key, asset);
  }

  warmupAssets(assets: Map<string, GestureAnimationAsset>): void {
    for (const [key, asset] of assets) {
      this.setAsset(key, asset);
    }
  }

  clear(): void {
    this.assetCache.clear();
    this.planCache.clear();
    this.resolutionCache.clear();
    this.expressionPlanCache.clear();
    this.playbackPlanCache.clear();
    this.transitionPlanCache.clear();
    this.fingerspellCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): {
    assetCount: number;
    planCount: number;
    resolutionCount: number;
    playbackPlanCount: number;
    fingerspellCount: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      assetCount: this.assetCache.size,
      planCount: this.planCache.size,
      resolutionCount: this.resolutionCache.size,
      playbackPlanCount: this.playbackPlanCache.size,
      fingerspellCount: this.fingerspellCache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 1,
    };
  }

  prune(maxEntries: number): void {
    if (this.assetCache.size <= maxEntries) return;
    const entries = Array.from(this.assetCache.entries());
    const toRemove = entries.slice(0, entries.length - maxEntries);
    for (const [key] of toRemove) {
      this.assetCache.delete(key);
    }
  }
}

export class PlaybackAnalytics {
  private events: PlaybackAnalyticsEvent[] = [];
  private maxEvents = 1000;
  private sessionStart = Date.now();
  private fingerspellCount = 0;
  private totalTranslationLatency = 0;
  private translationLatencyCount = 0;
  private phraseResolutionCount = 0;
  private glossResolutionCount = 0;

  record(event: Omit<PlaybackAnalyticsEvent, "timestamp">): void {
    this.events.push({ ...event, timestamp: Date.now() });
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    if (event.type === "fingerspell") this.fingerspellCount++;
    if (event.type === "phrase_resolved") this.phraseResolutionCount++;
    if (event.type === "gesture_played" && event.details?.includes("gloss")) this.glossResolutionCount++;
    if (event.type === "translation_latency" && event.duration) {
      this.totalTranslationLatency += event.duration;
      this.translationLatencyCount++;
    }
  }

  getTotalPlayed(): number {
    return this.events.filter((e) => e.type === "gesture_played").length;
  }

  getMissingTransitions(): string[] {
    return this.events
      .filter((e) => e.type === "transition" && e.details?.includes("missing"))
      .map((e) => e.gesture ?? "");
  }

  getUnknownGlosses(): string[] {
    return this.events
      .filter((e) => e.type === "resolution_fallback")
      .map((e) => e.gesture ?? "");
  }

  getFingerspellCount(): number {
    return this.fingerspellCount;
  }

  getPhraseResolutionCount(): number {
    return this.phraseResolutionCount;
  }

  getGlossResolutionCount(): number {
    return this.glossResolutionCount;
  }

  getFallbackRate(): number {
    const total = this.getTotalPlayed();
    return total > 0 ? this.fingerspellCount / total : 0;
  }

  getAveragePlaybackFPS(): number {
    const fpsEvents = this.events.filter((e) => e.type === "gesture_played" && e.duration && e.duration > 0);
    if (fpsEvents.length === 0) return 0;
    const totalFPS = fpsEvents.reduce((sum, e) => sum + (e.duration ?? 0), 0);
    return totalFPS / fpsEvents.length;
  }

  getAverageTranslationLatency(): number {
    return this.translationLatencyCount > 0
      ? this.totalTranslationLatency / this.translationLatencyCount
      : 0;
  }

  getCacheHitRate(cache: AnimationCache): number {
    const stats = cache.getStats();
    return stats.hitRate;
  }

  getTotalSessionDuration(): number {
    return Date.now() - this.sessionStart;
  }

  getEvents(): PlaybackAnalyticsEvent[] {
    return [...this.events];
  }

  getAverageSentenceLength(): number {
    const sentenceEvents = this.events.filter((e) => e.details?.includes("length"));
    if (sentenceEvents.length === 0) return 0;
    const total = sentenceEvents.reduce((sum, e) => sum + (parseInt(e.details?.match(/length:(\d+)/)?.[1] ?? "0")), 0);
    return total / sentenceEvents.length;
  }

  getUniqueGestures(): string[] {
    return [...new Set(this.events.filter((e) => e.gesture).map((e) => e.gesture!))];
  }

  getMostPlayed(): Array<{ gesture: string; count: number }> {
    const counts = new Map<string, number>();
    for (const e of this.events) {
      if (e.gesture) {
        counts.set(e.gesture, (counts.get(e.gesture) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([gesture, count]) => ({ gesture, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  reset(): void {
    this.events = [];
    this.sessionStart = Date.now();
    this.fingerspellCount = 0;
    this.totalTranslationLatency = 0;
    this.translationLatencyCount = 0;
    this.phraseResolutionCount = 0;
    this.glossResolutionCount = 0;
  }
}
