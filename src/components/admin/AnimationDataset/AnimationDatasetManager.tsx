"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search, Filter, Eye, Send, CheckCircle2, Clock, Star,
  FileJson, Play, Pause, RotateCcw, X, ChevronDown, ChevronRight,
} from "lucide-react";
import { drawFullPose, drawStylizedFace, drawFullHand } from "@/features/sign-animation/renderer/renderUtils";

interface AssetSummary {
  label: string;
  file: string;
  filePath: string;
  frameCount: number;
  duration: number;
}

interface DatasetResponse {
  labels: string[];
  assets: AssetSummary[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#64748b" },
  selected: { label: "Best Pick", color: "#22c55e" },
  published: { label: "Published", color: "#16a34a" },
};

export function AnimationDatasetManager() {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());
  const [bestPicks, setBestPicks] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const loadDataset = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/assets/dataset")
      .then((r) => r.json())
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
      .catch(() => setError("Failed to load the dataset. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDataset();
  }, [loadDataset]);

  const filteredAssets = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter((a) => a.label.toLowerCase().includes(q) || a.file.toLowerCase().includes(q));
  }, [assets, search]);

  const groupedAssets = useMemo(() => {
    const grouped: Record<string, AssetSummary[]> = {};
    for (const a of filteredAssets) {
      if (!grouped[a.label]) grouped[a.label] = [];
      grouped[a.label].push(a);
    }
    return grouped;
  }, [filteredAssets]);

  const loadPreview = useCallback(async (asset: AssetSummary) => {
    setSelectedAsset(asset);
    setPreviewPlaying(false);
    setPreviewFrame(0);
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }

    try {
      const res = await fetch(`/api/assets/dataset?label=${encodeURIComponent(asset.label)}&file=${encodeURIComponent(asset.file)}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPreviewData(data);
    } catch {
      setError("Failed to load preview");
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
    ctx.fillStyle = "#0f172a";
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
    if (previewData && selectedAsset) {
      renderPreviewFrame(previewFrame);
    }
  }, [previewFrame, previewData, selectedAsset, renderPreviewFrame]);

  useEffect(() => {
    if (!previewPlaying || !previewData) return;
    const total = previewData.totalFrames ?? previewData.frames?.length ?? 0;
    const fps = previewData.fps ?? 30;

    const interval = setInterval(() => {
      setPreviewFrame((prev) => {
        const next = prev + 1;
        if (next >= total) {
          setPreviewPlaying(false);
          return 0;
        }
        return next;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [previewPlaying, previewData]);

  const toggleLabel = (label: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const totalFrames = assets.reduce((s, a) => s + a.frameCount, 0);

  return (
    <div style={{ color: "#e2e8f0" }}>
      <style>{`
        .ad-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .ad-header h1 { font-size: 24px; font-weight: 700; margin: 0; color: #f1f5f9; }
        .ad-header .stats { display: flex; gap: 24px; font-size: 13px; color: #94a3b8; }
        .ad-header .stats strong { color: #e2e8f0; }
        .ad-search { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .ad-search input { flex: 1; min-width: 200px; padding: 10px 14px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 14px; outline: none; }
        .ad-search input:focus { border-color: #60a5fa; }
        .ad-layout { display: grid; grid-template-columns: 1fr 400px; gap: 20px; }
        @media (max-width: 1000px) { .ad-layout { grid-template-columns: 1fr; } }
        .ad-list { background: #0f172a; border-radius: 12px; border: 1px solid #1e293b; overflow: hidden; }
        .ad-label { display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid #1e293b; transition: background 0.1s; }
        .ad-label:hover { background: rgba(30,41,59,0.5); }
        .ad-label .name { font-weight: 600; font-size: 14px; min-width: 80px; }
        .ad-label .count { font-size: 12px; color: #64748b; }
        .ad-label .best { font-size: 10px; background: rgba(34,197,94,0.15); color: #4ade80; padding: 2px 6px; border-radius: 4px; }
        .ad-asset { display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 44px; border-bottom: 1px solid #1e293b; font-size: 13px; cursor: pointer; transition: background 0.1s; }
        .ad-asset:hover { background: rgba(30,41,59,0.5); }
        .ad-asset.selected { background: rgba(59,130,246,0.08); border-left: 3px solid #60a5fa; }
        .ad-asset .name { flex: 1; color: #94a3b8; }
        .ad-asset .frames { color: #64748b; font-size: 11px; }
        .ad-asset .dur { color: #64748b; font-size: 11px; min-width: 50px; text-align: right; }
        .ad-preview { background: #0f172a; border-radius: 12px; border: 1px solid #1e293b; padding: 16px; }
        .ad-preview h3 { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: #e2e8f0; }
        .ad-preview canvas { width: 100%; aspect-ratio: 4/5; border-radius: 8px; background: #0f172a; }
        .ad-preview-controls { display: flex; gap: 8px; margin-top: 10px; align-items: center; justify-content: center; }
        .ad-preview-controls button { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid #334155; border-radius: 6px; background: #1e293b; color: #94a3b8; cursor: pointer; }
        .ad-preview-controls button:hover { background: #334155; color: #e2e8f0; }
        .ad-preview-controls button.active { color: #60a5fa; border-color: #60a5fa; }
        .ad-preview-controls .slider { flex: 1; margin: 0 8px; }
        .ad-preview-meta { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #94a3b8; }
        .ad-preview-meta .val { color: #e2e8f0; font-weight: 600; }
        .ad-preview-actions { display: flex; gap: 8px; margin-top: 12px; }
        .ad-preview-actions button { flex: 1; padding: 8px; border: 1px solid #334155; border-radius: 8px; background: #1e293b; color: #e2e8f0; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .ad-preview-actions button:hover { background: #334155; }
        .ad-preview-actions .publish { background: #2563eb; border-color: #2563eb; }
        .ad-preview-actions .publish:hover { background: #1d4ed8; }
        .ad-loading { display: flex; align-items: center; justify-content: center; height: 200px; color: #64748b; gap: 10px; }
        .ad-empty { text-align: center; padding: 60px 20px; color: #64748b; }
        .ad-error { padding: 12px 16px; background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); border-radius: 10px; color: #fca5a5; font-size: 13px; margin-bottom: 16px; }
      `}</style>

      <div className="ad-header">
        <div>
          <h1>Animation Dataset</h1>
          <div className="stats">
            <span><strong>{labels.length}</strong> labels</span>
            <span><strong>{assets.length}</strong> recordings</span>
            <span><strong>{totalFrames.toLocaleString()}</strong> frames</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="ad-error">
          <span>{error}</span>
          <button type="button" onClick={loadDataset} style={{ marginLeft: 10, color: "#fca5a5", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ad-loading">
          <div style={{ width: 20, height: 20, border: "2px solid #334155", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "ad-spin 0.8s linear infinite" }} />
          Loading dataset...
        </div>
      ) : (
        <div className="ad-layout">
          <div>
            <div className="ad-search">
              <input placeholder="Search labels or filenames..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>
                {filteredAssets.length} of {assets.length}
              </span>
            </div>

            <div className="ad-list">
              {Object.entries(groupedAssets).length === 0 ? (
                <div className="ad-empty">
                  {assets.length === 0 ? "No dataset recordings yet." : "No results for that search."}
                  <p style={{ fontSize: 12, marginTop: 6 }}>
                    {assets.length === 0 ? "Record or upload in Animation Studio to add recordings." : "Try a different label or filename."}
                  </p>
                </div>
              ) : (
                Object.entries(groupedAssets).sort(([a], [b]) => a.localeCompare(b)).map(([label, labelAssets]) => (
                  <div key={label}>
                    <div className="ad-label" onClick={() => toggleLabel(label)}>
                      {expandedLabels.has(label) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="name">{label}</span>
                      <span className="count">{labelAssets.length} recordings</span>
                      {bestPicks[label] && <span className="best">Best: {bestPicks[label].replace("_asset.json", "")}</span>}
                    </div>
                    {expandedLabels.has(label) && labelAssets.map((asset) => (
                      <div
                        key={asset.file}
                        className={`ad-asset ${selectedAsset?.file === asset.file && selectedAsset?.label === label ? "selected" : ""}`}
                        onClick={() => loadPreview(asset)}
                      >
                        <CheckCircle2 size={12} color={bestPicks[label] === asset.file ? "#22c55e" : "#334155"} />
                        <span className="name">{asset.file.replace("_asset.json", "")}</span>
                        <span className="frames">{asset.frameCount} frames</span>
                        <span className="dur">{(asset.duration / 1000).toFixed(1)}s</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ad-preview">
            {selectedAsset && previewData ? (
              <>
                <h3>{selectedAsset.label} / {selectedAsset.file.replace("_asset.json", "")}</h3>
                <canvas ref={canvasRef} width={360} height={450} />
                <div className="ad-preview-controls">
                  <button onClick={() => { setPreviewPlaying(false); setPreviewFrame(0); }}>
                    <RotateCcw size={14} />
                  </button>
                  <button onClick={() => setPreviewPlaying(!previewPlaying)} className={previewPlaying ? "active" : ""}>
                    {previewPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={(previewData.totalFrames ?? previewData.frames?.length ?? 1) - 1}
                    value={previewFrame}
                    onChange={(e) => { setPreviewPlaying(false); setPreviewFrame(Number(e.target.value)); }}
                    style={{ width: "100%" }}
                  />
                </div>
                <div className="ad-preview-meta">
                  <div>Frames <span className="val">{previewData.totalFrames ?? previewData.frames?.length ?? 0}</span></div>
                  <div>FPS <span className="val">{previewData.fps ?? 30}</span></div>
                  <div>Duration <span className="val">{((previewData.duration ?? 0) / 1000).toFixed(2)}s</span></div>
                  <div>Pose <span className="val">{(previewData.frames?.[0]?.poseLandmarks?.length ?? 0) > 0 ? "Yes" : "No"}</span></div>
                  <div>Face <span className="val">{(previewData.frames?.[0]?.faceLandmarks?.length ?? 0) > 0 ? "Yes" : "No"}</span></div>
                  <div>Hands <span className="val">{(previewData.frames?.[0]?.landmarks?.length ?? 0) > 0 ? "Yes" : "No"}</span></div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, color: "#64748b", textAlign: "center", gap: 10 }}>
                <FileJson size={40} />
                <p style={{ fontSize: 13 }}>Select an asset to preview</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes ad-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
