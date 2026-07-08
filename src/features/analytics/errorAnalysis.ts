export interface LowConfidenceRecord {
  predictedGesture: string;
  expectedGesture?: string;
  confidence: number;
  motionScore: number;
  timestamp: string;
  signerId?: string;
  lightingEstimate?: number;
  cameraAngleEstimate?: number;
}

export interface ConfusionPair {
  predicted: string;
  expected: string;
  count: number;
  avgConfidence: number;
  trend: number[];
}

export interface UnstableGesture {
  gesture: string;
  avgConfidence: number;
  variance: number;
  correctionRate: number;
  sampleCount: number;
}

export interface EnvironmentalTrend {
  condition: string;
  gesture: string;
  avgConfidence: number;
  sampleCount: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalPredictions: number;
  lowConfidenceCount: number;
  confusionPairs: ConfusionPair[];
  unstableGestures: UnstableGesture[];
  environmentalTrends: EnvironmentalTrend[];
  signerTrends: Array<{ signerId: string; avgConfidence: number; count: number }>;
}

export class ErrorAnalysisEngine {
  private records: LowConfidenceRecord[] = [];

  addRecord(record: LowConfidenceRecord): void {
    this.records.push(record);
    if (this.records.length > 10000) this.records.shift();
  }

  addBatch(records: LowConfidenceRecord[]): void {
    for (const r of records) this.addRecord(r);
  }

  findConfusionPairs(minOccurrences = 3): ConfusionPair[] {
    const pairMap = new Map<string, { predicted: string; expected: string; count: number; confs: number[]; dates: string[] }>();

    for (const r of this.records) {
      if (!r.expectedGesture) continue;
      const key = `${r.predictedGesture}->${r.expectedGesture}`;
      const existing = pairMap.get(key) ?? {
        predicted: r.predictedGesture,
        expected: r.expectedGesture,
        count: 0,
        confs: [],
        dates: [],
      };
      existing.count++;
      existing.confs.push(r.confidence);
      existing.dates.push(r.timestamp);
      pairMap.set(key, existing);
    }

    return [...pairMap.values()]
      .filter((p) => p.count >= minOccurrences)
      .sort((a, b) => b.count - a.count)
      .map((p) => ({
        predicted: p.predicted,
        expected: p.expected,
        count: p.count,
        avgConfidence: p.confs.reduce((s, c) => s + c, 0) / p.confs.length,
        trend: computeTrend(p.dates, p.confs),
      }));
  }

  findUnstableGestures(minSamples = 5): UnstableGesture[] {
    const gestureMap = new Map<string, { confs: number[]; corrections: number; total: number }>();

    for (const r of this.records) {
      const existing = gestureMap.get(r.predictedGesture) ?? { confs: [], corrections: 0, total: 0 };
      existing.confs.push(r.confidence);
      existing.total++;
      if (r.expectedGesture && r.expectedGesture !== r.predictedGesture) existing.corrections++;
      gestureMap.set(r.predictedGesture, existing);
    }

    return [...gestureMap.entries()]
      .filter(([_, data]) => data.total >= minSamples)
      .map(([gesture, data]) => {
        const avg = data.confs.reduce((s, c) => s + c, 0) / data.confs.length;
        const variance = data.confs.reduce((s, c) => s + (c - avg) ** 2, 0) / data.confs.length;
        return {
          gesture,
          avgConfidence: avg,
          variance,
          correctionRate: data.total > 0 ? data.corrections / data.total : 0,
          sampleCount: data.total,
        };
      })
      .sort((a, b) => b.variance - a.variance);
  }

  findEnvironmentalTrends(): EnvironmentalTrend[] {
    const envMap = new Map<string, { confs: number[]; count: number }>();

    for (const r of this.records) {
      if (r.lightingEstimate === undefined && r.cameraAngleEstimate === undefined) continue;
      const conditions: string[] = [];
      if (r.lightingEstimate !== undefined) {
        conditions.push(r.lightingEstimate < 0.3 ? "low-light" : r.lightingEstimate > 0.7 ? "bright" : "normal-light");
      }
      if (r.cameraAngleEstimate !== undefined) {
        conditions.push(r.cameraAngleEstimate < 0.3 ? "side-angle" : r.cameraAngleEstimate > 0.7 ? "front-angle" : "angled");
      }
      const conditionKey = conditions.join("+") || "unknown";

      for (const cond of conditions) {
        const key = `${cond}:${r.predictedGesture}`;
        const existing = envMap.get(key) ?? { confs: [], count: 0 };
        existing.confs.push(r.confidence);
        existing.count++;
        envMap.set(key, existing);
      }
    }

    return [...envMap.entries()]
      .filter(([_, data]) => data.count >= 3)
      .map(([key, data]) => {
        const [condition, gesture] = key.split(":");
        return {
          condition,
          gesture,
          avgConfidence: data.confs.reduce((s, c) => s + c, 0) / data.confs.length,
          sampleCount: data.count,
        };
      })
      .sort((a, b) => a.avgConfidence - b.avgConfidence);
  }

  findSignerTrends(): Array<{ signerId: string; avgConfidence: number; count: number }> {
    const signerMap = new Map<string, { confs: number[] }>();

    for (const r of this.records) {
      if (!r.signerId) continue;
      const existing = signerMap.get(r.signerId) ?? { confs: [] };
      existing.confs.push(r.confidence);
      signerMap.set(r.signerId, existing);
    }

    return [...signerMap.entries()]
      .map(([signerId, data]) => ({
        signerId,
        avgConfidence: data.confs.reduce((s, c) => s + c, 0) / data.confs.length,
        count: data.confs.length,
      }))
      .sort((a, b) => a.avgConfidence - b.avgConfidence);
  }

  generateWeeklyReport(): WeeklyReport {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

    const weekRecords = this.records.filter((r) => r.timestamp >= weekStart);

    const engine = new ErrorAnalysisEngine();
    engine.addBatch(weekRecords);

    return {
      weekStart,
      weekEnd: now.toISOString(),
      totalPredictions: weekRecords.length,
      lowConfidenceCount: weekRecords.filter((r) => r.confidence < 0.5).length,
      confusionPairs: engine.findConfusionPairs(2),
      unstableGestures: engine.findUnstableGestures(3),
      environmentalTrends: engine.findEnvironmentalTrends(),
      signerTrends: engine.findSignerTrends(),
    };
  }

  getRecords(): LowConfidenceRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}

function computeTrend(dates: string[], values: number[]): number[] {
  if (values.length < 2) return values;
  const sorted = dates.map((d, i) => ({ date: new Date(d).getTime(), value: values[i] }))
    .sort((a, b) => a.date - b.date);
  return sorted.map((s) => s.value);
}

export const globalErrorAnalysis = new ErrorAnalysisEngine();
