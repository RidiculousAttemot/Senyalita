export type ResearchMetrics = {
  recognitionAccuracy: number;
  macroF1: number;
  inferenceLatencyMs: number;
  fps: number;
  memoryUsageMb: number;
  communicationSuccessRate: number;
  userFeedback: UserFeedbackSummary;
  confidenceDistribution: ConfidenceDistribution;
  confusionMatrix: ConfusionPair[];
  datasetGrowth: DatasetGrowthEntry[];
  activeLearningStats: ActiveLearningStats;
};

export type UserFeedbackSummary = {
  totalRatings: number;
  positiveRatings: number;
  negativeRatings: number;
  averageRating: number;
  recentTrend: number[];
};

export type ConfidenceDistribution = {
  ranges: Array<{ range: string; count: number }>;
  averageConfidence: number;
  medianConfidence: number;
};

export type ConfusionPair = {
  predicted: string;
  actual: string;
  count: number;
};

export type DatasetGrowthEntry = {
  date: string;
  sampleCount: number;
  classCount: number;
  signerCount: number;
};

export type ActiveLearningStats = {
  totalQueries: number;
  labeledQueries: number;
  pendingQueries: number;
  labelDistribution: Array<{ label: string; count: number }>;
  uncertaintyScores: number[];
};

export class ResearchDashboard {
  private accuracyHistory: number[] = [];
  private f1History: number[] = [];
  private latencyHistory: number[] = [];
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  private communicationSuccessHistory: number[] = [];
  private feedbackHistory: Array<{ rating: number; timestamp: number }> = [];
  private confidenceHistory: number[] = [];
  private confusionPairs: Map<string, number> = new Map();
  private datasetGrowth: DatasetGrowthEntry[] = [];
  private activeLearningData: ActiveLearningStats = {
    totalQueries: 0,
    labeledQueries: 0,
    pendingQueries: 0,
    labelDistribution: [],
    uncertaintyScores: [],
  };

  recordAccuracy(accuracy: number): void {
    this.accuracyHistory.push(accuracy);
    if (this.accuracyHistory.length > 1000) this.accuracyHistory.shift();
  }

  recordF1(f1: number): void {
    this.f1History.push(f1);
    if (this.f1History.length > 1000) this.f1History.shift();
  }

  recordLatency(latencyMs: number): void {
    this.latencyHistory.push(latencyMs);
    if (this.latencyHistory.length > 1000) this.latencyHistory.shift();
  }

