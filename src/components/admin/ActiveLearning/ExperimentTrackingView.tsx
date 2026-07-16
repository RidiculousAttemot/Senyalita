"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FlaskConical, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Experiment {
  id: string;
  status: string;
  trigger_reason: string;
  accuracy_before: number | null;
  accuracy_after: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface Model {
  id: string;
  version: string;
  accuracy: number | null;
  architecture: string;
  is_active: boolean;
  created_at: string;
}

export function ExperimentTrackingView() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [retrainRes, modelRes] = await Promise.all([
        fetch("/api/admin/active-learning?section=retraining"),
        fetch("/api/admin/active-learning?section=models"),
      ]);
      const retrainData = await retrainRes.json();
      const modelData = await modelRes.json();
      setExperiments(retrainData.jobs ?? []);
      setModels(modelData.models ?? []);
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
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> Loading experiments...
        </div>
      </section>
    );
  }

  const completed = experiments.filter((e) => e.status === "completed");
  const avgImprovement = completed.length > 0
    ? completed.reduce((s, e) => s + ((e.accuracy_after ?? 0) - (e.accuracy_before ?? 0)), 0) / completed.length
    : 0;

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>Experiment Tracking</h1>
          <p className="admin-dashboard-subtitle">Training runs, model versions, and performance history.</p>
        </div>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <p className="admin-metric-label">Total Runs</p>
          <strong className="admin-metric-value">{experiments.length}</strong>
          <p className="admin-metric-note">All retraining jobs</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Completed</p>
          <strong className="admin-metric-value" style={{ color: "#4ade80" }}>{completed.length}</strong>
          <p className="admin-metric-note">Successfully finished</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Avg Improvement</p>
          <strong className="admin-metric-value" style={{ color: avgImprovement >= 0 ? "#4ade80" : "#f87171" }}>
            {avgImprovement >= 0 ? "+" : ""}{(avgImprovement * 100).toFixed(1)}%
          </strong>
          <p className="admin-metric-note">Accuracy change</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Model Versions</p>
          <strong className="admin-metric-value">{models.length}</strong>
          <p className="admin-metric-note">{models.filter((m) => m.is_active).length} active</p>
        </article>
      </div>

      <div className="admin-panel" style={{ marginBottom: 24, padding: 20 }}>
        <div className="admin-panel-heading">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Training History</h2>
        </div>
        {experiments.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>No training experiments recorded yet</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="admin-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Reason</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Before</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>After</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Delta</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => {
                  const before = exp.accuracy_before ?? 0;
                  const after = exp.accuracy_after ?? 0;
                  const delta = after - before;
                  return (
                    <tr key={exp.id} style={{ borderBottom: "1px solid #0f172a" }}>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{exp.trigger_reason}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 4,
                          background: exp.status === "completed" ? "rgba(22,163,74,0.1)" : exp.status === "failed" ? "rgba(220,38,38,0.1)" : "rgba(234,179,8,0.1)",
                          color: exp.status === "completed" ? "#86efac" : exp.status === "failed" ? "#fca5a5" : "#fde68a",
                        }}>{exp.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{(before * 100).toFixed(1)}%</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{after > 0 ? `${(after * 100).toFixed(1)}%` : "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: delta >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                          {delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 12 }}>{new Date(exp.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel" style={{ padding: 20 }}>
        <div className="admin-panel-heading">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Model Registry</h2>
        </div>
        {models.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, padding: 20, textAlign: "center" }}>No models registered</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {models.map((model) => (
              <div key={model.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#1e293b", borderRadius: 8 }}>
                {model.is_active ? <CheckCircle2 size={16} color="#4ade80" /> : <FlaskConical size={16} color="#64748b" />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#e2e8f0" }}>v{model.version}</span>
                    <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 3, background: "#0f172a", color: "#64748b" }}>{model.architecture}</span>
                    {model.is_active && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 3, background: "rgba(22,163,74,0.15)", color: "#4ade80" }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {model.accuracy !== null ? `${(model.accuracy * 100).toFixed(1)}% accuracy` : "No accuracy data"} · {new Date(model.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
