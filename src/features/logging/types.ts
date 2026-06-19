export type LogEntry = {
  id: string;
  timestamp: string;
  predictedLabel: string;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
  smoothingEnabled: boolean;
  inferenceTimeMs: number;
  fps: number;
};

export type Session = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalPredictions: number;
  averageConfidence: number;
  averageInferenceTime: number;
  averageFps: number;
};

export type ConfidenceThreshold = 0.50 | 0.60 | 0.70 | 0.80;

export const CONFIDENCE_THRESHOLDS: ConfidenceThreshold[] = [0.50, 0.60, 0.70, 0.80];
export const DEFAULT_CONFIDENCE_THRESHOLD: ConfidenceThreshold = 0.60;

export type TranscriptEntry = {
  sessionId: string;
  label: string;
  timestamp: string;
};

export type SessionAnalytics = {
  mostRecognizedLabel: string;
  averageConfidence: number;
  lowestConfidenceLabel: string;
  lowestConfidence: number;
  highestConfidenceLabel: string;
  highestConfidence: number;
  sessionDurationMs: number;
  totalPredictions: number;
  labelCounts: Record<string, number>;
};
