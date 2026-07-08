export type AdaptiveThresholdConfig = {
  gesture: string;
  baseThreshold: number;
  adjustedThreshold: number;
  signerHistory: string[];
  confidenceHistory: number[];
  lightingQuality: number | null;
  motionQuality: number | null;
  lastUpdated: number;
  sampleSize: number;
};

export type ThresholdAdjustmentFactors = {
  signerConfidenceBias: number;
  recentTrend: number;
  motionQualityBoost: number;
  lightingPenalty: number;
  overallAdjustment: number;
};

export class AdaptiveConfidenceManager {
  private thresholds: Map<string, AdaptiveThresholdConfig> = new Map();
  private globalDefault = 0.6;
  private persistenceKey = "fsl_adaptive_thresholds";

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(this.persistenceKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ gesture: string; config: AdaptiveThresholdConfig }>;
        for (const { gesture, config } of parsed) {
          this.thresholds.set(gesture, config);
        }
      }
    } catch {}
  }

  private saveToStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const entries = Array.from(this.thresholds.entries()).map(([gesture, config]) => ({
        gesture,
        config,
      }));
      localStorage.setItem(this.persistenceKey, JSON.stringify(entries));
    } catch {}
  }

  getThreshold(gesture: string): number {
    const config = this.thresholds.get(gesture);
    if (!config || config.sampleSize < 3) return this.globalDefault;
    return config.adjustedThreshold;
  }

  getConfig(gesture: string): AdaptiveThresholdConfig | null {
    return this.thresholds.get(gesture) ?? null;
  }

  recordPrediction(gesture: string, confidence: number, signerId?: string, metadata?: {
    lightingQuality?: number;
    motionQuality?: number;
  }): void {
    let config = this.thresholds.get(gesture);
    if (!config) {
      config = {
        gesture,
        baseThreshold: this.globalDefault,
        adjustedThreshold: this.globalDefault,
        signerHistory: [],
        confidenceHistory: [],
        lightingQuality: null,
        motionQuality: null,
        lastUpdated: Date.now(),
        sampleSize: 0,
      };
      this.thresholds.set(gesture, config);
    }

    config.confidenceHistory.push(confidence);
    if (signerId && !config.signerHistory.includes(signerId)) {
      config.signerHistory.push(signerId);
    }
    if (metadata?.lightingQuality !== undefined) {
      config.lightingQuality = config.lightingQuality !== null
        ? (config.lightingQuality + metadata.lightingQuality) / 2
        : metadata.lightingQuality;
    }
    if (metadata?.motionQuality !== undefined) {
      config.motionQuality = config.motionQuality !== null
        ? (config.motionQuality + metadata.motionQuality) / 2
        : metadata.motionQuality;
    }
    config.sampleSize++;
    config.lastUpdated = Date.now();
    config.adjustedThreshold = this.computeAdjustedThreshold(config);
    this.saveToStorage();
  }

  private computeAdjustedThreshold(config: AdaptiveThresholdConfig): number {
    if (config.sampleSize < 3) return this.globalDefault;

    const history = config.confidenceHistory;
    const recent = history.slice(-20);
    const avgConfidence = recent.reduce((s, c) => s + c, 0) / recent.length;

    const variance = recent.reduce((s, c) => s + (c - avgConfidence) ** 2, 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    const highConfRate = recent.filter((c) => c >= 0.7).length / recent.length;
    const lowConfRate = recent.filter((c) => c < 0.5).length / recent.length;

    let adjustment = 0;

    if (highConfRate > 0.6 && stdDev < 0.1) {
      adjustment -= 0.05;
    }

    if (lowConfRate > 0.3 && stdDev > 0.15) {
      adjustment += 0.05;
    }

    if (stdDev > 0.2 && avgConfidence < 0.6) {
      adjustment += 0.1;
    }

    if (avgConfidence > 0.8 && stdDev < 0.08 && config.sampleSize > 20) {
      adjustment -= 0.05;
    }

    if (config.motionQuality !== null && config.motionQuality < 0.3) {
      adjustment += 0.05;
    }

    if (config.lightingQuality !== null && config.lightingQuality < 0.3) {
      adjustment += 0.03;
    }

    const adjusted = Math.max(0.4, Math.min(0.9, this.globalDefault + adjustment));
    return Math.round(adjusted * 100) / 100;
  }

  getAdjustmentFactors(gesture: string): ThresholdAdjustmentFactors | null {
    const config = this.thresholds.get(gesture);
    if (!config) return null;

    const recent = config.confidenceHistory.slice(-20);
    const avgConf = recent.length > 0 ? recent.reduce((s, c) => s + c, 0) / recent.length : 0;
    const trend = recent.length >= 5
      ? (recent[recent.length - 1] - recent[recent.length - 5]) / 5
      : 0;

    return {
      signerConfidenceBias: config.signerHistory.length > 5 ? 0.02 : 0,
      recentTrend: trend * 0.3,
      motionQualityBoost: config.motionQuality !== null && config.motionQuality > 0.6 ? -0.03 : 0,
      lightingPenalty: config.lightingQuality !== null && config.lightingQuality < 0.3 ? 0.03 : 0,
      overallAdjustment: config.adjustedThreshold - this.globalDefault,
    };
  }

  getAllThresholds(): AdaptiveThresholdConfig[] {
    return Array.from(this.thresholds.values());
  }

  resetGesture(gesture: string): void {
    this.thresholds.delete(gesture);
    this.saveToStorage();
  }

  resetAll(): void {
    this.thresholds.clear();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.persistenceKey);
    }
  }

  setGlobalDefault(threshold: number): void {
    this.globalDefault = Math.max(0.4, Math.min(0.9, threshold));
  }

  getGlobalDefault(): number {
    return this.globalDefault;
  }
}

export const globalThresholdManager = new AdaptiveConfidenceManager();
