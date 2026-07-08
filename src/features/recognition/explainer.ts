import type { GesturePhase } from "./motionDetection";

export type ExplanationResult = {
  text: string;
  category: "high_confidence" | "low_confidence" | "confusion" | "motion" | "edge_case";
  contributingFactors: Record<string, unknown>;
};

export type PredictionExplanationInput = {
  label: string;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
  gesturePhase: GesturePhase;
  motionScore: number;
  bufferLength: number;
  inferenceTimeMs: number;
  smoothedLabel: string | null;
};

export interface ExplanationReport {
  input: PredictionExplanationInput;
  result: ExplanationResult;
  competitorAnalysis: Array<{ label: string; confidence: number; gap: number }>;
  motionQuality: { score: number; description: string };
  landmarkCompleteness: number;
  recognitionTimeline: Array<{ time: number; label: string; confidence: number }>;
  timestamp: string;
}

const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const MOTION_ACTIVITY_THRESHOLD = 0.02;

const SIMILAR_LABEL_GROUPS: Record<string, string[]> = {
  V: ["U", "W"],
  U: ["V", "W"],
  W: ["U", "V"],
  M: ["N"],
  N: ["M"],
  D: ["E", "F"],
  E: ["D", "F"],
  F: ["D", "E"],
  B: ["P"],
  P: ["B"],
  G: ["Q"],
  Q: ["G"],
  "Good Morning": ["Good Afternoon", "Good Evening"],
  "Good Afternoon": ["Good Morning", "Good Evening"],
  "Good Evening": ["Good Morning", "Good Afternoon"],
  "Thank You": ["Please", "Sorry"],
  Please: ["Thank You", "Sorry"],
  Sorry: ["Thank You", "Please"],
};

export class PredictionExplainer {
  explain(input: PredictionExplanationInput): ExplanationResult {
    const factors: Record<string, unknown> = {};
    const reasons: string[] = [];

    factors.confidence = input.confidence;
    factors.topK = input.topK.slice(0, 3);
    factors.gesturePhase = input.gesturePhase;
    factors.motionScore = input.motionScore;
    factors.bufferLength = input.bufferLength;

    if (input.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      reasons.push(
        `High confidence because the motion pattern closely matched the trained temporal signature for "${input.label}".`
      );
      factors.primary_contributor = "temporal_pattern_match";
      return {
        text: reasons.join(" "),
        category: "high_confidence",
        contributingFactors: factors,
      };
    }

    if (input.gesturePhase === "start") {
      reasons.push(
        "Low confidence because the gesture appears to still be in progress — only partial motion captured."
      );
      factors.primary_contributor = "incomplete_motion";
    }

    if (input.motionScore < 0.01 && input.gesturePhase === "none") {
      reasons.push(
        "Low confidence because hand orientation differs from the trained position for this gesture."
      );
      factors.primary_contributor = "hand_orientation_mismatch";
    }

    if (input.bufferLength < 10) {
      reasons.push(
        "Low confidence due to insufficient frame history — only a short motion sequence was available for inference."
      );
      factors.primary_contributor = "insufficient_frames";
    }

    if (input.confidence < LOW_CONFIDENCE_THRESHOLD) {
      const confusion = this.detectConfusion(input);
      if (confusion) {
        reasons.push(confusion.reason);
        factors.confused_with = confusion.label;
        factors.primary_contributor = "label_confusion";
      }
    }

    if (reasons.length === 0) {
      if (input.confidence >= 0.5) {
        reasons.push(
          `Moderate confidence — the gesture partially matched "${input.label}" but some motion features deviated from the training pattern.`
        );
        factors.primary_contributor = "partial_match";
      } else {
        reasons.push(
          `Low confidence because the motion pattern did not strongly match any trained gesture. The closest match was "${input.label}" at ${(input.confidence * 100).toFixed(0)}% confidence.`
        );
        factors.primary_contributor = "weak_match";
      }
    }

    const category = input.confidence < LOW_CONFIDENCE_THRESHOLD
      ? "low_confidence"
      : "edge_case";

    return {
      text: reasons.join(" "),
      category,
      contributingFactors: factors,
    };
  }

  private detectConfusion(input: PredictionExplanationInput): { label: string; reason: string } | null {
    const topTwo = input.topK.slice(0, 2);
    if (topTwo.length < 2) return null;

    const [first, second] = topTwo;
    const similarGroup = SIMILAR_LABEL_GROUPS[first.label];
    if (similarGroup?.includes(second.label)) {
      return {
        label: second.label,
        reason: `Similar to gesture "${second.label}" (${(second.confidence * 100).toFixed(0)}%), but motion pattern favored "${first.label}".`,
      };
    }

    if (second.confidence > first.confidence * 0.6) {
      return {
        label: second.label,
        reason: `Close call with "${second.label}" (${(second.confidence * 100).toFixed(0)}% vs ${(first.confidence * 100).toFixed(0)}%). Slight motion differences determined the result.`,
      };
    }

    return null;
  }

  generateReport(input: PredictionExplanationInput): ExplanationReport {
    const result = this.explain(input);

    const competitorAnalysis = input.topK.slice(0, 5).map((item) => ({
      label: item.label,
      confidence: item.confidence,
      gap: input.confidence - item.confidence,
    }));

    const motionQuality = this.assessMotionQuality(input);

    const landmarkCompleteness = input.bufferLength > 30 ? 1
      : input.bufferLength > 20 ? 0.8
      : input.bufferLength > 10 ? 0.5
      : 0.3;

    const recognitionTimeline: Array<{ time: number; label: string; confidence: number }> = [
      { time: 0, label: input.label, confidence: input.confidence },
    ];
    if (input.smoothedLabel && input.smoothedLabel !== input.label) {
      recognitionTimeline.push({ time: 1, label: input.smoothedLabel, confidence: input.confidence * 0.9 });
    }

    return {
      input,
      result,
      competitorAnalysis,
      motionQuality,
      landmarkCompleteness,
      recognitionTimeline,
      timestamp: new Date().toISOString(),
    };
  }

  private assessMotionQuality(input: PredictionExplanationInput): { score: number; description: string } {
    if (input.motionScore > 0.05) return { score: 0.9, description: "Good motion quality — clear gesture movement detected" };
    if (input.motionScore > 0.02) return { score: 0.6, description: "Moderate motion — some movement detected" };
    if (input.motionScore > 0.01) return { score: 0.4, description: "Low motion — minimal hand movement detected" };
    return { score: 0.2, description: "Very low motion — gesture may be still or incomplete" };
  }

  exportReportJson(input: PredictionExplanationInput): string {
    return JSON.stringify(this.generateReport(input), null, 2);
  }
}
