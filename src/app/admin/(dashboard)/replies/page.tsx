"use client";

import { useEffect, useMemo, useState } from "react";

interface Gesture {
  id: string;
  label: string;
  description: string;
}

interface Reply {
  id: string;
  gesture_id: string;
  reply_text: string;
  display_order: number;
  is_active: boolean;
  video_path: string | null;
}

export default function AdminRepliesPage() {
  const [gestures, setGestures] = useState<Gesture[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [filterGestureId, setFilterGestureId] = useState<string>("");
  const [editing, setEditing] = useState<Partial<Reply> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gestures", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load gestures");
      const data = (await res.json()) as { gestures: Gesture[]; replies: Reply[] };
      setGestures(data.gestures.map((g) => ({ id: g.id, label: g.label, description: g.description })));
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

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    gestures.forEach((g) => map.set(g.id, g.label));
    return map;
  }, [gestures]);

  const visible = filterGestureId
    ? replies.filter((r) => r.gesture_id === filterGestureId)
    : replies;

  const saveReply = async () => {
    if (!editing) return;
    try {
      const res = await fetch("/api/admin/replies", {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const removeReply = async (id: string) => {
    if (!confirm("Delete this reply?")) return;
    try {
      const res = await fetch(`/api/admin/replies?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!editing?.id || !editing.gesture_id) {
      setError("Save the reply first, then upload a response video.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("replyId", editing.id);
      form.append("gestureId", editing.gesture_id);
      const res = await fetch("/api/admin/replies/upload", {
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

  const resolvePublicUrl = (path: string | null): string | null => {
    if (!path) return null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/gesture-videos/${path}`;
  };

  return (
    <div>
      <div className="admin-toolbar">
        <h2>Suggested replies</h2>
        <button
          className="button"
          onClick={() =>
            setEditing({
              gesture_id: filterGestureId || (gestures[0]?.id ?? ""),
              reply_text: "",
              is_active: true,
              display_order: replies.filter(
                (r) => r.gesture_id === (filterGestureId || gestures[0]?.id)
              ).length
            })
          }
          disabled={gestures.length === 0}
        >
          + New reply
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <label className="admin-filter">
        Filter by gesture:
        <select
          value={filterGestureId}
          onChange={(e) => setFilterGestureId(e.target.value)}
        >
          <option value="">All gestures ({replies.length})</option>
          {gestures.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      {loading ? (
        <p className="panel-note">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="panel-note">No replies found.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Gesture</th>
                <th>Reply text</th>
                <th>Video</th>
                <th>Active</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{labelById.get(r.gesture_id) ?? r.gesture_id.slice(0, 8)}</code>
                  </td>
                  <td>{r.reply_text}</td>
                  <td>{r.video_path ? "Yes" : "—"}</td>
                  <td>{r.is_active ? "Yes" : "No"}</td>
                  <td>{r.display_order}</td>
                  <td>
                    <button className="button button-secondary" onClick={() => setEditing(r)}>
                      Edit
                    </button>
                    <button className="button button-secondary" onClick={() => removeReply(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="admin-edit-overlay" onClick={() => setEditing(null)}>
          <div className="admin-edit-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? "Edit reply" : "New reply"}</h3>
            <label>
              Gesture
              <select
                value={editing.gesture_id ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, gesture_id: e.target.value })
                }
              >
                {gestures.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reply text
              <textarea
                value={editing.reply_text ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, reply_text: e.target.value })
                }
                rows={2}
                maxLength={200}
              />
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
            {editing.id && editing.video_path && (
              <div>
                <p className="panel-label">Current response video</p>
                <video
                  src={resolvePublicUrl(editing.video_path) ?? undefined}
                  className="gesture-reference-video"
                  controls
                  muted
                  playsInline
                />
              </div>
            )}
            {editing.id && (
              <label>
                Response video
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
                <p className="panel-note">
                  Optional. Replaces the current response video.
                </p>
              </label>
            )}
            <div className="admin-edit-actions">
              <button className="button button-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="button"
                onClick={saveReply}
                disabled={!editing.gesture_id || !editing.reply_text}
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
