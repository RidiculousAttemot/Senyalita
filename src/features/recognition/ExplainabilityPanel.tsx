"use client";

import { useMemo } from "react";
import { PredictionExplainer, type ExplanationResult } from "./explainer";

type ExplainabilityPanelProps = {
  show: boolean;
  topPredictions: Array<{ label: string; confidence: number }>;
  smoothedLabel: string | null;
  gesturePhase: string;
  motionScore: number;
  bufferLength: number;
  inferenceTimeMs: number;
  confidence: number;
  priorityOverride: string | null;
};

const COLORS = {
  high_confidence: "#22c55e",
  low_confidence: "#ef4444",
  confusion: "#eab308",
  motion: "#3b82f6",
  edge_case: "#a855f7",
};

export const ExplainabilityPanel = ({
  show,
  topPredictions,
  smoothedLabel,
  gesturePhase,
  motionScore,
  bufferLength,
  inferenceTimeMs,
  confidence,
  priorityOverride,
}: ExplainabilityPanelProps) => {
  const explanation = useMemo<ExplanationResult | null>(() => {
    if (!show || !smoothedLabel) return null;
    const explainer = new PredictionExplainer();
    return explainer.explain({
      label: smoothedLabel,
      confidence,
      topK: topPredictions,
      gesturePhase: gesturePhase as any,
      motionScore,
      bufferLength,
      inferenceTimeMs,
      smoothedLabel,
    });
  }, [show, smoothedLabel, confidence, topPredictions, gesturePhase, motionScore, bufferLength, inferenceTimeMs]);

  if (!show) return null;

  const categoryColor = explanation ? COLORS[explanation.category] ?? "#0f0" : "#0f0";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        background: "rgba(0, 0, 0, 0.88)",
        color: "#e0e0e0",
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 11,
        fontFamily: "monospace",
        lineHeight: 1.6,
        maxWidth: 360,
        zIndex: 100,
        pointerEvents: "none",
        border: `1px solid ${categoryColor}33`,
      }}
    >
      <div style={{ color: categoryColor, fontWeight: "bold", marginBottom: 4 }}>
        {explanation?.category === "high_confidence" ? "HIGH CONFIDENCE" :
         explanation?.category === "low_confidence" ? "LOW CONFIDENCE" :
         explanation?.category === "confusion" ? "CONFUSION DETECTED" :
         explanation?.category === "motion" ? "MOTION ANALYSIS" :
         "PREDICTION ANALYSIS"}
      </div>
      <div style={{ color: "#ccc", fontSize: 10, marginBottom: 6 }}>
        {explanation?.text ?? "Analyzing prediction..."}
      </div>
      <div style={{ borderTop: "1px solid #333", paddingTop: 4, marginTop: 4 }}>
        <div>Top predictions:</div>
        {topPredictions.map((p, i) => (
          <div key={p.label} style={{ color: i === 0 ? categoryColor : "#888" }}>
            {i + 1}. {p.label} = {(p.confidence * 100).toFixed(1)}%
          </div>
        ))}
        <div style={{ marginTop: 4, color: "#666", fontSize: 10 }}>
          <div>Phase: {gesturePhase} | Motion: {motionScore.toFixed(3)}</div>
          <div>Buffer: {bufferLength}/30 | Inf: {inferenceTimeMs.toFixed(0)}ms</div>
          <div>Confidence: {(confidence * 100).toFixed(1)}%</div>
          {priorityOverride && <div>Override: {priorityOverride}</div>}
        </div>
      </div>
    </div>
  );
};

export const AdminExplanationPanel = ({
  topPredictions,
  smoothedLabel,
  gesturePhase,
  motionScore,
  confidence,
  bufferLength,
}: {
  topPredictions: Array<{ label: string; confidence: number }>;
  smoothedLabel: string | null;
  gesturePhase: string;
  motionScore: number;
  confidence: number;
  bufferLength: number;
}) => {
  const explanation = useMemo(() => {
    if (!smoothedLabel) return null;
    const explainer = new PredictionExplainer();
    return explainer.explain({
      label: smoothedLabel,
      confidence,
      topK: topPredictions,
      gesturePhase: gesturePhase as any,
      motionScore,
      bufferLength,
      inferenceTimeMs: 0,
      smoothedLabel,
    });
  }, [smoothedLabel, confidence, topPredictions, gesturePhase, motionScore, bufferLength]);

  if (!explanation) {
    return <p className="panel-note">No prediction data available for explanation.</p>;
  }

  const color = COLORS[explanation.category] ?? "#888";
  const factors = explanation.contributingFactors;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h4 style={{ color, marginBottom: 8 }}>
        Explanation Category: {explanation.category.replace("_", " ").toUpperCase()}
      </h4>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{explanation.text}</p>
      <div className="admin-cards" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="analytics-card">
          <span className="analytics-label">Confidence</span>
          <span className="analytics-value">{(confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Primary Factor</span>
          <span className="analytics-value">{(factors.primary_contributor as string) ?? "unknown"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Gesture Phase</span>
          <span className="analytics-value">{gesturePhase}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Motion Score</span>
          <span className="analytics-value">{motionScore.toFixed(4)}</span>
        </div>
      </div>
      {topPredictions.length > 0 && (
        <div className="admin-table-wrap" style={{ marginTop: 12 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Label</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {topPredictions.map((p, i) => (
                <tr key={p.label}>
                  <td>{i + 1}</td>
                  <td><code>{p.label}</code></td>
                  <td>{(p.confidence * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
