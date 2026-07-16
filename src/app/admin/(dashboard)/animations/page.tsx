"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Film, Play, Search, Square } from "lucide-react";
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

interface AnimationAssetRecord {
  id: string;
  gloss: string;
  published_version: {
    id: string;
    fps: number;
    total_frames: number;
    duration_ms: number;
  } | null;
}

export default function AdminAnimationsPage() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState<{
    total: number;
    published: number;
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
        const resp = await fetch("/api/admin/animation-assets");
        if (!resp.ok) throw new Error("Failed to fetch animation assets");
        const data = await resp.json();
        const records: AnimationAssetRecord[] = data.assets ?? data ?? [];

        const assetList: AssetInfo[] = [];
        for (const record of records) {
          const label = record.gloss;
          const filename = label.replace(/\s+/g, "_");
          const asset = await loader.load(label);
          if (record.published_version) {
            assetList.push({
              label,
              filename,
              exists: true,
              stats: {
                frames: record.published_version.total_frames,
                duration: record.published_version.duration_ms,
                fps: record.published_version.fps,
              },
            });
          } else {
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
        }
        assetList.sort((a, b) => a.label.localeCompare(b.label));
        setAssets(assetList);
        const published = assetList.filter((a) => a.exists).length;
        setCoverage({ total: assetList.length, published });
      } catch (e) {
        console.error("Failed to load animation assets", e);
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

  const missing = assets.filter((a) => !a.exists);
  const filtered = assets.filter(
    (a) =>
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="admin-animation-assets">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Type-to-Sign assets</p>
          <h1>Animation assets</h1>
          <p className="admin-dashboard-subtitle">Browse published animation assets from the Animation Library. All animations are created by administrators through the Animation Studio.</p>
        </div>
      </header>

      {coverage && (
        <section className="admin-animation-metrics" aria-label="Animation coverage">
          <article><span>Total gestures</span><strong>{coverage.total}</strong></article>
          <article className={coverage.published === coverage.total ? "is-complete" : undefined}><span>Published</span><strong>{coverage.published} <small>/ {coverage.total} ({coverage.total > 0 ? ((coverage.published / coverage.total) * 100).toFixed(0) : 0}%)</small></strong></article>
          {missing.length > 0 && (
            <article className="is-missing"><span>Unpublished</span><strong>{missing.length}</strong></article>
          )}
        </section>
      )}

      {previewLabel && (
        <section className="admin-animation-preview">
          <canvas ref={previewCanvasRef} width={320} height={400} />
          <div>
            <p className="admin-overline">Preview</p>
            <h2>{previewLabel}</h2>
            <p>{previewPlaying ? "Playing animation" : "Preview stopped"}</p>
            <button onClick={handleStopPreview} className="admin-action-button" type="button"><Square size={15} aria-hidden="true" />Stop preview</button>
          </div>
        </section>
      )}

      <label className="admin-animation-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search gesture assets</span><input type="text" placeholder="Search animation assets" value={search} onChange={(event) => setSearch(event.target.value)} /></label>

      {loading ? (
        <p className="admin-animation-loading">Loading animation assets...</p>
      ) : (
        <section className="admin-animation-grid" aria-label="Animation assets">
          {filtered.map((item) => (
            <article key={item.label} className={item.exists ? undefined : "is-missing"}>
              <div>
                <p>
                  {item.label}
                  {!item.exists && (
                    <span>Unpublished</span>
                  )}
                </p>
                {item.stats && (
                  <small>
                    {item.stats.frames} frames · {(item.stats.duration / 1000).toFixed(1)}s · {item.stats.fps} fps
                  </small>
                )}
              </div>
              {item.exists && (
                <button onClick={() => handlePreview(item.label)} className="admin-action-button" type="button" disabled={previewLabel === item.label && previewPlaying}><Play size={15} aria-hidden="true" />Preview</button>
              )}
            </article>
          ))}
          {filtered.length === 0 && <p className="admin-empty-state">No animation assets match this search.</p>}
        </section>
      )}
    </div>
  );
}
