"use client";

import { useMemo } from "react";

type Props = {
  lowConfidenceLabel: string;
  topK: Array<{ label: string; confidence: number }>;
  confusionPairs?: Array<{ gesture_label: string; confused_with: string; count: number }>;
  onSelect: (label: string) => void;
};

const COMMON_ALTERNATIVES: Record<string, string[]> = {
  "Thank You": ["Please", "Sorry", "You're Welcome", "Help"],
  "Hello": ["Good Morning", "Good Afternoon", "Good Evening", "How Are You"],
  "Please": ["Sorry", "Thank You", "Help", "Excuse Me"],
  "Sorry": ["Please", "Thank You", "Help", "Excuse Me"],
  "Good Morning": ["Hello", "Good Afternoon", "Good Evening", "How Are You"],
  "Help": ["Please", "Thank You", "Sorry", "Emergency"],
};

export const GestureRecommendations = ({
  lowConfidenceLabel,
  topK,
  confusionPairs,
  onSelect,
}: Props) => {
  const alternatives = useMemo(() => {
    const suggestions = new Set<string>();
    
    for (const pred of topK) {
      if (pred.confidence > 0.1) {
        suggestions.add(pred.label);
      }
    }
    
    if (confusionPairs) {
      for (const pair of confusionPairs) {
        if (pair.gesture_label === lowConfidenceLabel) {
          suggestions.add(pair.confused_with);
        }
        if (pair.confused_with === lowConfidenceLabel) {
          suggestions.add(pair.gesture_label);
        }
      }
    }
    
    const common = COMMON_ALTERNATIVES[lowConfidenceLabel];
    if (common) {
      for (const alt of common) {
        suggestions.add(alt);
      }
    }
    
    return Array.from(suggestions).slice(0, 5);
  }, [lowConfidenceLabel, topK, confusionPairs]);

  if (alternatives.length === 0) return null;

  return (
    <div className="gesture-recommendations">
      <p className="gesture-recommendations-title">Did you mean?</p>
      <div className="gesture-recommendations-list">
        {alternatives.map((label) => (
          <button
            key={label}
            className="gesture-recommendation-btn"
            onClick={() => onSelect(label)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
