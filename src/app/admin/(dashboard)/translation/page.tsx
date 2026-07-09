"use client";

import React, { useState, useCallback, useMemo } from "react";
import { globalEngine } from "@/features/fsl-translation";
import { globalDictionary } from "@/features/fsl-translation";
import type { FslTranslationResult, DictionaryEntry } from "@/features/fsl-translation";

export default function AdminTranslationPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<FslTranslationResult | null>(null);
  const [showGloss, setShowGloss] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [dictionarySearch, setDictionarySearch] = useState("");
  const [dictionaryResults, setDictionaryResults] = useState<DictionaryEntry[]>([]);
  const [unknownWords, setUnknownWords] = useState<Array<{ word: string; count: number }>>([]);
  const [stats, setStats] = useState<{
    totalTranslations: number;
    avgTime: number;
    languageDistribution: Record<string, number>;
  }>({ totalTranslations: 0, avgTime: 0, languageDistribution: {} });
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DictionaryEntry>>({});
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"label" | "category">("label");
  const [notification, setNotification] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const coverageStats = globalDictionary.getCoverageStats();
  const allEntries = useMemo(() => globalDictionary.getAllEntries(), []);
  const categories = useMemo(() => Object.keys(coverageStats.categories).sort(), [coverageStats.categories]);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleTranslate = useCallback(() => {
    if (!input.trim()) return;
    const r = globalEngine.translate(input.trim(), { useGrammar: true, useContext: false });
    setResult(r);
    setUnknownWords(globalEngine.getUnknownWords());
    setStats((prev) => ({
      totalTranslations: prev.totalTranslations + 1,
      avgTime: (prev.avgTime * prev.totalTranslations + r.processingTimeMs) / (prev.totalTranslations + 1),
      languageDistribution: {
        ...prev.languageDistribution,
        [r.detectedLanguage.language]: (prev.languageDistribution[r.detectedLanguage.language] ?? 0) + 1,
      },
    }));
  }, [input]);

  const handleSearchDictionary = useCallback(() => {
    if (!dictionarySearch.trim()) {
      setDictionaryResults([]);
      return;
    }
    const search = dictionarySearch.toLowerCase();
    let results = globalDictionary.getAllEntries().filter(
      (e) =>
        e.label.toLowerCase().includes(search) ||
        e.gloss.toLowerCase().includes(search) ||
        e.english.some((en) => en.toLowerCase().includes(search)) ||
        e.filipino.some((tl) => tl.toLowerCase().includes(search)) ||
        e.synonyms.some((s) => s.toLowerCase().includes(search)),
    );
    if (filterCategory !== "all") {
      results = results.filter((e) => e.category === filterCategory);
    }
    if (sortBy === "label") {
      results.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      results.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
    }
    setDictionaryResults(results.slice(0, 50));
  }, [dictionarySearch, filterCategory, sortBy]);

  const handleEditEntry = useCallback((entry: DictionaryEntry) => {
    setSelectedEntry(entry);
    setEditForm({ ...entry });
    setEditMode(true);
    setAddMode(false);
  }, []);

  const handleSaveEntry = useCallback(() => {
    if (!selectedEntry || !editForm) return;
    const updated: DictionaryEntry = { ...selectedEntry, ...editForm };
    globalDictionary.addEntry(updated);
    setEditMode(false);
    setSelectedEntry(updated);
    setDictionaryResults((prev) =>
      prev.map((e) => (e.label === updated.label ? updated : e)),
    );
    showNotification(`Entry "${updated.label}" saved`);
  }, [selectedEntry, editForm, showNotification]);

  const handleDeleteEntry = useCallback((label: string) => {
    if (!confirm(`Delete entry "${label}"? This cannot be undone.`)) return;
    const entries = globalDictionary.getAllEntries().filter((e) => e.label !== label);
    globalDictionary.clear();
    for (const e of entries) {
      globalDictionary.addEntry(e);
    }
    setEditMode(false);
    setSelectedEntry(null);
    setDictionaryResults((prev) => prev.filter((e) => e.label !== label));
    showNotification(`Entry "${label}" deleted`);
  }, [showNotification]);

  const handleAddNew = useCallback(() => {
    const newEntry: DictionaryEntry = {
      label: "",
      gloss: "",
      synonyms: [],
      english: [],
      filipino: [],
      category: "general",
      animationAsset: undefined,
      suggestedReplies: [],
    };
    setSelectedEntry(null);
    setEditForm(newEntry);
    setAddMode(true);
    setEditMode(false);
  }, []);

  const handleCreateEntry = useCallback(() => {
    if (!editForm.label || !editForm.gloss) {
      showNotification("Label and Gloss are required");
      return;
    }
    const label = editForm.label.toUpperCase();
    const existing = globalDictionary.lookup(label);
    if (existing) {
      showNotification(`Entry "${label}" already exists`);
      return;
    }
    const entry: DictionaryEntry = {
      label,
      gloss: editForm.gloss?.toUpperCase() ?? label,
      synonyms: editForm.synonyms ?? [],
      english: editForm.english ?? [],
      filipino: editForm.filipino ?? [],
      category: editForm.category ?? "general",
      animationAsset: editForm.animationAsset || undefined,
      suggestedReplies: editForm.suggestedReplies ?? [],
    };
    globalDictionary.addEntry(entry);
    setAddMode(false);
    setEditForm({});
    showNotification(`Entry "${label}" created`);
    setDictionaryResults((prev) => [entry, ...prev]);
  }, [editForm, showNotification]);

  const handleClearContext = useCallback(() => {
    globalEngine.clearContext();
    setStats({ totalTranslations: 0, avgTime: 0, languageDistribution: {} });
  }, []);

  const handleExport = useCallback(() => {
    const entries = globalDictionary.getAllEntries();
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fsl-dictionary-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`Exported ${entries.length} entries`);
  }, [showNotification]);

  const handleImport = useCallback(() => {
    try {
      const entries: DictionaryEntry[] = JSON.parse(importText);
      if (!Array.isArray(entries) || entries.length === 0) {
        showNotification("Invalid import data");
        return;
      }
      for (const e of entries) {
        if (e.label && e.gloss) {
          globalDictionary.addEntry(e);
        }
      }
      showNotification(`Imported ${entries.length} entries`);
      setImportText("");
      setDictionaryResults([]);
    } catch {
      showNotification("Invalid JSON format");
    }
  }, [importText, showNotification]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Translation Dashboard</h1>

      {notification && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          padding: "10px 16px", borderRadius: 8,
          background: "#14532d", color: "#bbf7d0",
          fontSize: 13, border: "1px solid #22c55e",
          zIndex: 1000,
        }}>
          {notification}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Dictionary Entries</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: "4px 0 0" }}>
            {coverageStats.total}
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#14532d" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>With Animation</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#bbf7d0", margin: "4px 0 0" }}>
            {coverageStats.withAnimation}
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#451a1a" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Without Animation</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#fca5a5", margin: "4px 0 0" }}>
            {coverageStats.withoutAnimation}
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Avg Time</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: "4px 0 0" }}>
            {stats.avgTime.toFixed(1)}ms
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Translations</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: "4px 0 0" }}>
            {stats.totalTranslations}
          </p>
        </div>
        <button onClick={handleClearContext} className="button button-secondary" style={{ alignSelf: "center", padding: "8px 16px" }}>
          Reset Context
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Translate</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTranslate()}
              placeholder="Type a sentence to translate to FSL..."
              className="input"
              style={{ flex: 1, padding: "8px 12px", fontSize: 14 }}
            />
            <button onClick={handleTranslate} className="button button-primary" style={{ padding: "8px 16px" }}>
              Translate
            </button>
          </div>

          {result && (
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a", marginTop: 8 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Original:</span>
                <p style={{ fontSize: 14, color: "#e2e8f0" }}>{result.originalText}</p>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Detected Language:</span>
                <span style={{ fontSize: 14, color: "#fbbf24", marginLeft: 8 }}>
                  {result.detectedLanguage.language.toUpperCase()}
                  <span style={{ color: "#94a3b8", marginLeft: 4 }}>
                    ({(result.detectedLanguage.confidence * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Intent:</span>
                <span style={{ fontSize: 14, color: "#60a5fa", marginLeft: 8 }}>{result.intent}</span>
              </div>
              {showGloss && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>FSL Gloss:</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#bbf7d0" }}>{result.glossText}</p>
                </div>
              )}
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Context Used:</span>
                <span style={{ fontSize: 14, color: result.contextUsed ? "#bbf7d0" : "#94a3b8", marginLeft: 8 }}>
                  {result.contextUsed ? "Yes" : "No"}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#64748b" }}>Processing Time:</span>
                <span style={{ fontSize: 14, color: "#94a3b8", marginLeft: 8 }}>{result.processingTimeMs}ms</span>
              </div>

              {showQueue && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Gloss Sequence:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {result.glossSequence.map((g, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          background: g.resolution.strategy === "direct" ? "#14532d" :
                            g.resolution.strategy === "synonym" ? "#422006" :
                            g.resolution.strategy === "related" ? "#451a1a" : "#1e1b4b",
                          color: g.resolution.strategy === "direct" ? "#bbf7d0" :
                            g.resolution.strategy === "synonym" ? "#fde68a" :
                            g.resolution.strategy === "related" ? "#fca5a5" : "#c4b5fd",
                        }}
                      >
                        {g.gloss}
                        <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                          ({g.resolution.strategy === "fingerspelling" ? "finger" : g.resolution.strategy})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setShowGloss(!showGloss)} className="button button-secondary" style={{ padding: "4px 10px", fontSize: 11 }}>
                  {showGloss ? "Hide" : "Show"} Gloss
                </button>
                <button onClick={() => setShowQueue(!showQueue)} className="button button-secondary" style={{ padding: "4px 10px", fontSize: 11 }}>
                  {showQueue ? "Hide" : "Show"} Queue
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fca5a5", marginBottom: 4 }}>
              Unknown Words ({unknownWords.length})
            </h3>
            {unknownWords.length === 0 ? (
              <p style={{ fontSize: 12, color: "#64748b" }}>No unknown words logged</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {unknownWords.map((uw, i) => (
                  <span key={i} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: "#451a1a", color: "#fca5a5" }}>
                    {uw.word} ({uw.count})
                  </span>
                ))}
              </div>
            )}
          </div>

          {stats.totalTranslations > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Language Distribution</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(stats.languageDistribution).map(([lang, count]) => (
                  <span key={lang} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: "#1e293b", color: "#94a3b8" }}>
                    {lang.toUpperCase()}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Dictionary</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAddNew} className="button button-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
                + Add New
              </button>
              <button onClick={handleExport} className="button button-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Export
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={dictionarySearch}
              onChange={(e) => setDictionarySearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchDictionary()}
              placeholder="Search dictionary..."
              className="input"
              style={{ flex: 1, padding: "8px 12px", fontSize: 14 }}
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input"
              style={{ padding: "6px 8px", fontSize: 12, width: 110 }}
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "label" | "category")}
              className="input"
              style={{ padding: "6px 8px", fontSize: 12, width: 90 }}
            >
              <option value="label">Label</option>
              <option value="category">Category</option>
            </select>
            <button onClick={handleSearchDictionary} className="button button-primary" style={{ padding: "8px 16px" }}>
              Search
            </button>
          </div>

          {/* Import section */}
          <details style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>Import Dictionary (JSON)</summary>
            <div style={{ marginTop: 8 }}>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[{ "label": "HELLO", "gloss": "HELLO", "english": ["hello"], "filipino": ["kumusta"], "synonyms": ["hi"], "category": "greeting" }]'
                className="input"
                style={{ width: "100%", padding: "8px", fontSize: 11, minHeight: 80, fontFamily: "monospace" }}
              />
              <button onClick={handleImport} className="button button-secondary" style={{ padding: "6px 12px", fontSize: 12, marginTop: 4 }}>
                Import
              </button>
            </div>
          </details>

          <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 16 }}>
            {dictionaryResults.length > 0 ? dictionaryResults.map((entry) => (
              <div
                key={entry.label}
                onClick={() => handleEditEntry(entry)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: selectedEntry?.label === entry.label ? "#1e293b" : "transparent",
                  cursor: "pointer",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{entry.label}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
                      {entry.category}
                    </span>
                  </div>
                  <div>
                    {entry.animationAsset ? (
                      <span style={{ fontSize: 11, color: "#bbf7d0" }}>Animated</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#fca5a5" }}>No animation</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {entry.english.join(", ")} · {entry.filipino.join(", ")}
                </div>
              </div>
            )) : (
              dictionarySearch && (
                <p style={{ fontSize: 12, color: "#64748b", padding: 8 }}>No results found. Try a different search or adjust filters.</p>
              )
            )}
          </div>

          {/* Add new entry form */}
          {addMode && (
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#22c55e", marginBottom: 8 }}>Add New Entry</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Label *</label>
                  <input className="input" value={editForm.label ?? ""} onChange={(e) => setEditForm({ ...editForm, label: e.target.value.toUpperCase() })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Gloss *</label>
                  <input className="input" value={editForm.gloss ?? ""} onChange={(e) => setEditForm({ ...editForm, gloss: e.target.value.toUpperCase() })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Category</label>
                  <input className="input" value={editForm.category ?? ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Animation Asset</label>
                  <input className="input" value={editForm.animationAsset ?? ""} onChange={(e) => setEditForm({ ...editForm, animationAsset: e.target.value })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>English (comma-separated)</label>
                  <input className="input" value={(editForm.english ?? []).join(", ")} onChange={(e) => setEditForm({ ...editForm, english: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Filipino (comma-separated)</label>
                  <input className="input" value={(editForm.filipino ?? []).join(", ")} onChange={(e) => setEditForm({ ...editForm, filipino: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Synonyms (comma-separated)</label>
                  <input className="input" value={(editForm.synonyms ?? []).join(", ")} onChange={(e) => setEditForm({ ...editForm, synonyms: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={handleCreateEntry} className="button button-primary" style={{ padding: "6px 16px", fontSize: 12 }}>
                  Create
                </button>
                <button onClick={() => { setAddMode(false); setEditForm({}); }} className="button button-secondary" style={{ padding: "6px 16px", fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Edit entry form */}
          {editMode && selectedEntry && (
            <div style={{ padding: 16, borderRadius: 8, background: "#0f172a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24" }}>Edit: {selectedEntry.label}</h3>
                <button
                  onClick={() => handleDeleteEntry(selectedEntry.label)}
                  className="button"
                  style={{ padding: "4px 10px", fontSize: 11, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #ef4444", borderRadius: 4, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Gloss</label>
                  <input className="input" value={editForm.gloss ?? ""} onChange={(e) => setEditForm({ ...editForm, gloss: e.target.value.toUpperCase() })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Category</label>
                  <input className="input" value={editForm.category ?? ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Animation Asset</label>
                  <input className="input" value={editForm.animationAsset ?? ""} onChange={(e) => setEditForm({ ...editForm, animationAsset: e.target.value })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Synonyms (comma-separated)</label>
                  <input className="input" value={(editForm.synonyms ?? []).join(", ")} onChange={(e) => setEditForm({ ...editForm, synonyms: e.target.value.split(",").map((s) => s.trim()) })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>English (comma-separated)</label>
                  <input className="input" value={(editForm.english ?? []).join(", ")} onChange={(e) => setEditForm({ ...editForm, english: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8" }}>Filipino (comma-separated)</label>
                  <input className="input" value={(editForm.filipino ?? []).join(", ")} onChange={(e) => setEditForm({ ...editForm, filipino: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={{ width: "100%", padding: "4px 8px", fontSize: 12, marginTop: 2 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={handleSaveEntry} className="button button-primary" style={{ padding: "6px 16px", fontSize: 12 }}>
                  Save
                </button>
                <button onClick={() => setEditMode(false)} className="button button-secondary" style={{ padding: "6px 16px", fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>Category Breakdown</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(coverageStats.categories).map(([cat, count]) => (
                <span key={cat} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#1e293b", color: "#94a3b8" }}>
                  {cat}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
