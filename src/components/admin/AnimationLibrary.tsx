"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
  X,
  Pencil,
  Trash2,
  Download,
  Film,
  RefreshCw,
} from "lucide-react";
import type { AnimationLibraryAsset } from "@/lib/animationLibrary";
import { animationLibrary } from "@/lib/animationLibrary";
import type { AnimationClip, GestureAnimationAsset, ViewMode } from "@/features/sign-animation/types";

// Heaviest viewer in the app (canvas renderers + playback engine): loaded
// only once a preview is actually requested, not on every Library page load.
const SignAnimationPlayer = dynamic(
  () => import("@/features/sign-animation/player/SignAnimationPlayer").then((m) => m.SignAnimationPlayer),
  { ssr: false, loading: () => <div className="al-preview-loading">Loading viewer…</div> },
);

type SortOption = "recent" | "published" | "gloss";
const VIEW_MODES: ViewMode[] = ["human", "skeleton", "split", "overlay"];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Draft", color: "#64748b", icon: Clock },
  processing: { label: "Processing", color: "#eab308", icon: Clock },
  failed: { label: "Failed", color: "#ef4444", icon: XCircle },
  ready: { label: "Needs Review", color: "#3b82f6", icon: Eye },
  approved: { label: "Approved", color: "#22c55e", icon: CheckCircle2 },
  published: { label: "Published", color: "#16a34a", icon: Star },
  archived: { label: "Archived", color: "#6b7280", icon: Archive },
};

