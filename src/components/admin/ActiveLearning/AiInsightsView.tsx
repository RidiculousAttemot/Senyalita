"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BarChart3, BookOpen, BrainCircuit } from "lucide-react";
import { shouldSuggestRetraining, generateRetrainingSuggestion } from "@/features/active-learning/retrainingSuggester";
import { WORD_TO_GLOSS } from "@/features/gesture-mapping/glossDictionary";

export function AiInsightsView() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [retrainingSuggestion, setRetrainingSuggestion] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-learning");
      const data = await res.json();
      setOverview(data);

      const job = data.retraining?.recent?.[0];
      const criteria = {
        newSamplesAvailable: data.samples?.total ?? 0,
        accuracyDecline: job && job.accuracy_before && job.accuracy_after
          ? Math.max(0, job.accuracy_before - job.accuracy_after)
          : 0,
        daysSinceLastTraining: job
          ? Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000)
          : 30,
        lowConfidenceRate: data.telemetry?.totalPredictions > 0
          ? (data.telemetry?.lowConfidence ?? 0) / Math.max(1, data.telemetry?.totalPredictions ?? 100)
          : 0,
        datasetGrowth: data.samples?.total ?? 0,
      };

      if (shouldSuggestRetraining(criteria)) {
        setRetrainingSuggestion(generateRetrainingSuggestion(criteria));
      }
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
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> Loading insights...
        </div>
      </section>
    );
  }

  const pendingReview = overview?.reviewQueue?.pending ?? 0;
  const totalModels = overview?.models?.total ?? 0;
  const failedTranslations = overview?.translations?.failed ?? 0;
  const lowConfidence = overview?.telemetry?.lowConfidence ?? 0;
  const unknownCount = overview?.telemetry?.unknown ?? 0;
  const totalSamples = overview?.samples?.total ?? 0;
  const totalConfusions = overview?.confusions?.length ?? 0;

  const recommendations: string[] = [];
  if (pendingReview > 0) recommendations.push(`Review ${pendingReview} pending items in the AI Review Queue`);
  if (failedTranslations > 0) recommendations.push(`Investigate ${failedTranslations} failed translations`);
  if (totalSamples < 50) recommendations.push(`Build more training samples — only ${totalSamples} available`);
  if (totalConfusions > 5) recommendations.push(`Review ${totalConfusions} confusion pairs for potential dataset issues`);
  if (lowConfidence > 20) recommendations.push(`High volume of low-confidence predictions (${lowConfidence}) — consider retraining`);
  if (Object.keys(WORD_TO_GLOSS).length > 0 && overview?.translations?.total === 0) recommendations.push(`No translation activity recorded yet`);
  if (recommendations.length === 0) recommendations.push("System health is good — no critical issues detected");

  const glossCoveragePercent = overview?.reviewQueue?.total > 0
    ? Math.round((1 - pendingReview / Math.max(1, overview.reviewQueue.total)) * 100)
    : 0;

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>AI Insights Dashboard</h1>
          <p className="admin-dashboard-subtitle">System health, recommendations, and actionable insights.</p>
        </div>
      </header>

      {retrainingSuggestion && (
        <div style={{
          padding: "16px 20px", marginBottom: 24,
          background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(99,102,241,0.1))",
          border: "1px solid rgba(37,99,235,0.3)", borderRadius: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <BrainCircuit size={20} color="#60a5fa" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Model Improvement Opportunity</h3>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
            <strong style={{ color: "#60a5fa" }}>{retrainingSuggestion.availableSamples}</strong> new samples available.
            Estimated accuracy gain: <strong style={{ color: "#4ade80" }}>+{retrainingSuggestion.estimatedAccuracyGain}%</strong>.
            {retrainingSuggestion.reason && ` ${retrainingSuggestion.reason}`}
          </p>
          <button style={{ marginTop: 12, padding: "8px 20px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Retrain Now
          </button>
        </div>
      )}

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <span className="admin-metric-icon"><BrainCircuit size={17} /></span>
          <p className="admin-metric-label">Recognition Health</p>
          <strong className="admin-metric-value" style={{ color: lowConfidence > 20 ? "#fde68a" : "#4ade80" }}>
            {lowConfidence > 20 ? "Needs Attention" : "Good"}
          </strong>
          <p className="admin-metric-note">{lowConfidence} low-confidence predictions</p>
        </article>
        <article className="admin-metric-card">
          <span className="admin-metric-icon"><BookOpen size={17} /></span>
          <p className="admin-metric-label">Animation Coverage</p>
          <strong className="admin-metric-value" style={{ color: glossCoveragePercent > 70 ? "#4ade80" : "#fde68a" }}>
            {glossCoveragePercent}%
          </strong>
          <p className="admin-metric-note">{pendingReview} items pending review</p>
        </article>
        <article className="admin-metric-card">
          <span className="admin-metric-icon"><BarChart3 size={17} /></span>
          <p className="admin-metric-label">Dataset Growth</p>
          <strong className="admin-metric-value">{totalSamples}</strong>
          <p className="admin-metric-note">Total training samples</p>
        </article>
        <article className="admin-metric-card">
          <span className="admin-metric-icon"><TrendingUp size={17} /></span>
          <p className="admin-metric-label">Model Versions</p>
          <strong className="admin-metric-value">{totalModels}</strong>
          <p className="admin-metric-note">{overview?.models?.active ? `Active: v${overview.models.active.version}` : "No active model"}</p>
        </article>
      </div>

      <div className="admin-dashboard-secondary-grid" style={{ marginBottom: 24 }}>
        <article className="admin-panel" style={{ padding: 20 }}>
          <div className="admin-panel-heading">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Active Issues</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#1e293b", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Pending Reviews</span>
              <span style={{ fontWeight: 600, color: pendingReview > 0 ? "#fde68a" : "#4ade80" }}>{pendingReview}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#1e293b", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Hard Cases</span>
              <span style={{ fontWeight: 600, color: lowConfidence > 0 ? "#f87171" : "#4ade80" }}>{lowConfidence}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#1e293b", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Unknown Signs</span>
              <span style={{ fontWeight: 600, color: unknownCount > 0 ? "#f87171" : "#4ade80" }}>{unknownCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#1e293b", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Translation Failures</span>
              <span style={{ fontWeight: 600, color: failedTranslations > 0 ? "#f87171" : "#4ade80" }}>{failedTranslations}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#1e293b", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Model Performance</span>
              <span style={{ fontWeight: 600, color: "#4ade80" }}>{overview?.models?.active ? `${(overview.models.active.accuracy * 100).toFixed(1)}%` : "N/A"}</span>
            </div>
          </div>
        </article>

        <article className="admin-panel" style={{ padding: 20 }}>
          <div className="admin-panel-heading">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>AI Recommendations</h2>
          </div>
          <ul style={{ margin: "12px 0 0", padding: "0 0 0 16px", color: "#94a3b8", fontSize: 13, lineHeight: 2 }}>
            {recommendations.map((r, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Lightbulb size={14} color="#fde68a" style={{ marginTop: 4, flexShrink: 0 }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="admin-panel" style={{ padding: 20 }}>
        <div className="admin-panel-heading">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Quick Actions</h2>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <a href="/admin/ai-review-queue" className="admin-action-button" style={{ textDecoration: "none" }}>
            <AlertTriangle size={16} /> Review Queue {pendingReview > 0 && `(${pendingReview})`}
          </a>
          <a href="/admin/hard-case-dataset" className="admin-action-button" style={{ textDecoration: "none" }}>
            <BarChart3 size={16} /> Build Dataset
          </a>
          <a href="/admin/experiment-tracking" className="admin-action-button" style={{ textDecoration: "none" }}>
            <BrainCircuit size={16} /> Experiments
          </a>
          <a href="/admin/notifications" className="admin-action-button" style={{ textDecoration: "none" }}>
            <Lightbulb size={16} /> Notifications
          </a>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
