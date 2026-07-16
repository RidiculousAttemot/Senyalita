"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, Database, ArrowUpRight, Download, Plus } from "lucide-react";

interface ReviewItem {
  id: string;
  gesture_label: string;
  confidence: number;
  status: string;
  original_prediction: string;
}

export function HardCaseDatasetView() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-learning?section=review-queue");
      const data = await res.json();
      const pending = (data.items ?? []).filter((i: ReviewItem) => i.status === "pending" || i.status === "approved");
      setItems(pending);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const buildDataset = async () => {
    setConverting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/active-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert-to-sample", reviewItemIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Added ${data.count} samples to training dataset`);
        setSelected(new Set());
        fetchItems();
      } else {
        setMessage(data.error ?? "Failed to build dataset");
      }
    } catch {
      setMessage("Error building dataset");
    } finally {
      setConverting(false);
    }
  };

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>Hard Case Dataset Builder</h1>
          <p className="admin-dashboard-subtitle">Select review items and convert them into training samples to improve the model.</p>
        </div>
      </header>

      <div className="admin-panel" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Available Hard Cases</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={buildDataset}
              disabled={selected.size === 0 || converting}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                background: selected.size > 0 ? "#2563eb" : "#1e293b",
                border: selected.size > 0 ? "none" : "1px solid #334155",
                borderRadius: 6, color: selected.size > 0 ? "#fff" : "#64748b",
                fontSize: 13, fontWeight: 600, cursor: selected.size > 0 ? "pointer" : "not-allowed",
              }}
            >
              {converting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Database size={14} />}
              {converting ? "Building..." : `Build Dataset (${selected.size})`}
            </button>
          </div>
        </div>

        {message && (
          <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 6, background: message.includes("Added") ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)", color: message.includes("Added") ? "#86efac" : "#fca5a5", fontSize: 13 }}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, color: "#64748b", justifyContent: "center" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Loading...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <CheckCircle2 size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p>No hard cases available. Review items first from the AI Review Queue.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase", width: 32 }}>
                    <input type="checkbox" onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(items.map((i) => i.id)));
                      else setSelected(new Set());
                    }} checked={selected.size === items.length && items.length > 0} />
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Gloss</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Original</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Confidence</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #0f172a" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600, color: "#e2e8f0" }}>{item.gesture_label}</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontFamily: "monospace" }}>{item.original_prediction}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: item.confidence >= 0.8 ? "#4ade80" : item.confidence >= 0.6 ? "#fde68a" : "#f87171", fontWeight: 600 }}>
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        background: item.status === "approved" ? "rgba(22,163,74,0.1)" : "rgba(234,179,8,0.1)",
                        color: item.status === "approved" ? "#86efac" : "#fde68a",
                      }}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <p className="admin-metric-label">Available Items</p>
          <strong className="admin-metric-value">{items.length}</strong>
          <p className="admin-metric-note">Pending or approved review items</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Selected</p>
          <strong className="admin-metric-value" style={{ color: "#60a5fa" }}>{selected.size}</strong>
          <p className="admin-metric-note">Ready to convert</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Average Confidence</p>
          <strong className="admin-metric-value">
            {items.length > 0 ? `${(items.reduce((s, i) => s + i.confidence, 0) / items.length * 100).toFixed(0)}%` : "—"}
          </strong>
          <p className="admin-metric-note">Across all available items</p>
        </article>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
