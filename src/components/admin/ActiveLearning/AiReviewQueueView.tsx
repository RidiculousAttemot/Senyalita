"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Search, BookOpen } from "lucide-react";
import type { ReviewQueueItem } from "@/lib/supabase/types";

interface QueueItemDisplay extends ReviewQueueItem {
  sourceLabel?: string;
  type?: string;
}

export function AiReviewQueueView() {
  const [items, setItems] = useState<QueueItemDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-learning?section=review-queue");
      const data = await res.json();
      const mapped = (data.items ?? []).map((i: ReviewQueueItem) => ({
        ...i,
        type: i.source === "low_confidence" ? "low_confidence" : i.source === "user_correction" ? "user_correction" : "admin_flag",
        sourceLabel: i.source === "low_confidence" ? "Low Confidence" : i.source === "user_correction" ? "User Correction" : "Admin Flag",
      }));
      setItems(mapped);
    } catch {
      setError("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    if (search && !item.gesture_label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const updateItem = async (id: string, status: string, correctedLabel?: string) => {
    try {
      await fetch("/api/admin/active-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-review-item", id, status, correctedLabel }),
      });
      fetchItems();
    } catch {
      setError("Failed to update item");
    }
  };

  const convertSelected = async () => {
    try {
      const res = await fetch("/api/admin/active-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert-to-sample", reviewItemIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(new Set());
        fetchItems();
      }
    } catch {
      setError("Failed to convert items");
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return { bg: "rgba(234,179,8,0.1)", color: "#fde68a" };
      case "approved": return { bg: "rgba(22,163,74,0.1)", color: "#86efac" };
      case "rejected": return { bg: "rgba(220,38,38,0.1)", color: "#fca5a5" };
      case "relabeled": return { bg: "rgba(96,165,250,0.1)", color: "#93c5fd" };
      default: return { bg: "#1e293b", color: "#64748b" };
    }
  };

  const confidenceColor = (c: number) => c >= 0.8 ? "#4ade80" : c >= 0.6 ? "#fde68a" : "#f87171";

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Active Learning</p>
          <h1>AI Review Queue</h1>
          <p className="admin-dashboard-subtitle">Low-confidence predictions, unknown gestures, and user corrections queued for review.</p>
        </div>
      </header>

      <div className="admin-panel" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#1e293b", borderRadius: 6, border: "1px solid #334155", flex: 1, minWidth: 200 }}>
            <Search size={16} color="#64748b" />
            <input
              type="text" placeholder="Search glosses..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ background: "none", border: "none", color: "#e2e8f0", fontSize: 13, outline: "none", width: "100%" }}
            />
          </div>
          <select
            value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "8px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontSize: 13, outline: "none" }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="relabeled">Relabeled</option>
          </select>
          {selected.size > 0 && (
            <button onClick={convertSelected} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#2563eb", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <BookOpen size={14} /> Convert {selected.size} to Samples
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40, color: "#64748b" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Loading review queue...
          </div>
        ) : error ? (
          <div style={{ padding: 20, color: "#fca5a5", textAlign: "center" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <CheckCircle2 size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p>No items in the review queue</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase", width: 32 }}>
                    <input type="checkbox" onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filtered.map((i) => i.id)));
                      else setSelected(new Set());
                    }} checked={selected.size === filtered.length && filtered.length > 0} />
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Gloss</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Confidence</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Type</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Original Prediction</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Date</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const sc = statusColor(item.status);
                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #0f172a" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600, color: "#e2e8f0" }}>{item.gesture_label}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: confidenceColor(item.confidence), fontWeight: 600 }}>{(item.confidence * 100).toFixed(0)}%</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#1e293b", color: "#94a3b8" }}>{item.sourceLabel ?? item.source}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8", fontFamily: "monospace" }}>{item.original_prediction}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: sc.bg, color: sc.color }}>{item.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {item.status === "pending" && (
                            <>
                              <button onClick={() => updateItem(item.id, "approved")} title="Approve" style={{ padding: "4px 8px", background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 4, color: "#4ade80", cursor: "pointer", fontSize: 11 }}>
                                <CheckCircle2 size={14} />
                              </button>
                              <button onClick={() => updateItem(item.id, "rejected")} title="Reject" style={{ padding: "4px 8px", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 4, color: "#f87171", cursor: "pointer", fontSize: 11 }}>
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {item.status === "approved" && (
                            <button onClick={() => updateItem(item.id, "rejected")} title="Revert" style={{ padding: "4px 8px", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 4, color: "#f87171", cursor: "pointer", fontSize: 11 }}>
                              <XCircle size={14} />
                            </button>
                          )}
                          {item.status === "rejected" && (
                            <button onClick={() => updateItem(item.id, "approved")} title="Re-approve" style={{ padding: "4px 8px", background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 4, color: "#4ade80", cursor: "pointer", fontSize: 11 }}>
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-metric-grid" style={{ marginTop: 0 }}>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Total Items</p>
          <strong className="admin-metric-value">{items.length}</strong>
          <p className="admin-metric-note">All time</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Pending</p>
          <strong className="admin-metric-value" style={{ color: "#fde68a" }}>{items.filter((i) => i.status === "pending").length}</strong>
          <p className="admin-metric-note">Awaiting review</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Approved</p>
          <strong className="admin-metric-value" style={{ color: "#4ade80" }}>{items.filter((i) => i.status === "approved").length}</strong>
          <p className="admin-metric-note">Ready for training</p>
        </article>
        <article className="admin-metric-card">
          <p className="admin-metric-label">Low Confidence</p>
          <strong className="admin-metric-value" style={{ color: "#f87171" }}>{items.filter((i) => i.source === "low_confidence").length}</strong>
          <p className="admin-metric-note">Need attention</p>
        </article>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
