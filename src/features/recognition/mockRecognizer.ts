import {
  LandmarkFrame,
  LanguageOption,
  PredictionResult,
  PredictionSuggestion
} from "./types";

type RecognizeInput = {
  frame: LandmarkFrame;
  handCount: number;
  language: LanguageOption;
};

const NO_SIGN_TEXT: Record<LanguageOption, string> = {
  en: "No sign detected yet.",
  tl: "Wala pang natutukoy na senyas."
};

const PRIMARY_TEXT: Record<LanguageOption, string> = {
  en: "Hello",
  tl: "Kumusta"
};

const SUGGESTIONS: Record<LanguageOption, PredictionSuggestion[]> = {
  en: [
    { text: "Hello", confidence: 0.85 },
    { text: "Thank you", confidence: 0.72 },
    { text: "Yes", confidence: 0.61 }
  ],
  tl: [
    { text: "Kumusta", confidence: 0.85 },
    { text: "Salamat", confidence: 0.72 },
    { text: "Oo", confidence: 0.61 }
  ]
};

export const recognizeMock = ({
  frame,
  handCount,
  language
}: RecognizeInput): PredictionResult => {
  const suggestions = SUGGESTIONS[language];

  if (!frame.hands.length || handCount === 0) {
    return {
      text: NO_SIGN_TEXT[language],
      confidence: 0,
      suggestions,
      handCount,
      language
    };
  }

  return {
    text: PRIMARY_TEXT[language],
    confidence: 0.85,
    suggestions,
    handCount,
    language
  };
};
