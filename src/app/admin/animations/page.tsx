"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { AnimationLoader } from "@/features/sign-animation/loader";
import { LandmarkCanvasRenderer } from "@/features/sign-animation/renderer";
import { PlaybackEngine } from "@/features/sign-animation/player";
import type { GestureAnimationAsset, AnimationClip } from "@/features/sign-animation/types";

interface AssetInfo {
  label: string;
  filename: string;
  exists: boolean;
  stats: {
    frames: number;
    duration: number;
    fps: number;
  } | null;
}

export default function AdminAnimationsPage() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState<{
    totalGestures: number;
    generated: number;
    missing: string[];
  } | null>(null);
  const [search, setSearch] = useState("");
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewEngineRef = useRef<PlaybackEngine | null>(null);
  const previewRendererRef = useRef<LandmarkCanvasRenderer | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  useEffect(() => {
    const loader = new AnimationLoader();
    const fetchData = async () => {
      try {
        const manifestResp = await fetch("/animations/manifest.json");
        const manifestData = await manifestResp.json();
        setManifest(manifestData);

        const assetList: AssetInfo[] = [];
        for (const label of manifestData.assets ?? []) {
          const filename = label.replace(/\s+/g, "_");
          const asset = await loader.load(label);
          assetList.push({
            label,
            filename,
            exists: asset !== null,
            stats: asset
              ? {
                  frames: asset.totalFrames,
                  duration: asset.duration,
                  fps: asset.fps,
                }
              : null,
          });
        }
        assetList.sort((a, b) => a.label.localeCompare(b.label));
        setAssets(assetList);
      } catch (e) {
        console.error("Failed to load animation manifest", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePreview = useCallback(async (label: string) => {
    setPreviewLabel(label);
    setPreviewPlaying(false);

    const loader = new AnimationLoader();
    const asset = await loader.load(label);
    if (!asset || !previewCanvasRef.current) return;

    if (previewRendererRef.current) previewRendererRef.current.dispose();
    if (previewEngineRef.current) previewEngineRef.current.dispose();

    const renderer = new LandmarkCanvasRenderer(previewCanvasRef.current, {
      width: 320,
      height: 400,
      showLabels: true,
    });
    previewRendererRef.current = renderer;

    const engine = new PlaybackEngine();
    previewEngineRef.current = engine;

    const clip: AnimationClip = {
      id: `preview-${label}`,
      gesture: label,
      asset,
    };

    engine.setCallbacks({
      onFrame: (frame) => renderer.render(frame),
      onQueueComplete: () => setPreviewPlaying(false),
    });

    engine.loadClip(clip);
    setPreviewPlaying(true);
  }, []);

  const handleStopPreview = useCallback(() => {
    previewEngineRef.current?.stop();
    previewRendererRef.current?.render(null);
    setPreviewPlaying(false);
    setPreviewLabel(null);
  }, []);

  const covered = assets.filter((a) => a.exists).length;
  const missing = assets.filter((a) => !a.exists);
  const filtered = assets.filter(
    (a) =>
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Animation Library</h1>

      {manifest && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Total Gestures</span>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: "4px 0 0" }}>
              {manifest.totalGestures}
            </p>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: covered === manifest.totalGestures ? "#14532d" : "#1e293b" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>With Animation</span>
            <p style={{ fontSize: 20, fontWeight: 700, color: covered === manifest.totalGestures ? "#bbf7d0" : "#e2e8f0", margin: "4px 0 0" }}>
              {covered} / {manifest.totalGestures}
              <span style={{ fontSize: 14, marginLeft: 8, color: "#64748b" }}>
                ({((covered / manifest.totalGestures) * 100).toFixed(0)}%)
              </span>
            </p>
          </div>
          {missing.length > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "#451a1a" }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Missing</span>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#fca5a5", margin: "4px 0 0" }}>
                {missing.length}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview Panel */}
      {previewLabel && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: 16, background: "#0f172a", borderRadius: 8, alignItems: "center" }}>
          <canvas ref={previewCanvasRef} width={320} height={400} style={{ borderRadius: 8, width: 160, height: 200 }} />
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>{previewLabel}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              {previewPlaying ? "Playing..." : "Stopped"}
            </p>
            <button
              onClick={handleStopPreview}
              className="button button-secondary"
              style={{ marginTop: 8, padding: "4px 12px", fontSize: 12 }}
            >
              Stop
            </button>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search gestures..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
        style={{ width: "100%", padding: "8px 12px", fontSize: 14, marginBottom: 16 }}
      />

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading animation assets...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
          {filtered.map((item) => (
            <div
              key={item.label}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: item.exists ? "#1e293b" : "#451a1a",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                  {item.label}
                  {!item.exists && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#fca5a5" }}>MISSING</span>
                  )}
                </p>
                {item.stats && (
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {item.stats.frames} frames · {(item.stats.duration / 1000).toFixed(1)}s · {item.stats.fps} fps
                  </p>
                )}
              </div>
              {item.exists && (
                <button
                  onClick={() => handlePreview(item.label)}
                  className="button button-secondary"
                  style={{ padding: "4px 10px", fontSize: 11 }}
                  disabled={previewLabel === item.label && previewPlaying}
                >
                  Preview
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
