export type LanguageOption = "en" | "tl";

export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
};

export type HandLandmarks = LandmarkPoint[];

export type LandmarkFrame = {
  hands: HandLandmarks[];
};

export type PredictionSuggestion = {
  text: string;
  confidence: number;
};

export type PredictionResult = {
  text: string;
  confidence: number;
  suggestions: PredictionSuggestion[];
  handCount: number;
  language: LanguageOption;
};

export type RecognitionState =
  | { stage: "loading-model" }
  | { stage: "predicting"; result: RealPredictionResult | null }
  | { stage: "error"; message: string };

export type RecognitionSource = "static" | "temporal" | "hybrid" | "unknown";

export type RealPredictionResult = {
  label: string;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
  category: RecognitionCategory;
  recognitionSource: RecognitionSource;
};

export type RecognitionCategory = "alphabet" | "phrase";
