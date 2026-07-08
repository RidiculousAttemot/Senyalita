export type AnimationPlaybackEvent = {
  gestureLabel: string;
  timestamp: number;
  type: "play" | "replay" | "interrupt" | "complete";
  duration: number;
  avatarStyle: string;
  playbackSpeed: number;
};

export type AnimationGestureStats = {
  gestureLabel: string;
  totalPlays: number;
  replays: number;
  interruptions: number;
  completions: number;
  averageDuration: number;
  completionRate: number;
  interruptionRate: number;
  preferredStyles: Record<string, number>;
  lastPlayedAt: number;
};

export type AnimationTrackingStats = {
  totalPlays: number;
  totalReplays: number;
  totalInterruptions: number;
  totalCompletions: number;
  averageDuration: number;
  overallCompletionRate: number;
  preferredStyleOverall: string;
  mostPlayedGestures: AnimationGestureStats[];
  leastCompletedGestures: AnimationGestureStats[];
};

export class AnimationUsageTracker {
  private events: AnimationPlaybackEvent[] = [];
  private storageKey = "fsl_animation_usage";

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        this.events = JSON.parse(raw);
      }
    } catch {}
  }

  private saveToStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch {}
  }

  record(event: Omit<AnimationPlaybackEvent, "timestamp">): void {
    this.events.push({ ...event, timestamp: Date.now() });
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
    this.saveToStorage();
  }

  recordPlay(gestureLabel: string, avatarStyle: string, playbackSpeed = 1): void {
    this.record({ gestureLabel, type: "play", duration: 0, avatarStyle, playbackSpeed });
  }

  recordReplay(gestureLabel: string, avatarStyle: string): void {
    this.record({ gestureLabel, type: "replay", duration: 0, avatarStyle, playbackSpeed: 1 });
  }

  recordInterrupt(gestureLabel: string, duration: number, avatarStyle: string): void {
    this.record({ gestureLabel, type: "interrupt", duration, avatarStyle, playbackSpeed: 1 });
  }

  recordComplete(gestureLabel: string, duration: number, avatarStyle: string): void {
    this.record({ gestureLabel, type: "complete", duration, avatarStyle, playbackSpeed: 1 });
  }

  getGestureStats(gestureLabel: string): AnimationGestureStats {
    const gestureEvents = this.events.filter((e) => e.gestureLabel === gestureLabel);
    const plays = gestureEvents.filter((e) => e.type === "play").length;
    const replays = gestureEvents.filter((e) => e.type === "replay").length;
    const interruptions = gestureEvents.filter((e) => e.type === "interrupt").length;
    const completions = gestureEvents.filter((e) => e.type === "complete").length;
    const durations = gestureEvents.filter((e) => e.duration > 0).map((e) => e.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
    const totalAttempts = plays + replays;
    const completionRate = totalAttempts > 0 ? completions / totalAttempts : 0;
    const interruptionRate = totalAttempts > 0 ? interruptions / totalAttempts : 0;
    const styleCounts: Record<string, number> = {};
    for (const e of gestureEvents) {
      styleCounts[e.avatarStyle] = (styleCounts[e.avatarStyle] ?? 0) + 1;
    }
    const lastPlayed = gestureEvents.length > 0
      ? Math.max(...gestureEvents.map((e) => e.timestamp))
      : 0;

    return {
      gestureLabel,
      totalPlays: plays,
      replays,
      interruptions,
      completions,
      averageDuration: avgDuration,
      completionRate,
      interruptionRate,
      preferredStyles: styleCounts,
      lastPlayedAt: lastPlayed,
    };
  }

  getAllEvents(): AnimationPlaybackEvent[] {
    return [...this.events];
  }

  getOverallStats(): AnimationTrackingStats {
    const plays = this.events.filter((e) => e.type === "play").length;
    const replays = this.events.filter((e) => e.type === "replay").length;
    const interruptions = this.events.filter((e) => e.type === "interrupt").length;
    const completions = this.events.filter((e) => e.type === "complete").length;
    const durations = this.events.filter((e) => e.duration > 0).map((e) => e.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
    const totalAttempts = plays + replays;
    const overallCompletionRate = totalAttempts > 0 ? completions / totalAttempts : 0;

    const styleCounts: Record<string, number> = {};
    for (const e of this.events) {
      styleCounts[e.avatarStyle] = (styleCounts[e.avatarStyle] ?? 0) + 1;
    }
    const preferredStyleOverall = Object.entries(styleCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "minimal";

    const gestureLabels = [...new Set(this.events.map((e) => e.gestureLabel))];
    const allStats = gestureLabels.map((label) => this.getGestureStats(label));
    const mostPlayed = [...allStats].sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 10);
    const leastCompleted = [...allStats]
      .filter((s) => s.totalPlays > 0)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 10);

    return {
      totalPlays: plays,
      totalReplays: replays,
      totalInterruptions: interruptions,
      totalCompletions: completions,
      averageDuration: avgDuration,
      overallCompletionRate,
      preferredStyleOverall,
      mostPlayedGestures: mostPlayed,
      leastCompletedGestures: leastCompleted,
    };
  }

  clear(): void {
    this.events = [];
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const globalAnimationTracker = new AnimationUsageTracker();
