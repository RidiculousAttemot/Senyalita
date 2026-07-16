export type ConfidenceLevel = "excellent" | "good" | "needs_review" | "hard_case";

export interface RecognitionResult {
  label: string;
  labelId: number;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
  landmarks?: Float32Array;
  timestamp?: string;
  sessionId?: string;
}

export interface CategorizedRecognition {
  result: RecognitionResult;
  level: ConfidenceLevel;
  category: string;
  reviewed: boolean;
}

export interface ReviewQueueItem {
  id: string;
  type: "low_confidence" | "unknown_gesture" | "animation_missing" | "translation_failure" | "validation_failure" | "user_correction";
  gestureLabel: string;
  confidence: number;
  source: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "relabeled" | "archived";
  correctedLabel: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  landmarksData: Record<string, unknown> | null;
  sessionId: string | null;
  videoFrameUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HardCaseDataset {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  status: "building" | "ready" | "exported" | "trained";
  items: HardCaseDatasetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface HardCaseDatasetItem {
  id: string;
  datasetId: string;
  reviewItemId: string;
  gestureLabel: string;
  assignedLabel: string;
  landmarksData: Record<string, unknown>;
  included: boolean;
  createdAt: string;
}

export interface TrainingExperiment {
  id: string;
  name: string;
  datasetVersion: string;
  modelArchitecture: string;
  modelVersion: string;
  epochs: number;
  learningRate: number;
  batchSize: number;
  accuracy: number | null;
  f1Score: number | null;
  precision: number | null;
  recall: number | null;
  latencyMs: number | null;
  datasetSize: number;
  status: "running" | "completed" | "failed" | "cancelled";
  deploymentStatus: "none" | "candidate" | "production" | "archived";
  confusionMatrix: Record<string, number> | null;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ModelDeployment {
  id: string;
  experimentId: string;
  modelVersion: string;
  architecture: string;
  accuracy: number;
  f1Score: number;
  latencyMs: number;
  datasetSize: number;
  status: "candidate" | "production" | "rolled_back" | "archived";
  deployedBy: string | null;
  deployedAt: string | null;
  rollbackAt: string | null;
  rollbackReason: string | null;
  notes: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "hard_cases" | "animation_missing" | "confidence_drop" | "training_complete" | "deployment_success" | "dataset_imbalance" | "validation_failure" | "retraining_ready";
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface TranslationFeedback {
  id: string;
  requestedText: string;
  generatedGlosses: string[];
  missingGlosses: string[];
  usedFallback: boolean;
  playbackFailed: boolean;
  failureReason: string | null;
  frequency: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetRecommendation {
  gloss: string;
  currentCount: number;
  targetCount: number;
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface ErrorAnalyticsSummary {
  totalPredictions: number;
  lowConfidence: number;
  highConfidenceErrors: number;
  mostConfused: Array<{ gloss: string; confusedWith: string; count: number }>;
  lowestConfidenceClasses: Array<{ gloss: string; avgConfidence: number; count: number }>;
  repeatedMistakes: Array<{ gloss: string; count: number }>;
  perClassAccuracy: Array<{ gloss: string; accuracy: number; total: number }>;
  recentImprovement: Array<{ date: string; accuracy: number }>;
  confusionHeatmap: Record<string, Record<string, number>>;
}

export interface RetrainingSuggestion {
  availableSamples: number;
  estimatedAccuracyGain: number;
  reason: string;
  createdAt: string;
}

export interface AiInsights {
  recognitionHealth: { score: number; status: string; details: string };
  animationCoverage: { percent: number; missing: number; details: string };
  datasetGrowth: { total: number; thisMonth: number; growth: number };
  modelPerformanceTrend: "improving" | "stable" | "declining";
  pendingReviews: number;
  hardCases: number;
  unknownSigns: number;
  recommendations: string[];
}
