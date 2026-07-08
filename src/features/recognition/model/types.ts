export type RecognitionStatus =
  | "loading"
  | "ready"
  | "error";

export type InferenceResult = {
  label: string;
  labelId: number;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
};

export type ModelLoadResult = {
  status: RecognitionStatus;
  error?: string;
  modelVersion?: string;
  modelType?: string;
  classes?: number;
};
