"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  globalErrorAnalysis,
  globalDatasetExpansion,
  globalQualityInspector,
  globalClusteringEngine,
  globalDriftDetector,
} from "@/features/analytics";
import type { GestureSampleNeed, GestureMetrics } from "@/features/analytics";

export default function ActiveLearningPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "recommendations" | "quality" | "clusters" | "drift">("overview");
  const [threshold, setThreshold] = useState(60);
  const [mockSamples, setMockSamples] = useState(0);

  const recommendations = useMemo(() => globalDatasetExpansion.getRecommendations(), []);

  const expansionMetrics = useMemo(() => globalDatasetExpansion.getAllMetrics(), []);

  const driftAlerts = useMemo(() => globalDriftDetector.getAlerts(), []);

  const totalLowConf = globalErrorAnalysis.findConfusionPairs().length;
  const totalUnstable = globalErrorAnalysis.findUnstableGestures().length;

  const qualityScore = {
    total: 0,
    passed: 0,
    failed: 0,
    avgScore: 0,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Active Learning Dashboard</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
        Automatically identifies which gestures need more data, monitors quality, and tracks drift
      </p>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b", minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Low Confidence</span>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#f97316", margin: "4px 0 0" }}>{totalLowConf}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b", minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Unstable Gestures</span>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#ef4444", margin: "4px 0 0" }}>{totalUnstable}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b", minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Needs Samples</span>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#60a5fa", margin: "4px 0 0" }}>{recommendations.length}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b", minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Drift Alerts</span>
          <p style={{ fontSize: 22, fontWeight: 700, color: driftAlerts.filter((a) => a.severity === "critical").length > 0 ? "#ef4444" : "#22c55e", margin: "4px 0 0" }}>{driftAlerts.length}</p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b", minWidth: 140 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Clusters Found</span>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#a78bfa", margin: "4px 0 0" }}>{globalClusteringEngine.getSamples().length > 0 ? "Active" : "No data"}</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {(["overview", "recommendations", "quality", "clusters", "drift"] as const).map((tab) => (
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
            {tab === "overview" ? "Overview" : tab === "recommendations" ? "Dataset Recommendations" : tab === "quality" ? "Quality Inspector" : tab === "clusters" ? "Gesture Clusters" : "Drift Detection"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Top Confusion Pairs</h3>
              {globalErrorAnalysis.findConfusionPairs(2).length === 0 ? (
                <p style={{ fontSize: 12, color: "#64748b" }}>No confusion data yet. Predictions with corrections will appear here.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {globalErrorAnalysis.findConfusionPairs(2).slice(0, 10).map((pair, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                      <span style={{ color: "#e2e8f0" }}>{pair.predicted} → {pair.expected}</span>
                      <span style={{ color: "#94a3b8" }}>{pair.count}x @ {(pair.avgConfidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Recommended Recordings</h3>
              {recommendations.length === 0 ? (
                <p style={{ fontSize: 12, color: "#64748b" }}>No recommendations yet. Add gesture metrics to generate recommendations.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {recommendations.slice(0, 10).map((rec, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                      <span style={{ color: "#e2e8f0" }}>{rec.gesture}</span>
                      <span style={{ color: rec.priority > 0.5 ? "#f97316" : "#94a3b8" }}>
                        +{rec.recommendedSamples} samples (p{rec.priority.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Quality Pipeline</h3>
              <p style={{ fontSize: 12, color: "#64748b" }}>
                Quality threshold: <strong style={{ color: "#e2e8f0" }}>{threshold}/100</strong>
              </p>
              <div style={{ marginTop: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                {qualityScore.total} samples evaluated · {qualityScore.passed} passed · {qualityScore.failed} rejected
              </p>
            </div>

            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>Drift Summary</h3>
              {driftAlerts.length === 0 ? (
                <p style={{ fontSize: 12, color: "#64748b" }}>No drift detected. System performance is stable.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {driftAlerts.slice(0, 5).map((alert, i) => (
                    <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
                      <span style={{ color: alert.severity === "critical" ? "#ef4444" : alert.severity === "warning" ? "#f97316" : "#94a3b8" }}>
                        [{alert.severity.toUpperCase()}]
                      </span>
                      <span style={{ color: "#e2e8f0", marginLeft: 4 }}>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "recommendations" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#60a5fa", marginBottom: 8 }}>
            Dataset Expansion Recommendations
          </h3>
          {recommendations.length === 0 ? (
            <p style={{ fontSize: 12, color: "#64748b" }}>No recommendations. Provide gesture metrics via <code>globalDatasetExpansion.updateGesture()</code>.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 11, color: "#64748b", padding: "4px 8px", gap: 16 }}>
                <span style={{ width: 140 }}>Gesture</span>
                <span style={{ width: 100 }}>Samples Needed</span>
                <span style={{ width: 80 }}>Priority</span>
                <span style={{ flex: 1 }}>Reasons</span>
              </div>
              {recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", fontSize: 12, padding: "8px", background: "#1e293b", borderRadius: 6, gap: 16, alignItems: "center" }}>
                  <span style={{ width: 140, fontWeight: 600, color: "#e2e8f0" }}>{rec.gesture}</span>
                  <span style={{ width: 100, color: "#f97316" }}>+{rec.recommendedSamples}</span>
                  <span style={{ width: 80, color: rec.priority > 0.5 ? "#ef4444" : "#94a3b8" }}>{(rec.priority * 100).toFixed(0)}%</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    {rec.reasons.map((reason, j) => (
                      <span key={j} style={{ fontSize: 11, color: "#94a3b8" }}>
                        • {reason.description}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "quality" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#22c55e", marginBottom: 8 }}>Dataset Quality Inspector</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Score samples automatically from 0-100. Samples below the threshold are rejected.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Threshold:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              style={{ width: 200 }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: threshold >= 60 ? "#22c55e" : "#f97316" }}>{threshold}/100</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Blur Detection</p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>Analyzes landmark variance per frame</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Hand Presence</p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>Checks {">"}15 landmarks in {">"}70% of frames</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Lighting</p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>Rejects very dark ({"<"}20%) or overexposed frames</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Framing</p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>Ensures hands are centered in frame</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Motion Blur</p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>Flags excessive per-frame motion</p>
            </div>
            <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Duplicate Detection</p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>Flags recordings with {">"}50% duplicate frames</p>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 6, background: "#1e293b" }}>
            <p style={{ fontSize: 11, color: "#64748b" }}>Usage</p>
            <pre style={{ fontSize: 11, color: "#60a5fa", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {`const inspector = new DatasetQualityInspector();
const score = inspector.inspect(sample);
if (score.passed) { /* approve */ } else { /* reject */ }`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === "clusters" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", marginBottom: 8 }}>Gesture Clustering Engine</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Automatically clusters similar gesture recordings to identify natural, signer, regional, and camera variations.
          </p>
          <div style={{ padding: 12, borderRadius: 6, background: "#1e293b", marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>How it works</p>
            <p style={{ fontSize: 12, color: "#e2e8f0", marginTop: 4 }}>
              Samples are converted to feature vectors (normalized landmark positions), then clustered using K-Means++ initialization.
              Each cluster is classified by its variation type based on signer/region/camera metadata.
            </p>
          </div>
          <div style={{ padding: 12, borderRadius: 6, background: "#1e293b" }}>
            <p style={{ fontSize: 11, color: "#64748b" }}>Variation Types</p>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#14532d", color: "#bbf7d0" }}>Natural</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#1e1b4b", color: "#c4b5fd" }}>Signer</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#422006", color: "#fde68a" }}>Regional</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#451a1a", color: "#fca5a5" }}>Camera</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "drift" && (
        <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", marginBottom: 8 }}>Drift Detection</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Monitors accuracy, confidence, gesture distribution, lighting, and camera angle drift over time.
          </p>
          {driftAlerts.length === 0 ? (
            <div style={{ padding: 16, borderRadius: 6, background: "#14532d", color: "#bbf7d0", fontSize: 13 }}>
              No drift detected. All metrics are stable.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {driftAlerts.map((alert, i) => (
                <div key={i} style={{
                  padding: "10px 14px", borderRadius: 6, fontSize: 12,
                  background: alert.severity === "critical" ? "#451a1a"
                    : alert.severity === "warning" ? "#422006" : "#1e293b",
                  color: alert.severity === "critical" ? "#fca5a5"
                    : alert.severity === "warning" ? "#fde68a" : "#94a3b8",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>[{alert.severity.toUpperCase()}] {alert.metric}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  <p style={{ marginTop: 4 }}>{alert.message}</p>
                  <p style={{ fontSize: 11, marginTop: 2, color: "#64748b" }}>
                    Deviation: {(alert.deviationPercent * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
