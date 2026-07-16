import type { DatasetRecommendation } from "./types";

export interface ClassCount {
  gloss: string;
  count: number;
}

const TARGET_SAMPLES_PER_CLASS = 50;
const WARNING_THRESHOLD = 20;
const CRITICAL_THRESHOLD = 10;

export function analyzeDatasetBalance(classCounts: ClassCount[]): DatasetRecommendation[] {
  const recommendations: DatasetRecommendation[] = [];

  for (const item of classCounts) {
    if (item.count < CRITICAL_THRESHOLD) {
      recommendations.push({
        gloss: item.gloss,
        currentCount: item.count,
        targetCount: TARGET_SAMPLES_PER_CLASS,
        priority: "high",
        reason: `Only ${item.count} samples — critically low`,
      });
    } else if (item.count < WARNING_THRESHOLD) {
      recommendations.push({
        gloss: item.gloss,
        currentCount: item.count,
        targetCount: TARGET_SAMPLES_PER_CLASS,
        priority: "medium",
        reason: `Only ${item.count} samples — below recommended minimum`,
      });
    } else if (item.count < TARGET_SAMPLES_PER_CLASS) {
      recommendations.push({
        gloss: item.gloss,
        currentCount: item.count,
        targetCount: TARGET_SAMPLES_PER_CLASS,
        priority: "low",
        reason: `${item.count} samples — room for improvement`,
      });
    }
  }

  return recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export function rankByPriority(recommendations: DatasetRecommendation[]): DatasetRecommendation[] {
  return [...recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    const priorityDiff = order[a.priority] - order[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.currentCount - b.currentCount;
  });
}

export function calculateDatasetGrowth(
  history: Array<{ date: string; total: number }>,
): { currentTotal: number; thisMonth: number; growthPercent: number } {
  if (history.length < 2) return { currentTotal: 0, thisMonth: 0, growthPercent: 0 };
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const currentTotal = latest.total;
  const thisMonth = currentTotal - previous.total;
  const growthPercent = previous.total > 0
    ? Math.round((thisMonth / previous.total) * 100)
    : 0;
  return { currentTotal, thisMonth, growthPercent };
}
