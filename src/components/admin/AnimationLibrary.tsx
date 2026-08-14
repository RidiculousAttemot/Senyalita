"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Filter,
  Eye,
  Send,
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileJson,
  Star,
} from "lucide-react";
import type { AnimationLibraryAsset } from "@/lib/animationLibrary";
import { animationLibrary } from "@/lib/animationLibrary";
import { AliasEditor } from "./AliasEditor";

type SortOption = "recent" | "published" | "gloss";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Draft", color: "#64748b", icon: Clock },
  processing: { label: "Processing", color: "#eab308", icon: Clock },
  failed: { label: "Failed", color: "#ef4444", icon: XCircle },
  ready: { label: "Needs Review", color: "#3b82f6", icon: Eye },
  approved: { label: "Approved", color: "#22c55e", icon: CheckCircle2 },
  published: { label: "Published", color: "#16a34a", icon: Star },
  archived: { label: "Archived", color: "#6b7280", icon: Archive },
};

export function AnimationLibraryPage() {
  const [assets, setAssets] = useState<AnimationLibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [selectedAsset, setSelectedAsset] = useState<AnimationLibraryAsset | null>(null);
  const [previewJson, setPreviewJson] = useState<string | null>(null);
  /**
   * Which glosses anyone can actually reach by typing.
   *
   * A published sign with no words is unreachable, and nothing on this page
   * said so — the asset looked complete because publishing had succeeded.
   * Read from the public alias route so this is the same answer the translator
   * would give.
   */
  const [glossesWithWords, setGlossesWithWords] = useState<Set<string> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await animationLibrary.list({ search, status: statusFilter, sort });
      setAssets(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort]);

  const loadAliasCoverage = useCallback(async () => {
    try {
      const res = await fetch("/api/animations/aliases");
      if (!res.ok) return;
      const body = (await res.json()) as { aliases: { gloss: string }[] };
      setGlossesWithWords(new Set(body.aliases.map((a) => a.gloss.toUpperCase())));
    } catch {
      // Leave it null. Unknown is not the same as none, and flagging every
      // asset as unreachable because one request failed would be worse than
      // saying nothing.
    }
  }, []);

  useEffect(() => { void loadAliasCoverage(); }, [loadAliasCoverage]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleAction = useCallback(async (versionId: string, action: "approve" | "publish" | "archive") => {
    setActionLoading(versionId);
    try {
      await animationLibrary.performAction(versionId, action);
      await loadAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }, [loadAssets]);

  const handlePreview = useCallback(async (asset: AnimationLibraryAsset) => {
    setSelectedAsset(asset);
    if (asset.publishedVersion?.landmarkJsonPath) {
      try {
        const res = await fetch(`/api/admin/animation-assets/${asset.publishedVersion.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preview" }),
        });
      } catch {}
    }
    setPreviewJson(null);
  }, []);

  const filtered = useMemo(() => {
    let result = [...assets];
    if (search) {
      const q = search.toUpperCase();
      result = result.filter((a) => a.gloss.includes(q));
    }
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    return result;
  }, [assets, search, statusFilter]);

  const statuses = useMemo(() => {
    const set = new Set(assets.map((a) => a.status));
    return Array.from(set).sort();
  }, [assets]);

  const formatDuration = (ms: number | null | undefined): string => {
    if (!ms) return "—";
    const s = ms / 1000;
    return `${s.toFixed(1)}s`;
  };

  const formatDate = (d: string | null): string => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div>
      <style>{`
        .al-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
        .al-header { margin-bottom: 24px; }
        .al-header h1 { font-size: 24px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; }
        .al-header p { font-size: 14px; color: #94a3b8; margin: 0; }
        .al-toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .al-search { flex: 1; min-width: 200px; position: relative; }
        .al-search input {
          width: 100%; padding: 8px 12px 8px 36px;
          background: #1e293b; border: 1px solid #334155; border-radius: 8px;
          color: #e2e8f0; font-size: 13px; outline: none; box-sizing: border-box;
        }
        .al-search input:focus { border-color: #60a5fa; }
        .al-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: #64748b; }
        .al-filter { display: flex; gap: 8px; align-items: center; }
        .al-filter select {
          padding: 8px 12px; background: #1e293b; border: 1px solid #334155;
          border-radius: 8px; color: #e2e8f0; font-size: 13px; outline: none;
        }
        .al-filter select:focus { border-color: #60a5fa; }
        .al-stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .al-stat { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #94a3b8; }
        .al-stat strong { color: #e2e8f0; font-weight: 600; }
        .al-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .al-card {
          background: #0f172a; border: 1px solid #1e293b; border-radius: 10px;
          padding: 16px; transition: all 0.15s; cursor: pointer;
        }
        .al-card:hover { border-color: #334155; }
        .al-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .al-card-gloss { font-size: 18px; font-weight: 700; color: #f1f5f9; }
        .al-card-status {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 500;
        }
        .al-card-body { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .al-card-stat { display: flex; flex-direction: column; gap: 1px; }
        .al-card-stat .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .al-card-stat .val { font-size: 13px; font-weight: 600; color: #cbd5e1; }
        .al-card-actions { display: flex; gap: 4px; flex-wrap: wrap; border-top: 1px solid #1e293b; padding-top: 10px; }
        .al-card-actions button {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border: 1px solid #334155; border-radius: 6px;
          font-size: 11px; font-weight: 500; cursor: pointer;
          background: transparent; color: #94a3b8; transition: all 0.12s;
        }
        .al-card-actions button:hover { background: #1e293b; color: #e2e8f0; }
        .al-card-actions button:disabled { opacity: 0.4; cursor: not-allowed; }
        .al-card-actions button svg { width: 13px; height: 13px; }
        .al-card-actions .primary { color: #60a5fa; border-color: #1e3a5f; }
        .al-card-actions .primary:hover { background: #1e3a5f; }
        .al-card-actions .success { color: #4ade80; border-color: #14532d; }
        .al-card-actions .success:hover { background: #14532d; }
        .al-card-actions .danger { color: #f87171; border-color: #7f1d1d; }
        .al-card-actions .danger:hover { background: #2d1a1a; }
        .al-card-version { font-size: 10px; color: #475569; margin-top: 6px; }
        .al-empty { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748b; }
        .al-empty svg { width: 40px; height: 40px; opacity: 0.3; margin-bottom: 12px; }
        .al-error {
          padding: 10px 14px; background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3);
          border-radius: 8px; color: #fca5a5; font-size: 13px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .loading-spinner {
          display: flex; align-items: center; justify-content: center; padding: 60px;
          color: #64748b; font-size: 14px; gap: 8px;
        }
        @keyframes al-spin { to { transform: rotate(360deg); } }
        .spin { animation: al-spin 0.8s linear infinite; }
      `}</style>

      <div className="al-container">
        <div className="al-header">
          <h1>Animation Library</h1>
          <p>Browse, search, and manage all animation assets. Published assets are used by Type-to-Sign.</p>
        </div>

        <div className="al-toolbar">
          <div className="al-search">
            <Search />
            <input
              placeholder="Search by gloss label..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="al-filter">
            <Filter size={14} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => {
                const cfg = STATUS_CONFIG[s] ?? { label: s, color: "#64748b", icon: Clock };
                return <option key={s} value={s}>{cfg.label}</option>;
              })}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
              <option value="recent">Recently added</option>
              <option value="published">Recently published</option>
              <option value="gloss">Alphabetical</option>
            </select>
          </div>
        </div>

        <div className="al-stats">
          <div className="al-stat">Total: <strong>{assets.length}</strong></div>
          <div className="al-stat">Published: <strong>{assets.filter((a) => a.status === "published").length}</strong></div>
          <div className="al-stat">Pending: <strong>{assets.filter((a) => a.status === "ready" || a.status === "pending").length}</strong></div>
          <div className="al-stat">Draft: <strong>{assets.filter((a) => a.status === "pending").length}</strong></div>
          <div className="al-stat">Archived: <strong>{assets.filter((a) => a.status === "archived").length}</strong></div>
        </div>

        {error && (
          <div className="al-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner">
            <Clock className="spin" size={18} />
            Loading animation assets...
          </div>
        ) : (
          <div className="al-grid">
            {filtered.length === 0 ? (
              <div className="al-empty">
                <FileJson />
                <p>No animation assets found</p>
                <p style={{ fontSize: 12 }}>Upload a video in Animation Studio to create your first asset.</p>
              </div>
            ) : (
              filtered.map((asset) => {
                const cfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, color: "#64748b", icon: Clock };
                const StatusIcon = cfg.icon;
                const latest = asset.latestVersion;
                const published = asset.publishedVersion;

                return (
                  <div key={asset.id} className="al-card" onClick={() => handlePreview(asset)}>
                    <div className="al-card-header">
                      <span className="al-card-gloss">{asset.gloss}</span>
                      <span className="al-card-status" style={{ background: `${cfg.color}1a`, color: cfg.color }}>
                        <StatusIcon size={12} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Unreachable by typing. Published is not the same as
                        usable, and this was the difference nothing showed. */}
                    {glossesWithWords && !glossesWithWords.has(asset.gloss.toUpperCase()) && (
                      <span
                        className="al-card-status"
                        style={{ background: "#FFFBEB", color: "#92400E", marginTop: 6, width: "fit-content" }}
                      >
                        <AlertTriangle size={12} />
                        No words — cannot be typed
                      </span>
                    )}

                    <div className="al-card-body">
                      <div className="al-card-stat">
                        <span className="lbl">Frames</span>
                        <span className="val">{latest?.totalFrames ?? "—"}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Duration</span>
                        <span className="val">{formatDuration(latest?.durationMs)}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">FPS</span>
                        <span className="val">{latest?.fps ?? "—"}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Quality</span>
                        <span className="val">{latest?.qualityScore != null ? `${Math.round(latest.qualityScore)}%` : "—"}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Versions</span>
                        <span className="val">{asset.versionCount}</span>
                      </div>
                      <div className="al-card-stat">
                        <span className="lbl">Created</span>
                        <span className="val" style={{ fontSize: 11 }}>{formatDate(asset.createdAt)}</span>
                      </div>
                    </div>

                    <div className="al-card-actions">
                      {published && (
                        <button
                          className="primary"
                          onClick={(e) => { e.stopPropagation(); handlePreview(asset); }}
                        >
                          <Eye size={13} /> Preview
                        </button>
                      )}
                      {latest?.status === "ready" && (
                        <button
                          className="success"
                          disabled={actionLoading === latest.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(latest.id, "approve");
                          }}
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                      )}
                      {latest?.status === "approved" && (
                        <button
                          className="primary"
                          disabled={actionLoading === latest.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(latest.id, "publish");
                          }}
                        >
                          <Send size={13} /> Publish
                        </button>
                      )}
                      {latest && latest.status !== "archived" && latest.status !== "published" && (
                        <button
                          className="danger"
                          disabled={actionLoading === latest.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(latest.id, "archive");
                          }}
                        >
                          <Archive size={13} /> Archive
                        </button>
                      )}
                    </div>

                    <div className="al-card-version">
                      v{latest?.version ?? 1} · {asset.versionCount} version{asset.versionCount !== 1 ? "s" : ""}
                      {published && ` · Published v${published.version}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Clicking a card used to set this state and render nothing, so the
            only effect was a discarded request. It opens the words editor. */}
        {selectedAsset && (
          <div
            role="dialog"
            aria-label={`Words that play ${selectedAsset.gloss}`}
            style={{
              position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center",
              background: "rgba(15,23,42,0.45)", padding: 20,
            }}
            onClick={() => setSelectedAsset(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(560px, 100%)", maxHeight: "80vh", overflowY: "auto",
                border: "1px solid var(--admin-border)", borderRadius: 12,
                background: "var(--admin-surface)", padding: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <strong style={{ fontSize: "1rem" }}>{selectedAsset.gloss}</strong>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setSelectedAsset(null)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}
                >
                  <XCircle size={18} />
                </button>
              </div>
              <AliasEditor
                assetId={selectedAsset.id}
                gloss={selectedAsset.gloss}
                onCountChange={loadAliasCoverage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
