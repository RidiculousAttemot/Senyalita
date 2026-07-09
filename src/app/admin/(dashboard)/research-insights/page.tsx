"use client";

import React, { useState, useMemo, useCallback } from "react";
import { globalDatasetExpansion, globalDriftDetector, globalErrorAnalysis } from "@/features/analytics";

type InsightTab = "dataset" | "confidence" | "gestures" | "translation" | "export";

export default function ResearchInsightsPage() {
  const [activeTab, setActiveTab] = useState<InsightTab>("dataset");
  const [daysBack, setDaysBack] = useState(30);

  const recommendations = useMemo(() => globalDatasetExpansion.getRecommendations(), []);
  const driftAlerts = useMemo(() => globalDriftDetector.getAlerts(), []);
  const confusionPairs = useMemo(() => globalErrorAnalysis.findConfusionPairs(2), []);
  const unstableGestures = useMemo(() => globalErrorAnalysis.findUnstableGestures(), []);

  const handleExport = useCallback((format: "csv" | "json") => {
    const data = {
      recommendations,
      driftAlerts,
      confusionPairs,
      unstableGestures,
      exportedAt: new Date().toISOString(),
    };
    const content = format === "json" ? JSON.stringify(data, null, 2) : convertToCsv(data);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-insights-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recommendations, driftAlerts, confusionPairs, unstableGestures]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Research Insights</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleExport("csv")} className="button button-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
            Export CSV
          </button>
          <button onClick={() => handleExport("json")} className="button button-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
            Export JSON
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
        Interactive research analytics — dataset growth, confidence trends, gesture popularity, and more
      </p>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Dataset Recommendations</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", margin: "4px 0 0" }}>{recommendations.length}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Confusion Pairs</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#f97316", margin: "4px 0 0" }}>{confusionPairs.length}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Unstable Gestures</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", margin: "4px 0 0" }}>{unstableGestures.length}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Drift Events</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: driftAlerts.filter((a) => a.severity === "critical").length > 0 ? "#ef4444" : "#22c55e", margin: "4px 0 0" }}>{driftAlerts.length}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Time Range</span>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(parseInt(e.target.value))}
            className="input"
            style={{ padding: "4px 6px", fontSize: 12, marginTop: 4, width: "100%" }}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {(["dataset", "confidence", "gestures", "translation", "export"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="button"
            style={{
              padding: "6px 14px", fontSize: 12, textTransform: "capitalize",
              background: activeTab === tab ? "#3b82f6" : "#1e293b",
              color: activeTab === tab ? "#fff" : "#94a3b8",
              border: "none", borderRadius: 6, cursor: "pointer",
            }}
          >
            {tab === "dataset" ? "Dataset Growth" : tab === "confidence" ? "Confidence Trends" : tab === "gestures" ? "Gesture Popularity" : tab === "translation" ? "Translation Trends" : "Export"}
          </button>
        ))}
      </div>

      {activeTab === "dataset" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#60a5fa", marginBottom: 8 }}>Sample Needs by Gesture</h3>
              {recommendations.length === 0 ? (
                <p style={{ fontSize: 12, color: "#64748b" }}>No recommendations. Provide gesture metrics to populate.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
                  {recommendations.map((rec, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                      <span style={{ color: "#e2e8f0" }}>{rec.gesture}</span>
                      <span style={{ color: "#f97316" }}>+{rec.recommendedSamples} (p{rec.priority.toFixed(2)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#60a5fa", marginBottom: 8 }}>Signer Diversity</h3>
              <p style={{ fontSize: 12, color: "#64748b" }}>
                Signer diversity tracking helps ensure the dataset represents a broad range of signing styles.
                Add gesture samples with signer metadata to populate this view.
              </p>
              <div style={{ marginTop: 12, padding: 12, borderRadius: 6, background: "#1e293b" }}>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>Diversity Factors Tracked</p>
                <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#1e1b4b", color: "#c4b5fd" }}>Signer ID</span>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#422006", color: "#fde68a" }}>Region</span>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "#1e293b", color: "#94a3b8" }}>Camera</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "confidence" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Confusion Pair Analysis</h3>
              {confusionPairs.length === 0 ? (
                <p style={{ fontSize: 12, color: "#64748b" }}>No confusion pairs recorded yet. Corrections will populate this data.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 350, overflowY: "auto" }}>
                  {confusionPairs.map((pair, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                      <span style={{ color: "#e2e8f0" }}>{pair.predicted} ⇄ {pair.expected}</span>
                      <span style={{ color: "#94a3b8" }}>{pair.count}x ({(pair.avgConfidence * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Unstable Gestures</h3>
              {unstableGestures.length === 0 ? (
                <p style={{ fontSize: 12, color: "#64748b" }}>No unstable gestures detected.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 350, overflowY: "auto" }}>
                  {unstableGestures.slice(0, 15).map((g, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                      <span style={{ color: "#e2e8f0" }}>{g.gesture}</span>
                      <span style={{ color: g.variance > 0.1 ? "#ef4444" : "#94a3b8" }}>
                        σ²={(g.variance * 100).toFixed(1)}% · {(g.correctionRate * 100).toFixed(0)}% corrected
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "gestures" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", marginBottom: 8 }}>Gesture Popularity & Phrase Frequency</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Track which gestures are most frequently recognized, corrected, and which phrases are most commonly translated.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Most Recognized</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Data from translation_logs and telemetry_events will populate this chart.
              </p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Most Corrected</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Gestures with the highest correction rates appear in the unstable gestures list above.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "translation" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#22c55e", marginBottom: 8 }}>Translation Trends</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Monitors translation quality, animation usage, and TTS usage patterns.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Animation Usage</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Tracks which animation assets are most frequently played</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>TTS Usage</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Speech synthesis invocation frequency</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Phrase Frequency</p>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Most commonly translated phrases and sentences</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "export" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>Export Research Data</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Export current analytics data for external analysis in spreadsheet or JSON format.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleExport("csv")} className="button button-primary" style={{ padding: "8px 20px" }}>
              Download CSV
            </button>
            <button onClick={() => handleExport("json")} className="button button-secondary" style={{ padding: "8px 20px" }}>
              Download JSON
            </button>
          </div>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 6, background: "#1e293b" }}>
            <p style={{ fontSize: 11, color: "#64748b" }}>Export includes</p>
            <ul style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, paddingLeft: 16 }}>
              <li>Dataset recommendations with priority scores</li>
              <li>Confusion pairs with counts and avg confidence</li>
              <li>Unstable gestures with variance and correction rates</li>
              <li>Drift alerts with severity and deviation</li>
              <li>Export timestamp</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function convertToCsv(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`\n[${key}]`);
      if (value.length > 0 && typeof value[0] === "object") {
        const headers = Object.keys(value[0]);
        lines.push(headers.join(","));
        for (const item of value) {
          lines.push(headers.map((h) => String((item as Record<string, unknown>)[h] ?? "")).join(","));
        }
      }
    } else {
      lines.push(`${key},${String(value)}`);
    }
  }
  return lines.join("\n");
}
