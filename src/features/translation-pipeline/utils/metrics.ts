import type { TranslationMetrics, TranslationEvalRecord, TranslationCoverageStats } from "../types";

const MAX_EVAL_RECORDS = 1000;

class MetricsCollector {
  private evalRecords: TranslationEvalRecord[] = [];
  private glossFrequency = new Map<string, number>();
  private unknownWordsFrequency = new Map<string, number>();
  private fallbackFrequency = new Map<string, number>();
  private translationRequests = new Map<string, number>();

  recordTranslation(record: TranslationEvalRecord): void {
    this.evalRecords.push(record);
    if (this.evalRecords.length > MAX_EVAL_RECORDS) {
      this.evalRecords.shift();
    }

    const inputLower = record.input.toLowerCase();
    this.translationRequests.set(
      inputLower,
      (this.translationRequests.get(inputLower) ?? 0) + 1
    );

    for (const gloss of record.glossSequence) {
      this.glossFrequency.set(gloss, (this.glossFrequency.get(gloss) ?? 0) + 1);
    }

    for (const word of record.unknownWords) {
      this.unknownWordsFrequency.set(word, (this.unknownWordsFrequency.get(word) ?? 0) + 1);
    }
  }

  recordFallback(gloss: string): void {
    this.fallbackFrequency.set(gloss, (this.fallbackFrequency.get(gloss) ?? 0) + 1);
  }

  getCoverageStats(): TranslationCoverageStats {
    const records = this.evalRecords;
    if (records.length === 0) {
      return {
        totalRequests: 0,
        uniqueInputs: 0,
        totalGlossesGenerated: 0,
        totalUnknownGlosses: 0,
        totalFallbacks: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        averageSentenceLength: 0,
        averagePlaybackDuration: 0,
        mostRequestedTranslations: [],
        glossFrequency: {},
        unknownWordsFrequency: {},
        fallbackFrequency: {},
        coverageRate: 1,
      };
    }

    const totalRequests = records.length;
    const uniqueInputs = new Set(records.map((r) => r.input.toLowerCase())).size;
    const totalGlossesGenerated = records.reduce((sum, r) => sum + r.glossSequence.length, 0);
    const totalUnknownGlosses = records.reduce((sum, r) => sum + r.unknownWords.length, 0);
    const totalFallbacks = records.reduce((sum, r) => sum + r.fallbackCount, 0);
    const averageConfidence = records.reduce((sum, r) => sum + r.confidence, 0) / totalRequests;
    const averageProcessingTime = records.reduce((sum, r) => sum + r.processingTimeMs, 0) / totalRequests;
    const averageSentenceLength = totalGlossesGenerated / totalRequests;
    const averagePlaybackDuration = records.reduce((sum, r) => sum + r.planDuration, 0) / totalRequests;

    const coverageRate = totalGlossesGenerated > 0
      ? 1 - (totalUnknownGlosses / totalGlossesGenerated)
      : 1;

    const mostRequestedTranslations = [...this.translationRequests.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalRequests,
      uniqueInputs,
      totalGlossesGenerated,
      totalUnknownGlosses,
      totalFallbacks,
      averageConfidence,
      averageProcessingTime,
      averageSentenceLength,
      averagePlaybackDuration,
      mostRequestedTranslations,
      glossFrequency: Object.fromEntries(this.glossFrequency),
      unknownWordsFrequency: Object.fromEntries(this.unknownWordsFrequency),
      fallbackFrequency: Object.fromEntries(this.fallbackFrequency),
      coverageRate,
    };
  }

  getRecentRecords(count: number = 50): TranslationEvalRecord[] {
    return this.evalRecords.slice(-count).reverse();
  }

  clear(): void {
    this.evalRecords = [];
    this.glossFrequency.clear();
    this.unknownWordsFrequency.clear();
    this.fallbackFrequency.clear();
    this.translationRequests.clear();
  }
}

export const globalMetricsCollector = new MetricsCollector();

export function computeMetrics(
  unknownCount: number,
  fallbackCount: number,
  glossCount: number,
  confidences: number[],
  duration: number,
): TranslationMetrics {
  return {
    inputLength: 0,
    wordCount: 0,
    glossCount,
    unknownCount,
    fallbackCount,
    averageConfidence: confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0,
    totalDuration: duration,
    coverage: glossCount > 0 ? 1 - (unknownCount / glossCount) : 1,
  };
}
