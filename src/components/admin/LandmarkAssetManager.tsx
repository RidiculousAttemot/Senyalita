"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, PlayCircle, Send, ShieldCheck } from "lucide-react";
import { createGestureAnimationAsset, scoreAnimationQuality } from "@/features/sign-animation/processing";
import { extractLandmarksFromVideo } from "@/features/sign-animation/extraction";
import type { AnimationAssetWorkspaceRow } from "@/lib/supabase/queries/animationAssets";

export function LandmarkAssetManager({ initialAssets }: { initialAssets: AnimationAssetWorkspaceRow[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [gloss, setGloss] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readyCount = assets.flatMap((asset) => asset.versions).filter((version) => version.status === "ready").length;
  const publishedCount = assets.flatMap((asset) => asset.versions).filter((version) => version.status === "published").length;

  const uploadAndExtract = async () => {
    if (!file || !gloss.trim()) return;
    setMessage(null);
    setProgress(0);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("gloss", gloss.trim());
      const upload = await fetch("/api/admin/animation-assets/upload", { method: "POST", body });
      const created = await upload.json();
      if (!upload.ok) throw new Error(created.error ?? "Unable to create animation version.");
      const sourceUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      let extracted;
      try {
        video.src = sourceUrl;
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("The source video could not be loaded.")); });
        extracted = await extractLandmarksFromVideo(video, {}, ({ progress: nextProgress }) => setProgress(nextProgress * 100));
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
      const asset = createGestureAnimationAsset({ label: gloss.trim().toUpperCase(), frames: extracted.frames, fps: extracted.sourceFps });
      const completed = await fetch(`/api/admin/animation-assets/${created.versionId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete-processing", asset, qualityScore: scoreAnimationQuality(asset).totalScore }) });
      const result = await completed.json();
      if (!completed.ok) throw new Error(result.error ?? "Unable to save extracted landmarks.");
      setMessage("Landmark animation is ready for review.");
      setGloss(""); setFile(null); if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Extraction failed.");
    } finally { setProgress(null); }
  };

  const transition = async (versionId: string, action: "approve" | "publish" | "archive") => {
    const response = await fetch(`/api/admin/animation-assets/${versionId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json();
    setMessage(response.ok ? `Animation ${result.status}.` : result.error ?? "Unable to update animation.");
    if (response.ok) setAssets((current) => current.map((asset) => ({ ...asset, versions: asset.versions.map((version) => version.id === versionId ? { ...version, status: result.status } : version) })));
  };

  return <div className="admin-dashboard">
    <header className="admin-dashboard-header"><div><p className="admin-overline">Private video to public landmark animation</p><h1>Landmark assets</h1><p className="admin-dashboard-subtitle">Upload an admin-only reference video, extract MediaPipe landmarks locally, then approve and publish the generated animation JSON.</p></div></header>
    <section className="admin-metric-grid"><Metric label="Gesture assets" value={String(assets.length)} note="Canonical gloss records" /><Metric label="Ready review" value={String(readyCount)} note="Awaiting approval" /><Metric label="Published" value={String(publishedCount)} note="Available to Type-to-Sign" /><Metric label="Privacy" value="Private" note="Source videos never leave admin access" /></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-overline">New asset</p><h2>Upload and extract</h2></div><FileUp size={18} aria-hidden="true" /></div><div className="admin-capture-facts"><label><span><strong>Canonical gloss</strong><input value={gloss} onChange={(event) => setGloss(event.target.value)} placeholder="HELLO" /></span></label><label><span><strong>Source video</strong><input ref={fileInput} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></span></label><button className="admin-action-button admin-action-button-primary" type="button" disabled={!file || !gloss.trim() || progress !== null} onClick={uploadAndExtract}>{progress === null ? <PlayCircle size={16} /> : <Loader2 size={16} className="animate-spin" />}{progress === null ? "Extract landmarks" : `${Math.round(progress)}% extracting`}</button></div>{message && <p className="admin-panel-note">{message}</p>}</section>
    <section className="admin-panel admin-model-table-panel"><div className="admin-panel-heading"><div><p className="admin-overline">Version lifecycle</p><h2>Review queue</h2></div></div>{assets.length === 0 ? <p className="admin-empty-state">No landmark assets yet. Upload a private reference video to create the first version.</p> : <div className="admin-table-scroll"><table className="admin-model-table"><thead><tr><th>Gloss</th><th>Version</th><th>Status</th><th>Quality</th><th>Actions</th></tr></thead><tbody>{assets.flatMap((asset) => asset.versions.map((version) => <tr key={version.id}><td><code>{asset.gloss}</code></td><td>v{version.version}</td><td><span className="admin-status"><span className="admin-status-dot" />{version.status}</span></td><td>{version.quality_score ?? "-"}</td><td>{version.status === "ready" && <button className="admin-action-button" onClick={() => transition(version.id, "approve")}><ShieldCheck size={14} />Approve</button>}{version.status === "approved" && <button className="admin-action-button admin-action-button-primary" onClick={() => transition(version.id, "publish")}><Send size={14} />Publish</button>}{version.status === "published" && <span className="admin-status admin-status-healthy"><span className="admin-status-dot" />Live</span>}</td></tr>))}</tbody></table></div>}</section>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="admin-metric-card"><p className="admin-metric-label">{label}</p><strong className="admin-metric-value">{value}</strong><p className="admin-metric-note">{note}</p></article>; }