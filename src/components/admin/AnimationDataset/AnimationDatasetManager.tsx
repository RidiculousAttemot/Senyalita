"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search, Eye, Play, Pause, RotateCcw, X, ChevronDown, ChevronRight,
  Database, Video, Film, Check, Minus, Star,
} from "lucide-react";
import { drawFullPose, drawStylizedFace, drawFullHand } from "@/features/sign-animation/renderer/renderUtils";
import { failureMessage } from "@/lib/http/failureMessage";

interface AssetSummary {
  label: string;
  file: string;
  filePath: string;
  frameCount: number;
  duration: number;
  id?: string;
  gloss?: string;
  version?: number;
  status?: string;
  fps?: number;
  durationMs?: number;
  qualityScore?: number | null;
  createdAt?: string | null;
}

interface DatasetResponse {
  labels: string[];
  assets: AssetSummary[];
}

/** Client-side label filters. Each one only re-slices the already-loaded list. */
type LabelFilter = "all" | "recordings" | "multiple" | "recent";

const SPEEDS = [0.5, 1, 1.5, 2];

function Tick({ on }: { on: boolean }) {
  return on ? (
    <span className="ad-tick is-true" aria-label="available"><Check size={12} strokeWidth={3} />Available</span>
  ) : (
    <span className="ad-tick is-false" aria-label="unavailable"><Minus size={12} />Missing</span>
  );
}

