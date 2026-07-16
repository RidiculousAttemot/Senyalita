"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface ConfusionPair {
  gesture_label: string;
  confused_with: string;
  count: number;
}

interface DailyMetric {
  day: string;
  total_predictions: number;
  low_confidence_count: number;
  avg_confidence: number | null;
}

export function ErrorAnalyticsView() {
  const [confusions, setConfusions] = useState<ConfusionPair[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [lowConfidenceCount, setLowConfidenceCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-learning?section=error-analytics");
      const data = await res.json();
      setConfusions(data.confusions ?? []);
      setDailyMetrics(data.dailyMetrics ?? []);
      setLowConfidenceCount(data.lowConfidenceCount ?? 0);
      setFailureCount(data.failureCount ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <section className="admin-dashboard">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: "#64748b" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> Loading analytics...
        </div>
      </section>
    );
  }

  const maxConfusion = Math.max(...confusions.map((c) => c.count), 1);

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>Recognition Error Analytics</h1>
          <p className="admin-dashboard-subtitle">Most confused glosses, confidence trends, and error patterns.</p>
        </div>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <p className="admin-metric-label">Low Confidence</p>
          <strong className="admin-metric-value" style={{ color: "#fde68a" }}>{lowConfidenceCount}</strong>
          <p className="admin-metric-note">Last 30 days</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Failures</p>
          <strong className="admin-metric-value" style={{ color: "#f87171" }}>{failureCount}</strong>
          <p className="admin-metric-note">Recognition + Translation</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Confusion Pairs</p>
          <strong className="admin-metric-value">{confusions.length}</strong>
          <p className="admin-metric-note">Tracked confusions</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Days of Data</p>
          <strong className="admin-metric-value">{dailyMetrics.length}</strong>
          <p className="admin-metric-note">Daily snapshots</p>
        </article>
      </div>

      <div className="admin-panel" style={{ marginBottom: 24, padding: 20 }}>
        <div className="admin-panel-heading">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Most Confused Glosses</h2>
        </div>
        {confusions.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>No confusion data recorded yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {confusions.slice(0, 15).map((pair, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "#94a3b8" }}>
                    <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{pair.gesture_label}</span>
                    {" "}→{" "}
                    <span style={{ fontFamily: "monospace", color: "#f87171" }}>{pair.confused_with}</span>
                  </span>
                  <span style={{ color: "#64748b" }}>{pair.count}x</span>
                </div>
                <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(pair.count / maxConfusion) * 100}%`, background: "#f87171", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-panel" style={{ marginBottom: 24, padding: 20 }}>
        <div className="admin-panel-heading">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Confidence Trend</h2>
        </div>
        {dailyMetrics.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>No daily metrics available</p>
        ) : (
          <div style={{ marginTop: 12 }}>
            {dailyMetrics.slice(0, 14).reverse().map((d) => (
              <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "#64748b", width: 60, flexShrink: 0 }}>{new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(d.avg_confidence ?? 0) * 100}%`, background: (d.avg_confidence ?? 0) >= 0.8 ? "#4ade80" : (d.avg_confidence ?? 0) >= 0.6 ? "#fde68a" : "#f87171", borderRadius: 3 }} />
                </div>
                <span style={{ color: "#94a3b8", width: 40, textAlign: "right" }}>{((d.avg_confidence ?? 0) * 100).toFixed(0)}%</span>
                <span style={{ color: "#64748b", width: 30, textAlign: "right" }}>{d.total_predictions}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-panel" style={{ padding: 20 }}>
        <div className="admin-panel-heading">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Recommendations</h2>
        </div>
        <ul style={{ margin: "12px 0 0", padding: "0 0 0 16px", color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>
          {confusions.length > 5 && <li><strong style={{ color: "#fde68a" }}>{confusions.length} confusion pairs</strong> — consider reviewing these glosses in the training dataset</li>}
          {lowConfidenceCount > 10 && <li><strong style={{ color: "#fde68a" }}>{lowConfidenceCount} low-confidence predictions</strong> — review in the AI Review Queue</li>}
          {failureCount > 0 && <li><strong style={{ color: "#f87171" }}>{failureCount} failures</strong> — investigate and address root causes</li>}
          {dailyMetrics.length >= 7 && (() => {
            const recent = dailyMetrics.slice(0, 7).filter((d) => d.avg_confidence !== null).map((d) => d.avg_confidence!);
            const trend = recent.length >= 2 && recent[0] > recent[recent.length - 1] ? "declining" : "stable";
            return <li>Confidence trend is <strong style={{ color: trend === "declining" ? "#f87171" : "#4ade80" }}>{trend}</strong></li>;
          })()}
          {confusions.length <= 5 && lowConfidenceCount <= 10 && <li>No significant issues detected — model performance is healthy</li>}
        </ul>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