const LANGUAGES = ["fsl", "asl", "lsf"];

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnimationLibraryPage() {
  const [assets, setAssets] = useState<AnimationLibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [previewAsset, setPreviewAsset] = useState<AnimationLibraryAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<AnimationLibraryAsset | null>(null);
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

  const handleDelete = useCallback(async (asset: AnimationLibraryAsset) => {
    if (!window.confirm(`Permanently delete "${asset.gloss}" and all ${asset.versionCount} version(s)? This cannot be undone.`)) return;
    setActionLoading(asset.id);
    try {
      await animationLibrary.deleteAsset(asset.id);
      await loadAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  }, [loadAssets]);

  const handleDownloadVideo = useCallback(async (versionId: string) => {
    setActionLoading(versionId);
    try {
      const { videoUrl } = await animationLibrary.getAssetJson(versionId);
      if (!videoUrl) { setError("No source recording is stored for this version."); return; }
      window.open(videoUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the recording.");
    } finally {
      setActionLoading(null);
    }
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

  const formatDate = (d: string | null | undefined): string => {
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
          overflow: hidden; transition: all 0.15s;
        }
        .al-card:hover { border-color: #334155; }
        .al-card-thumb {
          width: 100%; height: 140px; background: #1e293b; display: flex;
          align-items: center; justify-content: center; color: #334155;
          background-size: cover; background-position: center;
        }
        .al-card-body-wrap { padding: 16px; }
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
        .al-card-actions button, .al-card-actions a {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border: 1px solid #334155; border-radius: 6px;
          font-size: 11px; font-weight: 500; cursor: pointer;
          background: transparent; color: #94a3b8; transition: all 0.12s;
          text-decoration: none;
        }
        .al-card-actions button:hover, .al-card-actions a:hover { background: #1e293b; color: #e2e8f0; }
        .al-card-actions button:disabled { opacity: 0.4; cursor: not-allowed; }
        .al-card-actions button svg, .al-card-actions a svg { width: 13px; height: 13px; }
        .al-card-actions .primary { color: #60a5fa; border-color: #1e3a5f; }
        .al-card-actions .primary:hover { background: #1e3a5f; }
        .al-card-actions .success { color: #4ade80; border-color: #14532d; }
        .al-card-actions .success:hover { background: #14532d; }
        .al-card-actions .danger { color: #f87171; border-color: #7f1d1d; }
        .al-card-actions .danger:hover { background: #2d1a1a; }
        .al-card-version { font-size: 10px; color: #475569; margin-top: 6px; padding: 0 16px 14px; }
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
        .al-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .al-skeleton-card { height: 280px; border-radius: 10px; background: linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); background-size: 200% 100%; animation: al-shimmer 1.4s ease-in-out infinite; }
        @keyframes al-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes al-spin { to { transform: rotate(360deg); } }
        .spin { animation: al-spin 0.8s linear infinite; }
        .al-modal-overlay {
          position: fixed; inset: 0; background: rgba(2,6,23,0.75); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;
        }
        .al-modal {
          background: #0f172a; border: 1px solid #1e293b; border-radius: 14px;
          width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 20px;
        }
        .al-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .al-modal-header h2 { font-size: 18px; font-weight: 700; color: #f1f5f9; margin: 0; font-family: monospace; }
        .al-modal-header button { background: none; border: none; color: #64748b; cursor: pointer; padding: 4px; }
        .al-modal-header button:hover { color: #e2e8f0; }
        .al-preview-loading { display: flex; align-items: center; justify-content: center; height: 300px; color: #64748b; font-size: 13px; }
        .al-viewmode-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
        .al-viewmode-tabs button {
          flex: 1; padding: 6px; border-radius: 6px; border: 1px solid #334155; background: #1e293b;
          color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: capitalize; cursor: pointer;
        }
        .al-viewmode-tabs button.active { background: #1e3a5f; color: #60a5fa; border-color: #2563eb; }
        .al-edit-field label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
        .al-edit-field select { width: 100%; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 13px; }
        .al-modal-save { margin-top: 16px; width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .al-modal-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="al-container">
        <div className="al-header">
          <h1>Animation Library</h1>
          <p>The single source of truth for every animation asset. Published versions are what Text-to-Sign plays back.</p>
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
          <div className="al-skeleton-grid" aria-busy="true" aria-label="Loading animation assets">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="al-skeleton-card" />)}
          </div>
        ) : (
          <div className="al-grid">
            {filtered.length === 0 ? (
              <div className="al-empty">
                <FileJson />
                <p>{assets.length === 0 ? "No published animations yet." : "No search results."}</p>
                <p style={{ fontSize: 12 }}>
                  {assets.length === 0 ? "Upload your first animation in Animation Studio." : "Try a different gloss, or clear the filters."}
                </p>
              </div>
            ) : (
              filtered.map((asset) => {
                const cfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, color: "#64748b", icon: Clock };
                const StatusIcon = cfg.icon;
                const latest = asset.latestVersion;
                const published = asset.publishedVersion;
                const displayed = published ?? latest;

                return (
                  <div key={asset.id} className="al-card">
                    <div
                      className="al-card-thumb"
                      style={displayed?.thumbnailUrl ? { backgroundImage: `url(${displayed.thumbnailUrl})` } : undefined}
                      aria-hidden="true"
                    >
                      {!displayed?.thumbnailUrl && <Film size={28} />}
                    </div>
                    <div className="al-card-body-wrap">
                      <div className="al-card-header">
                        <span className="al-card-gloss">{asset.gloss}</span>
                        <span className="al-card-status" style={{ background: `${cfg.color}1a`, color: cfg.color }}>
                          <StatusIcon size={12} />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="al-card-body">
                        <div className="al-card-stat">
                          <span className="lbl">Language</span>
                          <span className="val">{(displayed?.language ?? "fsl").toUpperCase()}</span>
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
                          <span className="lbl">Frames</span>
                          <span className="val">{latest?.totalFrames ?? "—"}</span>
                        </div>
                        <div className="al-card-stat">
                          <span className="lbl">Storage</span>
                          <span className="val">{formatBytes(latest?.storageBytes)}</span>
                        </div>
                        <div className="al-card-stat">
                          <span className="lbl">Quality</span>
                          <span className="val">{latest?.qualityScore != null ? `${Math.round(latest.qualityScore)}%` : "—"}</span>
                        </div>
                        <div className="al-card-stat">
                          <span className="lbl">Published</span>
                          <span className="val" style={{ fontSize: 11 }}>{formatDate(published?.publishedAt)}</span>
                        </div>
                        <div className="al-card-stat">
                          <span className="lbl">Version</span>
                          <span className="val">v{latest?.version ?? 1} of {asset.versionCount}</span>
                        </div>
                      </div>

                      <div className="al-card-actions">
                        {displayed && (
                          <button className="primary" onClick={() => setPreviewAsset(asset)}>
                            <Eye size={13} /> Preview
                          </button>
                        )}
                        {displayed && (
                          <button onClick={() => setEditingAsset(asset)}>
                            <Pencil size={13} /> Edit Metadata
                          </button>
                        )}
                        <Link href={`/admin/animation-studio?gloss=${encodeURIComponent(asset.gloss)}`}>
                          <RefreshCw size={13} /> Replace Version
                        </Link>
                        {latest?.status === "ready" && (
                          <button
                            className="success"
                            disabled={actionLoading === latest.id}
                            onClick={() => handleAction(latest.id, "approve")}
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                        )}
                        {latest?.status === "approved" && (
                          <button
                            className="primary"
                            disabled={actionLoading === latest.id}
                            onClick={() => handleAction(latest.id, "publish")}
                          >
                            <Send size={13} /> Publish
                          </button>
                        )}
                        {latest && latest.status !== "archived" && latest.status !== "published" && (
                          <button
                            disabled={actionLoading === latest.id}
                            onClick={() => handleAction(latest.id, "archive")}
                          >
                            <Archive size={13} /> Archive
                          </button>
                        )}
                        {displayed?.landmarkJsonPath && (
                          <a href={`/api/admin/animation-assets/${displayed.id}/asset`} target="_blank" rel="noreferrer">
                            <FileJson size={13} /> Download JSON
                          </a>
                        )}
                        {displayed && (
                          <button
                            disabled={actionLoading === displayed.id}
                            onClick={() => handleDownloadVideo(displayed.id)}
                          >
                            <Download size={13} /> Download Video
                          </button>
                        )}
                        <button
                          className="danger"
                          disabled={actionLoading === asset.id}
                          onClick={() => handleDelete(asset)}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {previewAsset && (
        <PreviewModal
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {editingAsset && (
        <EditMetadataModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSaved={loadAssets}
        />
      )}
    </div>
  );
}

function PreviewModal({ asset, onClose }: { asset: AnimationLibraryAsset; onClose: () => void }) {
  const versionId = (asset.publishedVersion ?? asset.latestVersion)?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("skeleton");

  useEffect(() => {
    if (!versionId) {
      setError("This asset has no processed version to preview yet.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    animationLibrary.getAssetJson(versionId)
      .then(({ asset: gestureAsset, videoUrl }) => {
        if (cancelled) return;
        const withVideo: GestureAnimationAsset = videoUrl ? { ...gestureAsset, video: videoUrl } : gestureAsset;
        setClips([{ id: withVideo.label, gesture: withVideo.label, asset: withVideo }]);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load preview");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [versionId]);

  return (
    <div className="al-modal-overlay" onClick={onClose}>
      <div className="al-modal" onClick={(e) => e.stopPropagation()}>
        <div className="al-modal-header">
          <h2>{asset.gloss}</h2>
          <button onClick={onClose} aria-label="Close preview"><X size={20} /></button>
        </div>

        {loading && <div className="al-preview-loading"><Clock className="spin" size={18} style={{ marginRight: 8 }} /> Loading preview…</div>}
        {error && (
          <div className="al-error"><AlertTriangle size={16} /><span>{error}</span></div>
        )}
        {!loading && !error && clips.length > 0 && (
          <>
            <div className="al-viewmode-tabs" role="tablist" aria-label="Preview mode">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={viewMode === mode}
                  className={viewMode === mode ? "active" : ""}
                  onClick={() => setViewMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            <SignAnimationPlayer clips={clips} width={520} height={420} viewMode={viewMode} showControls loop />
          </>
        )}
      </div>
    </div>
  );
}

function EditMetadataModal({ asset, onClose, onSaved }: { asset: AnimationLibraryAsset; onClose: () => void; onSaved: () => void }) {
  const current = asset.publishedVersion ?? asset.latestVersion;
  const [language, setLanguage] = useState(current?.language ?? "fsl");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setError("");
    try {
      await animationLibrary.performAction(current.id, "update-metadata", { language });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [current, language, onClose, onSaved]);

  return (
    <div className="al-modal-overlay" onClick={onClose}>
      <div className="al-modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="al-modal-header">
          <h2>{asset.gloss}</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {error && <div className="al-error"><AlertTriangle size={16} /><span>{error}</span></div>}
        <div className="al-edit-field">
          <label htmlFor="al-edit-language">Language</label>
          <select id="al-edit-language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </div>
        <button className="al-modal-save" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

