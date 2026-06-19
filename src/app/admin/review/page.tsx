"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ReviewQueueItem } from "@/lib/supabase/types";

type FilterStatus = "pending" | "approved" | "rejected" | "relabeled" | "all";

export default function AdminReviewPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    let query = supabase
      .from("review_queue")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    if (data) setItems(data as ReviewQueueItem[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const updateStatus = async (
    id: string,
    status: ReviewQueueItem["status"],
    correctedLabel?: string
  ) => {
    const supabase = createSupabaseBrowserClient();
    const { data: user } = await supabase.auth.getUser();
    const { data: item } = await supabase
      .from("review_queue")
      .select("*")
      .eq("id", id)
      .single();

    await supabase
      .from("review_queue")
      .update({
        status,
        corrected_label: correctedLabel ?? null,
        reviewed_by: user.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (status === "approved" && item) {
      const finalLabel = correctedLabel ?? item.original_prediction;
      await supabase.from("training_samples").insert({
        original_prediction: item.original_prediction,
        corrected_label: finalLabel.toUpperCase(),
        confidence: item.confidence,
        source: "review_approval",
        review_queue_id: id,
        approved_by: user.user?.id,
        landmark_snapshot: item.landmarks_data as any,
      }).maybeSingle();
    }

    fetchItems();
  };

  const tabs: FilterStatus[] = ["pending", "approved", "rejected", "relabeled", "all"];

  return (
    <div>
      <h2>Review Queue</h2>
      <p className="panel-note">
        Low-confidence predictions, user corrections, and admin flags that need review.
        Approved items can be used for future model retraining.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`button ${filter === tab ? "" : "button-secondary"}`}
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="panel-note">Loading...</p>
      ) : items.length === 0 ? (
        <p className="panel-note">No items in this queue.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gesture</th>
                <th>Confidence</th>
                <th>Source</th>
                <th>Original</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td><code>{item.gesture_label}</code></td>
                  <td>{(item.confidence * 100).toFixed(0)}%</td>
                  <td style={{ fontSize: 12 }}>{item.source.replace("_", " ")}</td>
                  <td><code>{item.original_prediction}</code></td>
                  <td>
                    <span style={{
                      color: item.status === "approved" ? "#22c55e" :
                             item.status === "rejected" ? "#ef4444" :
                             item.status === "relabeled" ? "#eab308" : "#888",
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.status === "pending" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          className="button"
                          style={{ padding: "2px 8px", fontSize: 12 }}
                          onClick={() => updateStatus(item.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="button button-secondary"
                          style={{ padding: "2px 8px", fontSize: 12 }}
                          onClick={() => {
                            const label = prompt("Corrected label:", item.original_prediction);
                            if (label) updateStatus(item.id, "relabeled", label.toUpperCase());
                          }}
                        >
                          Relabel
                        </button>
                        <button
                          className="button button-secondary"
                          style={{ padding: "2px 8px", fontSize: 12, color: "#ef4444" }}
                          onClick={() => updateStatus(item.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {item.status !== "pending" && (
                      <button
                        className="button button-secondary"
                        style={{ padding: "2px 8px", fontSize: 12 }}
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        {expandedId === item.id ? "Hide" : "Details"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expandedId && (() => {
        const item = items.find((i) => i.id === expandedId);
        if (!item) return null;
        return (
          <div className="panel" style={{ marginTop: 16, padding: 16 }}>
            <h4>Review Details</h4>
            <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 300, background: "#111", padding: 12, borderRadius: 8 }}>
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        );
      })()}
    </div>
  );
}