export function AnimationDatasetManager() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LabelFilter>("all");
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());
  const [bestPicks, setBestPicks] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // The .ok check is the point. Without it a 401 or an HTML error page went
    // straight into r.json(), so an auth failure and a server fault both
    // surfaced as "Failed to load dataset" via the catch below.
    fetch("/api/assets/dataset")
      .then(async (r) => {
        if (!r.ok) throw new Error(await failureMessage(r, "Failed to load dataset"));
        return (await r.json()) as DatasetResponse;
      })
      .then((data: DatasetResponse) => {
        setAssets(data.assets);
        setLabels(data.labels);
        const picks: Record<string, string> = {};
        for (const lbl of data.labels) {
          const labelAssets = data.assets.filter((a) => a.label === lbl);
          const best = labelAssets.reduce((a, b) => (a.frameCount > b.frameCount ? a : b), labelAssets[0]);
          if (best) picks[lbl] = best.file;
        }
        setBestPicks(picks);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load dataset"))
      .finally(() => setLoading(false));
  }, []);

  const searchFiltered = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter((a) => a.label.toLowerCase().includes(q) || a.file.toLowerCase().includes(q));
  }, [assets, search]);

  // Client-side labels whose assets meet the active filter. Reuses only the
  // already-fetched metadata — no new requests.
  const visibleLabels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of searchFiltered) counts.set(a.label, (counts.get(a.label) ?? 0) + 1);
    return [...counts.entries()]
      .filter(([label, count]) => {
        if (filter === "recordings") return count >= 1;
        if (filter === "multiple") return count >= 2;
        if (filter === "recent") {
          const labelAssets = searchFiltered.filter((a) => a.label === label);
          return labelAssets.some((a) => a.createdAt);
        }
        return true;
      })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label]) => label);
  }, [searchFiltered, filter]);

  const groupedAssets = useMemo(() => {
    const grouped: Record<string, AssetSummary[]> = {};
    for (const a of searchFiltered) {
      if (!grouped[a.label]) grouped[a.label] = [];
      grouped[a.label].push(a);
    }
    for (const label of Object.keys(grouped)) {
      grouped[label].sort((a, b) => (b.frameCount - a.frameCount) || (a.file.localeCompare(b.file)));
    }
    return grouped;
  }, [searchFiltered]);

  // "Recently added" sorts the label order by most recent recording.
  const orderedLabels = useMemo(() => {
    if (filter !== "recent") return visibleLabels;
    return [...visibleLabels].sort((a, b) => {
      const aMax = Math.max(...groupedAssets[a].map((x) => new Date(x.createdAt ?? 0).getTime()));
      const bMax = Math.max(...groupedAssets[b].map((x) => new Date(x.createdAt ?? 0).getTime()));
      return bMax - aMax;
    });
  }, [visibleLabels, filter, groupedAssets]);

  const loadPreview = useCallback(async (asset: AssetSummary) => {
    setSelectedAsset(asset);
    setPreviewPlaying(false);
    setPreviewFrame(0);
    setPreviewLoading(true);
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }

    try {
      const res = await fetch(`/api/assets/dataset?label=${encodeURIComponent(asset.label)}&file=${encodeURIComponent(asset.file)}`);
      if (!res.ok) throw new Error(await failureMessage(res, "Failed to load preview"));
      const data = await res.json();
      setPreviewData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const renderPreviewFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !previewData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = previewData.frames?.[frameIndex];
    if (!frame) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const style = {
      bodyColor: "#94a3b8",
      jointColor: "#cbd5e1",
      faceColor: "rgba(251,191,36,0.08)",
      faceFeatureColor: "#fbbf24",
      leftHandColor: "#C0593A",
      rightHandColor: "#60A5FA",
      lineWidth: 2,
      jointRadius: 2.5,
    };

    if (frame.poseLandmarks?.length > 0) {
      drawFullPose(ctx, frame.poseLandmarks, w, h, style);
    }
    if (frame.faceLandmarks?.length > 0) {
      drawStylizedFace(ctx, frame.faceLandmarks, w, h, style);
    }

    if (frame.landmarks) {
      for (const hand of frame.landmarks) {
        const color = hand.side === "left" ? style.leftHandColor : style.rightHandColor;
        drawFullHand(ctx, hand.landmarks, color, w, h, style.lineWidth, style.jointRadius);
      }
    }

    ctx.fillStyle = "#475569";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Frame ${frameIndex + 1}/${previewData.totalFrames ?? previewData.frames?.length ?? 0}`, 8, 18);
  }, [previewData]);

  useEffect(() => {
    if (previewData && selectedAsset && !previewLoading) {
      renderPreviewFrame(previewFrame);
    }
  }, [previewFrame, previewData, selectedAsset, renderPreviewFrame, previewLoading]);

  useEffect(() => {
    if (!previewPlaying || !previewData || previewLoading) return;
    const total = previewData.totalFrames ?? previewData.frames?.length ?? 0;
    const fps = previewData.fps ?? 30;
    // The interval delay folds playback speed in, reusing the same frame
    // stepping engine — no new playback implementation.
    const interval = setInterval(() => {
      setPreviewFrame((prev) => {
        const next = prev + 1;
        if (next >= total) {
          setPreviewPlaying(false);
          return 0;
        }
        return next;
      });
    }, 1000 / (fps * speed));

    return () => clearInterval(interval);
  }, [previewPlaying, previewData, speed, previewLoading]);

  const toggleLabel = (label: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const totalFrames = assets.reduce((s, a) => s + a.frameCount, 0);
  const previewFrames = previewData?.totalFrames ?? previewData?.frames?.length ?? 0;
  const previewFps = previewData?.fps ?? 30;
  const previewDurationMs = previewData?.duration ?? previewData?.durationMs ?? 0;
  const frame0 = previewData?.frames?.[0];
  const metaPose = frame0?.poseLandmarks?.length ?? 0;
  const metaFace = frame0?.faceLandmarks?.length ?? 0;
  const metaHands = frame0?.landmarks?.length ?? 0;
  const currentTime = (previewFrame / previewFps);
  const totalTime = (previewFrames / previewFps);

  const formatClock = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00.0";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
  };

  const renditionLabel = (file: string) => file.replace("_asset.json", "");

  return (
    <div className="ad-workspace">
      {/* Page header: title + compact stats */}
      <div className="ad-hero">
        <div>
          <h1>Animation Dataset</h1>
          <p className="ad-hero-sub">Manage, inspect, and preview recorded sign-language landmark data.</p>
        </div>
        <div className="ad-stat-row" aria-label="Dataset statistics">
          <div className="ad-stat-card">
            <span className="ad-stat-icon" aria-hidden="true"><Database size={16} /></span>
            <span className="ad-stat-text">
              <span className="ad-stat-label">Labels</span>
              <span className="ad-stat-value">{labels.length}</span>
            </span>
          </div>
          <div className="ad-stat-card">
            <span className="ad-stat-icon" aria-hidden="true"><Video size={16} /></span>
            <span className="ad-stat-text">
              <span className="ad-stat-label">Recordings</span>
              <span className="ad-stat-value">{assets.length}</span>
            </span>
          </div>
          <div className="ad-stat-card">
            <span className="ad-stat-icon" aria-hidden="true"><Film size={16} /></span>
            <span className="ad-stat-text">
              <span className="ad-stat-label">Frames</span>
              <span className="ad-stat-value">{totalFrames.toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>

      {error && <div className="ad-error">{error}</div>}

      {loading ? (
        <div className="ad-skeleton" role="status" aria-label="Loading dataset">
          {Array.from({ length: 5 }).map((_, i) => <div className="ad-skeleton-row" key={i} />)}
        </div>
      ) : (
        <div className="ad-layout">
          {/* Left: search + list */}
          <section className="ad-list-panel" aria-label="Dataset labels">
            <div className="ad-toolbar">
              <div className="ad-search-wrap">
                <span className="ad-search-icon" aria-hidden="true"><Search size={16} /></span>
                <input
                  type="search"
                  className="ad-search-input"
                  placeholder="Search labels or filenames..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search labels or filenames"
                />
              </div>
              <select
                className="ad-filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value as LabelFilter)}
                aria-label="Filter labels"
              >
                <option value="all">All labels</option>
                <option value="recordings">Has recording</option>
                <option value="multiple">Multiple recordings</option>
                <option value="recent">Recently added</option>
              </select>
            </div>

            <p className="ad-countline" aria-live="polite">
              {searchFiltered.length} of {assets.length} recordings
              {search && <> · {visibleLabels.length} labels match</>}
            </p>

            <div className="ad-list">
              {orderedLabels.length === 0 ? (
                <div className="ad-empty">
                  <Search size={32} aria-hidden="true" />
                  <p className="ad-empty-title">No results</p>
                  <p className="ad-empty-sub">No labels match your search or filter. Try a different term.</p>
                </div>
              ) : (
                orderedLabels.map((label) => {
                  const labelAssets = groupedAssets[label] ?? [];
                  const isExpanded = expandedLabels.has(label);
                  const isLabelSelected = selectedAsset?.label === label;
                  const best = bestPicks[label];
                  const hasMultiple = labelAssets.length >= 2;
                  return (
                    <div className="ad-group" key={label}>
                      <button
                        type="button"
                        className={`ad-label-row${isLabelSelected ? " is-selected" : ""}`}
                        onClick={() => toggleLabel(label)}
                        aria-expanded={isExpanded}
                        aria-controls={`ad-group-${label}`}
                      >
                        <span className={`ad-chev${isExpanded ? " is-open" : ""}`} aria-hidden="true">
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                        <span className="ad-label-name">{label}</span>
                        <span className="ad-label-count">
                          {labelAssets.length} recording{labelAssets.length !== 1 ? "s" : ""}
                        </span>
                        {hasMultiple && <span className="ad-pill ad-pill-muted">multi</span>}
                        {best && (
                          <span className="ad-label-best ad-pill ad-pill-best">
                            <Star size={11} fill="currentColor" aria-hidden="true" />
                            Best {renditionLabel(best)}
                          </span>
                        )}
                      </button>

                      {isExpanded && (
                        <div id={`ad-group-${label}`} className="ad-expand">
                          {labelAssets.map((asset) => {
                            const isSelected = selectedAsset?.file === asset.file && selectedAsset?.label === label;
                            const isBest = best === asset.file;
                            const hasPose = asset.frameCount > 0;
                            return (
                              <button
                                type="button"
                                key={asset.file}
                                className={`ad-asset-row${isSelected ? " is-selected" : ""}`}
                                onClick={() => loadPreview(asset)}
                                aria-pressed={isSelected}
                              >
                                <span className="ad-asset-version">{renditionLabel(asset.file)}</span>
                                <span className="ad-asset-meta">
                                  <span>{asset.frameCount} frames</span>
                                  <span>{asset.fps ? `${asset.fps} FPS` : "—"}</span>
                                  <span>{(asset.duration / 1000).toFixed(1)}s</span>
                                  <Tick on={hasPose} />
                                </span>
                                <span className="ad-asset-flag" aria-hidden="true">
                                  {isBest ? <Star size={14} fill="#22C55E" stroke="#22C55E" /> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Right: preview panel */}
          <aside className="ad-panel-card ad-preview-panel" aria-label="Landmark preview">
            {selectedAsset && previewData && !previewLoading ? (
              <>
                <div className="ad-preview-head">
                  <div className="ad-preview-title">
                    <span className="ad-preview-label">{selectedAsset.label}</span>
                    <span className="ad-preview-summary">
                      {renditionLabel(selectedAsset.file)}{selectedAsset.version ? ` · Version ${selectedAsset.version}` : ""}
                      {bestPicks[selectedAsset.label] === selectedAsset.file ? " · Best recording" : ""}
                    </span>
                  </div>
                  <span className="ad-preview-stage">
                    {bestPicks[selectedAsset.label] === selectedAsset.file ? (
                      <span className="ad-pill ad-pill-best"><Star size={11} fill="currentColor" aria-hidden="true" />Best</span>
                    ) : (
                      <span className="ad-pill ad-pill-muted">{selectedAsset.status ?? "ready"}</span>
                    )}
                  </span>
                </div>

                <div className="ad-canvas-zone">
                  <canvas ref={canvasRef} width={360} height={450} className="ad-preview-canvas" />
                  {previewLoading && (
                    <div className="ad-canvas-loading"><span><span className="ad-spinner ad-spinner--light" />Loading landmarks…</span></div>
                  )}
                </div>

                <div className="ad-playback">
                  <div className="ad-play-controls">
                    <button
                      type="button"
                      className="ad-ctl-btn"
                      onClick={() => { setPreviewPlaying(false); setPreviewFrame(0); }}
                      aria-label="Restart playback"
                      title="Restart"
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      type="button"
                      className={`ad-ctl-btn is-primary${previewPlaying ? " is-active" : ""}`}
                      onClick={() => setPreviewPlaying(!previewPlaying)}
                      aria-label={previewPlaying ? "Pause playback" : "Play playback"}
                      title={previewPlaying ? "Pause" : "Play"}
                    >
                      {previewPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <input
                      type="range"
                      className="ad-range ad-time-range"
                      min={0}
                      max={Math.max(0, previewFrames - 1)}
                      value={previewFrame}
                      onChange={(e) => { setPreviewPlaying(false); setPreviewFrame(Number(e.target.value)); }}
                      aria-label="Seek frame"
                    />
                    <div className="ad-speed" role="group" aria-label="Playback speed">
                      {SPEEDS.map((s) => (
                        <button
                          type="button"
                          key={s}
                          className={speed === s ? "is-active" : ""}
                          onClick={() => setSpeed(s)}
                          aria-pressed={speed === s}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ad-play-readout">
                    <span>Frame {previewFrame + 1} / {previewFrames}</span>
                    <span>{formatClock(currentTime)} / {formatClock(totalTime)}</span>
                  </div>
                </div>

                <div className="ad-meta">
                  <p className="ad-meta-title">Recording details</p>
                  <dl className="ad-meta-grid">
                    <div className="ad-meta-row"><dt>Frames</dt><dd>{previewFrames}</dd></div>
                    <div className="ad-meta-row"><dt>FPS</dt><dd>{previewFps}</dd></div>
                    <div className="ad-meta-row"><dt>Duration</dt><dd>{(previewDurationMs / 1000).toFixed(2)}s</dd></div>
                    <div className="ad-meta-row"><dt>Pose</dt><dd>{metaPose > 0 ? "Available" : "Missing"}</dd></div>
                    <div className="ad-meta-row"><dt>Face</dt><dd>{metaFace > 0 ? "Available" : "Missing"}</dd></div>
                    <div className="ad-meta-row"><dt>Hands</dt><dd>{metaHands > 0 ? "Available" : "Missing"}</dd></div>
                    {selectedAsset.createdAt && (
                      <div className="ad-meta-row"><dt>Created</dt><dd>{new Date(selectedAsset.createdAt).toLocaleDateString()}</dd></div>
                    )}
                    {typeof selectedAsset.qualityScore === "number" && (
                      <div className="ad-meta-row"><dt>Quality</dt><dd>{Math.round(selectedAsset.qualityScore * 100)}%</dd></div>
                    )}
                  </dl>
                </div>
              </>
            ) : (
              <div className="ad-empty" role="status">
                {previewLoading ? (
                  <><span className="ad-spinner" /> <p className="ad-empty-sub">Loading landmarks…</p></>
                ) : (
                  <>
                    {error ? <X size={32} aria-hidden="true" /> : <Eye size={32} aria-hidden="true" />}
                    <p className="ad-empty-title">Select a recording</p>
                    <p className="ad-empty-sub">Choose a dataset label from the list to preview its landmark animation and metadata.</p>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
