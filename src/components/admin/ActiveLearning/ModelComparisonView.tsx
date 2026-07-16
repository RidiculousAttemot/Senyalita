"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ArrowLeftRight, CheckCircle2, XCircle, TrendingUp, TrendingDown } from "lucide-react";

interface Model {
  id: string;
  version: string;
  accuracy: number | null;
  dataset_size: number | null;
  num_classes: number;
  architecture: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface Deployment {
  id: string;
  model_version_id: string;
  environment: string;
  status: string;
  deployed_at: string | null;
}

export function ModelComparisonView() {
  const [models, setModels] = useState<Model[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [candidateId, setCandidateId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/active-learning?section=models");
        const data = await res.json();
        const m = data.models ?? [];
        setModels(m);
        const active = m.find((x: Model) => x.is_active);
        const latest = m.length > 0 ? m[0] : null;
        if (active) setCurrentId(active.id);
        if (latest && latest.id !== active?.id) setCandidateId(latest.id);
        else if (m.length > 1) setCandidateId(m[1].id);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const current = models.find((m) => m.id === currentId);
  const candidate = models.find((m) => m.id === candidateId);

  const deployCandidate = async () => {
    if (!candidate) return;
    try {
      await fetch("/api/admin/active-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-notification",
          type: "deployment_success",
          title: `Model v${candidate.version} deployed`,
          message: `Candidate model deployed to production`,
          severity: "success",
          link: "/admin/model-comparison",
        }),
      });
      alert(`Model v${candidate.version} would be deployed to production.`);
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <section className="admin-dashboard">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: "#64748b" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> Loading models...
        </div>
      </section>
    );
  }

  if (models.length < 2) {
    return (
      <section className="admin-dashboard">
        <header className="admin-dashboard-header">
          <div>
            <p className="admin-overline">Active Learning</p>
            <h1>Model Comparison</h1>
            <p className="admin-dashboard-subtitle">Compare current production model against candidates.</p>
          </div>
        </header>
        <div className="admin-panel" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#64748b" }}>Need at least 2 model versions to compare. Train a candidate first.</p>
        </div>
      </section>
    );
  }

  const metricRow = (label: string, currentVal: string | number, candidateVal: string | number, fmt?: (v: number) => string) => {
    const c = typeof currentVal === "string" ? parseFloat(currentVal) : currentVal;
    const d = typeof candidateVal === "string" ? parseFloat(candidateVal) : candidateVal;
    const diff = d - c;
    const better = diff > 0;
    return (
      <tr style={{ borderBottom: "1px solid #0f172a" }}>
        <td style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 500 }}>{label}</td>
        <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "monospace", color: "#e2e8f0" }}>
          {typeof currentVal === "number" ? (fmt ? fmt(currentVal) : currentVal.toLocaleString()) : currentVal}
        </td>
        <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "monospace", color: "#e2e8f0" }}>
          {typeof candidateVal === "number" ? (fmt ? fmt(candidateVal) : candidateVal.toLocaleString()) : candidateVal}
        </td>
        <td style={{ padding: "12px 16px", textAlign: "center" }}>
          {diff !== 0 && (
            <span style={{ color: better ? "#4ade80" : "#f87171", fontWeight: 600, fontSize: 13 }}>
              {better ? "+" : ""}{typeof currentVal === "number" ? (fmt ? fmt(diff) : diff.toFixed(2)) : "—"}
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>Model Comparison</h1>
          <p className="admin-dashboard-subtitle">Side-by-side comparison of current production vs. candidate model.</p>
        </div>
      </header>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Current Production</label>
          <select value={currentId} onChange={(e) => setCurrentId(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontSize: 13, outline: "none" }}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>v{m.version} {m.is_active ? "(Active)" : ""} — {m.architecture}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Candidate</label>
          <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontSize: 13, outline: "none" }}>
            {models.filter((m) => m.id !== currentId).map((m) => (
              <option key={m.id} value={m.id}>v{m.version} — {m.architecture}</option>
            ))}
          </select>
        </div>
      </div>

      {current && candidate && (
        <div className="admin-panel" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1e293b" }}>
                <th style={{ padding: "16px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>Metric</th>
                <th style={{ padding: "16px", textAlign: "center", color: "#60a5fa", fontWeight: 600, fontSize: 12, textTransform: "uppercase" }}>Current (v{current.version})</th>
                <th style={{ padding: "16px", textAlign: "center", color: "#f59e0b", fontWeight: 600, fontSize: 12, textTransform: "uppercase" }}>Candidate (v{candidate.version})</th>
                <th style={{ padding: "16px", textAlign: "center", color: "#64748b", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              {metricRow("Accuracy", current.accuracy ?? 0, candidate.accuracy ?? 0, (v) => `${(v * 100).toFixed(1)}%`)}
              {metricRow("Dataset Size", current.dataset_size ?? 0, candidate.dataset_size ?? 0)}
              {metricRow("Classes", current.num_classes, candidate.num_classes)}
              {metricRow("Training Date", new Date(current.created_at).toLocaleDateString(), new Date(candidate.created_at).toLocaleDateString())}
            </tbody>
          </table>

          <div style={{ padding: 20, borderTop: "1px solid #1e293b" }}>
            <h3 style={{ fontSize: 14, color: "#e2e8f0", margin: "0 0 12px" }}>Recommendation</h3>
            {candidate.accuracy && current.accuracy && candidate.accuracy > current.accuracy ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 8, color: "#86efac", fontSize: 13 }}>
                <TrendingUp size={18} />
                <span>Candidate model v{candidate.version} shows improvement. <strong>Recommended for deployment.</strong></span>
                <button onClick={deployCandidate} style={{ marginLeft: "auto", padding: "6px 14px", background: "#2563eb", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Deploy to Production
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, color: "#fde68a", fontSize: 13 }}>
                <TrendingDown size={18} />
                <span>Candidate model does not outperform current production. <strong>Keep current deployment.</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
