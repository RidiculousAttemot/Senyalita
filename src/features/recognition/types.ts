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
