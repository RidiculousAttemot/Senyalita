import type { RetrainingSuggestion } from "./types";

export interface RetrainingCriteria {
  newSamplesAvailable: number;
  accuracyDecline: number;
  daysSinceLastTraining: number;
  lowConfidenceRate: number;
  datasetGrowth: number;
}

const MIN_SAMPLES_FOR_RETRAINING = 50;
const ACCURACY_DECLINE_THRESHOLD = 0.02;
const DAYS_SINCE_TRAINING_THRESHOLD = 14;
const LOW_CONFIDENCE_RATE_THRESHOLD = 0.25;

export function shouldSuggestRetraining(criteria: RetrainingCriteria): boolean {
  if (criteria.newSamplesAvailable >= MIN_SAMPLES_FOR_RETRAINING) return true;
  if (criteria.accuracyDecline >= ACCURACY_DECLINE_THRESHOLD) return true;
  if (criteria.daysSinceLastTraining >= DAYS_SINCE_TRAINING_THRESHOLD && criteria.newSamplesAvailable >= 30) return true;
  if (criteria.lowConfidenceRate >= LOW_CONFIDENCE_RATE_THRESHOLD && criteria.newSamplesAvailable >= 20) return true;
  return false;
}

export function generateRetrainingSuggestion(criteria: RetrainingCriteria): RetrainingSuggestion {
  const accuracyGain = Math.min(5, Math.round((criteria.newSamplesAvailable / 100) * 2.5 * 10) / 10);
  const reasons: string[] = [];
  if (criteria.newSamplesAvailable >= MIN_SAMPLES_FOR_RETRAINING)
    reasons.push(`${criteria.newSamplesAvailable} new samples available`);
  if (criteria.accuracyDecline >= ACCURACY_DECLINE_THRESHOLD)
    reasons.push(`Accuracy declined by ${(criteria.accuracyDecline * 100).toFixed(1)}%`);
  if (criteria.daysSinceLastTraining >= DAYS_SINCE_TRAINING_THRESHOLD)
    reasons.push(`${criteria.daysSinceLastTraining} days since last training`);
  if (criteria.lowConfidenceRate >= LOW_CONFIDENCE_RATE_THRESHOLD)
    reasons.push(`Low confidence rate at ${(criteria.lowConfidenceRate * 100).toFixed(0)}%`);

  return {
    availableSamples: criteria.newSamplesAvailable,
    estimatedAccuracyGain: accuracyGain,
    reason: reasons.join("; ") || "Routine retraining recommended",
    createdAt: new Date().toISOString(),
  };
}