  recordFps(fps: number): void {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 1000) this.fpsHistory.shift();
  }

  recordMemory(memoryMb: number): void {
    this.memoryHistory.push(memoryMb);
    if (this.memoryHistory.length > 1000) this.memoryHistory.shift();
  }

  recordCommunicationSuccess(successful: boolean): void {
    this.communicationSuccessHistory.push(successful ? 1 : 0);
    if (this.communicationSuccessHistory.length > 1000) this.communicationSuccessHistory.shift();
  }

  recordFeedback(rating: number): void {
    this.feedbackHistory.push({ rating, timestamp: Date.now() });
    if (this.feedbackHistory.length > 500) this.feedbackHistory.shift();
  }

  recordConfidence(confidence: number): void {
    this.confidenceHistory.push(confidence);
    if (this.confidenceHistory.length > 1000) this.confidenceHistory.shift();
  }

  recordConfusion(predicted: string, actual: string): void {
    const key = `${predicted}->${actual}`;
    this.confusionPairs.set(key, (this.confusionPairs.get(key) ?? 0) + 1);
  }

  recordDatasetGrowth(entry: DatasetGrowthEntry): void {
    this.datasetGrowth.push(entry);
    if (this.datasetGrowth.length > 365) this.datasetGrowth.shift();
  }

  recordActiveLearning(label: string, uncertaintyScore: number): void {
    this.activeLearningData.totalQueries++;
    this.activeLearningData.uncertaintyScores.push(uncertaintyScore);
    if (this.activeLearningData.uncertaintyScores.length > 1000) {
      this.activeLearningData.uncertaintyScores.shift();
    }

    const existing = this.activeLearningData.labelDistribution.find(d => d.label === label);
    if (existing) {
      existing.count++;
    } else {
      this.activeLearningData.labelDistribution.push({ label, count: 1 });
    }
  }

  markActiveLearningLabeled(): void {
    this.activeLearningData.labeledQueries++;
    this.activeLearningData.pendingQueries = Math.max(0, this.activeLearningData.totalQueries - this.activeLearningData.labeledQueries);
  }

  getMetrics(): ResearchMetrics {
    const avgConfidence = this.confidenceHistory.length > 0
      ? this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length
      : 0;

    const sortedConfidence = [...this.confidenceHistory].sort((a, b) => a - b);
    const medianConfidence = sortedConfidence.length > 0
      ? sortedConfidence[Math.floor(sortedConfidence.length / 2)]
      : 0;

    const confidenceRanges = [
      { range: "0-20%", min: 0, max: 0.2 },
      { range: "20-40%", min: 0.2, max: 0.4 },
      { range: "40-60%", min: 0.4, max: 0.6 },
      { range: "60-80%", min: 0.6, max: 0.8 },
      { range: "80-100%", min: 0.8, max: 1.0 },
    ];

    const confidenceDistribution: ConfidenceDistribution = {
      ranges: confidenceRanges.map(r => ({
        range: r.range,
        count: this.confidenceHistory.filter(c => c >= r.min && c < r.max).length,
      })),
      averageConfidence: avgConfidence,
      medianConfidence,
    };

    const totalFeedbacks = this.feedbackHistory.length;
    const positiveFeedbacks = this.feedbackHistory.filter(f => f.rating >= 4).length;
    const negativeFeedbacks = this.feedbackHistory.filter(f => f.rating <= 2).length;
    const avgRating = totalFeedbacks > 0
      ? this.feedbackHistory.reduce((a, f) => a + f.rating, 0) / totalFeedbacks
      : 0;

    const recentFeedbackTrend = this.feedbackHistory.slice(-20).map(f => f.rating);

    const confusionMatrixList: ConfusionPair[] = [];
    for (const [key, count] of this.confusionPairs) {
      const [predicted, actual] = key.split("->");
      confusionMatrixList.push({ predicted, actual, count });
    }
    confusionMatrixList.sort((a, b) => b.count - a.count);

    const successCount = this.communicationSuccessHistory.filter(v => v === 1).length;
    const communicationSuccessRate = this.communicationSuccessHistory.length > 0
      ? successCount / this.communicationSuccessHistory.length
      : 0;

    return {
      recognitionAccuracy: this.getAverage(this.accuracyHistory),
      macroF1: this.getAverage(this.f1History),
      inferenceLatencyMs: this.getAverage(this.latencyHistory),
      fps: this.getAverage(this.fpsHistory),
      memoryUsageMb: this.getAverage(this.memoryHistory),
      communicationSuccessRate,
      userFeedback: {
        totalRatings: totalFeedbacks,
        positiveRatings: positiveFeedbacks,
        negativeRatings: negativeFeedbacks,
        averageRating: avgRating,
        recentTrend: recentFeedbackTrend,
      },
      confidenceDistribution,
      confusionMatrix: confusionMatrixList.slice(0, 50),
      datasetGrowth: this.datasetGrowth,
      activeLearningStats: {
        ...this.activeLearningData,
        pendingQueries: this.activeLearningData.totalQueries - this.activeLearningData.labeledQueries,
      },
    };
  }

  private getAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  exportCsv(): string {
    const metrics = this.getMetrics();
    const lines: string[] = ["metric,value"];
    lines.push(`recognition_accuracy,${metrics.recognitionAccuracy}`);
    lines.push(`macro_f1,${metrics.macroF1}`);
    lines.push(`inference_latency_ms,${metrics.inferenceLatencyMs}`);
    lines.push(`fps,${metrics.fps}`);
    lines.push(`memory_usage_mb,${metrics.memoryUsageMb}`);
    lines.push(`communication_success_rate,${metrics.communicationSuccessRate}`);
    lines.push(`average_confidence,${metrics.confidenceDistribution.averageConfidence}`);
    lines.push(`median_confidence,${metrics.confidenceDistribution.medianConfidence}`);
    lines.push(`user_feedback_total,${metrics.userFeedback.totalRatings}`);
    lines.push(`user_feedback_positive,${metrics.userFeedback.positiveRatings}`);
    lines.push(`user_feedback_negative,${metrics.userFeedback.negativeRatings}`);
    lines.push(`user_feedback_avg_rating,${metrics.userFeedback.averageRating}`);
    lines.push(`active_learning_total,${metrics.activeLearningStats.totalQueries}`);
    lines.push(`active_learning_labeled,${metrics.activeLearningStats.labeledQueries}`);
    lines.push(`active_learning_pending,${metrics.activeLearningStats.pendingQueries}`);
    return lines.join("\n");
  }

  exportJson(): string {
    return JSON.stringify(this.getMetrics(), null, 2);
  }

  reset(): void {
    this.accuracyHistory = [];
    this.f1History = [];
    this.latencyHistory = [];
    this.fpsHistory = [];
    this.memoryHistory = [];
    this.communicationSuccessHistory = [];
    this.feedbackHistory = [];
    this.confidenceHistory = [];
    this.confusionPairs.clear();
    this.datasetGrowth = [];
    this.activeLearningData = {
      totalQueries: 0,
      labeledQueries: 0,
      pendingQueries: 0,
      labelDistribution: [],
      uncertaintyScores: [],
    };
  }
}
