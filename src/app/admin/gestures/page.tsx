"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GestureStatus = "draft" | "review" | "approved" | "archived";

interface Gesture {
  id: string;
  label: string;
  description: string;
  video_path: string | null;
  thumbnail_path: string | null;
  is_active: boolean;
  status: GestureStatus;
  display_order: number;
}

interface Reply {
  id: string;
  gesture_id: string;
  reply_text: string;
  display_order: number;
  is_active: boolean;
}

const STATUS_LABELS: Record<GestureStatus, string> = {
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  archived: "Archived"
};

export default function AdminGesturesPage() {
  const router = useRouter();
  const [gestures, setGestures] = useState<Gesture[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Gesture> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | GestureStatus>("all");

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gestures", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load gestures");
      const data = (await res.json()) as { gestures: Gesture[]; replies: Reply[] };
      setGestures(data.gestures);
      setReplies(data.replies);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const saveGesture = async () => {
    if (!editing) return;
    try {
      const res = await fetch("/api/admin/gestures", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing)
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Save failed");
      }
      setEditing(null);
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const removeGesture = async (id: string) => {
    if (!confirm("Delete this gesture and its replies?")) return;
    try {
      const res = await fetch(`/api/admin/gestures?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!editing?.id) {
      setError("Save the gesture first, then upload a video.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("gestureId", editing.id);
      const res = await fetch("/api/admin/gestures/upload", {
        method: "POST",
        body: form
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Upload failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const transitionStatus = async (id: string, status: GestureStatus) => {
    try {
      const res = await fetch("/api/admin/gestures", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Status update failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const visible = statusFilter === "all"
    ? gestures
    : gestures.filter((g) => g.status === statusFilter);

  return (
    <div>
      <div className="admin-toolbar">
        <h2>Gesture library</h2>
        <button
          className="button"
          onClick={() =>
            setEditing({
              label: "",
              description: "",
              is_active: true,
              status: "draft",
              display_order: gestures.length
            })
          }
        >
          + New gesture
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <label className="admin-filter">
        Filter by status:
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | GestureStatus)}
        >
          <option value="all">All ({gestures.length})</option>
          {(Object.keys(STATUS_LABELS) as GestureStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]} ({gestures.filter((g) => g.status === s).length})
            </option>
          ))}
        </select>
      </label>
      {loading ? (
        <p className="panel-note">Loading...</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Description</th>
                <th>Video</th>
                <th>Status</th>
                <th>Active</th>
                <th>Order</th>
                <th>Replies</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.id}>
                  <td>
                    <code>{g.label}</code>
                  </td>
                  <td className="admin-table-truncate">{g.description}</td>
                  <td>{g.video_path ? "Yes" : "—"}</td>
                  <td>
                    <span className={`role-pill role-${g.status === "approved" ? "admin" : "user"}`}>
                      {STATUS_LABELS[g.status]}
                    </span>
                  </td>
                  <td>{g.is_active ? "Yes" : "No"}</td>
                  <td>{g.display_order}</td>
                  <td>{replies.filter((r) => r.gesture_id === g.id).length}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        className="button button-secondary"
                        onClick={() => setEditing(g)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => removeGesture(g.id)}
                      >
                        Delete
                      </button>
                      {g.status !== "approved" && (
                        <button
                          className="button"
                          onClick={() => transitionStatus(g.id, "approved")}
                        >
                          Approve
                        </button>
                      )}
                      {g.status !== "review" && (
                        <button
                          className="button button-secondary"
                          onClick={() => transitionStatus(g.id, "review")}
                        >
                          Review
                        </button>
                      )}
                      {g.status !== "archived" && (
                        <button
                          className="button button-secondary"
                          onClick={() => transitionStatus(g.id, "archived")}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="admin-edit-overlay" onClick={() => setEditing(null)}>
          <div
            className="admin-edit-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing.id ? "Edit gesture" : "New gesture"}</h3>
            <label>
              Label
              <input
                value={editing.label ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, label: e.target.value })
                }
                maxLength={64}
              />
            </label>
            <label>
              Description
              <textarea
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                rows={3}
              />
            </label>
            <label>
              Status
              <select
                value={editing.status ?? "draft"}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value as GestureStatus })
                }
              >
                {(Object.keys(STATUS_LABELS) as GestureStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label>
              Display order
              <input
                type="number"
                value={editing.display_order ?? 0}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    display_order: Number(e.target.value) || 0
                  })
                }
              />
            </label>
            <label className="admin-edit-checkbox">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, is_active: e.target.checked })
                }
              />
              Active
            </label>
            {editing.id && (
              <label>
                Reference video
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleVideoUpload(file);
                  }}
                />
                {uploading && <span> Uploading...</span>}
              </label>
            )}
            <div className="admin-edit-actions">
              <button
                className="button button-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="button"
                onClick={saveGesture}
                disabled={!editing.label}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
