"use client";

import { useState, useCallback } from "react";
import type { GestureKnowledgeBase } from "@/lib/supabase/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = { initial: GestureKnowledgeBase[] };

const CATEGORY_LABELS: GestureKnowledgeBase["category"][] = ["alphabet", "phrase"];

export function KnowledgeBaseEditor({ initial }: Props) {
  const [entries, setEntries] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveEntry = useCallback(async (entry: GestureKnowledgeBase) => {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("gesture_knowledge_base").upsert(entry).eq("label", entry.label);
    if (error) console.error("save failed:", error);
    setSaving(false);
    setEditing(null);
  }, []);

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <table className="admin-table" style={{ flex: "1 1 100%", maxHeight: "70vh", overflow: "auto", display: "block" }}>
        <thead>
          <tr>
            <th>Label</th>
            <th>Category</th>
            <th>Difficulty</th>
            <th>Replies</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td><strong>{entry.display_name}</strong><br /><code>{entry.label}</code></td>
              <td>{entry.category === "alphabet" ? "A" : "P"}</td>
              <td>{entry.difficulty_level}</td>
              <td>{entry.suggested_replies?.length ?? 0}</td>
              <td>
                {editing === entry.id ? (
                  <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => saveEntry(entry)}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={() => setEditing(entry.id)}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (() => {
        const entry = entries.find((e) => e.id === editing);
        if (!entry) return null;
        return (
          <div className="card" style={{ flex: "0 0 400px" }}>
            <h3>Edit: {entry.display_name}</h3>
            <EditorForm
              entry={entry}
              onChange={(updated) => setEntries(entries.map((e) => e.id === updated.id ? updated : e))}
            />
          </div>
        );
      })()}
    </div>
  );
}

function EditorForm({ entry, onChange }: { entry: GestureKnowledgeBase; onChange: (e: GestureKnowledgeBase) => void }) {
  const update = <K extends keyof GestureKnowledgeBase>(key: K, value: GestureKnowledgeBase[K]) => {
    onChange({ ...entry, [key]: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label>Display Name
        <input value={entry.display_name} onChange={(e) => update("display_name", e.target.value)} />
      </label>
      <label>Category
        <select value={entry.category} onChange={(e) => update("category", e.target.value as GestureKnowledgeBase["category"])}>
          {CATEGORY_LABELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>Description
        <textarea value={entry.description ?? ""} rows={3} onChange={(e) => update("description", e.target.value)} />
      </label>
      <label>Usage Explanation
        <textarea value={entry.usage_explanation ?? ""} rows={3} onChange={(e) => update("usage_explanation", e.target.value)} />
      </label>
      <label>Difficulty (1-5)
        <input type="number" min={1} max={5} value={entry.difficulty_level} onChange={(e) => update("difficulty_level", Math.min(5, Math.max(1, Number(e.target.value))))} />
      </label>
      <label>Reference Video URL
        <input value={entry.reference_video_url ?? ""} onChange={(e) => update("reference_video_url", e.target.value)} />
      </label>
      <label>Related Gestures (comma-separated)
        <input value={(entry.related_gestures ?? []).join(", ")} onChange={(e) => update("related_gestures", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </label>
      <label>Suggested Replies (comma-separated)
        <textarea value={(entry.suggested_replies ?? []).join(", ")} rows={2} onChange={(e) => update("suggested_replies", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </label>
      <label>Common Mistakes
        <textarea value={entry.common_mistakes ?? ""} rows={2} onChange={(e) => update("common_mistakes", e.target.value)} />
      </label>
    </div>
  );
}
