"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Send,
  Save,
  Archive,
  CheckCircle2,
  FileJson,
  Clock,
  Layers,
  BarChart3,
  Tag,
  Globe,
  BookOpen,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import type { ExtractionResult, PublishData, PublishStatus } from "./types";
import { animationLibrary } from "@/lib/animationLibrary";
import type { AnimationValidationResult } from "@/lib/animationLibrary";
import { validateAsset, analyzeQuality, generateMetadata } from "@/features/ai-assist";
import type { ValidationResult, AnimationMetadata, QualityAnalysis } from "@/features/ai-assist";

interface PublishTabProps {
  extractionResult: ExtractionResult;
  onPublish: (data: PublishData) => void;
}

const CATEGORIES = [
  "Greeting", "Question", "Family", "Color", "Number",
  "Day", "Month", "Food", "Emotion", "Action",
  "Object", "Place", "Time", "Person", "Animal", "Other",
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const LANGUAGES = ["FSL", "ASL", "LSF"];

export function PublishTab({ extractionResult, onPublish }: PublishTabProps) {
  const { asset, metadata } = extractionResult;
  const [gloss, setGloss] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("FSL");
  const [difficulty, setDifficulty] = useState("beginner");
  const [keywordsStr, setKeywordsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<AnimationValidationResult | null>(null);
  const [aiValidation, setAiValidation] = useState<ValidationResult | null>(null);
  const [aiMeta, setAiMeta] = useState<AnimationMetadata | null>(null);
  const [aiQuality, setAiQuality] = useState<QualityAnalysis | null>(null);

  const qualityScore = useMemo(() => {
    const totalLm = asset.frames.reduce((sum, f) => {
      let c = 0;
      if (f.poseLandmarks) c += f.poseLandmarks.length;
      if (f.faceLandmarks) c += f.faceLandmarks.length;
      c += f.landmarks.reduce((s, h) => s + h.landmarks.length, 0);
      return sum + c;
    }, 0);
    const avgLm = asset.frames.length > 0 ? totalLm / asset.frames.length : 0;
    if (avgLm > 100) return 95;
    if (avgLm > 70) return 80;
    if (avgLm > 40) return 60;
    return 40;
  }, [asset]);

  const handleValidate = useCallback(() => {
    const basic = animationLibrary.validate(asset);
    setValidation(basic);

    const ai = validateAsset(asset);
    setAiValidation(ai);
    setAiMeta(ai.metadata);
    setAiQuality(ai.qualityAnalysis);

    if (basic.valid && ai.verdict !== "fail") {
      setError("");
    } else if (ai.verdict === "fail") {
      setError("AI validation failed. Review quality issues below.");
    } else {
      setError("Validation failed. See errors below.");
    }
  }, [asset]);

  const handlePublish = useCallback(async (action: PublishStatus) => {
    const trimmedGloss = gloss.trim().toUpperCase();
    if (!trimmedGloss) {
      setError("Gloss label is required");
      return;
    }

    const vResult = animationLibrary.validate(asset);
    setValidation(vResult);
    if (!vResult.valid && action !== "draft") {
      setError("Cannot publish: animation failed validation. Review errors below.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      asset.label = trimmedGloss;

      const { assetId, versionId } = await animationLibrary.upload(
        metadata.sourceFps > 0
          ? new File([""], "placeholder", { type: "video/mp4" })
          : extractionResult.frames.length > 0
            ? new File([""], "placeholder", { type: "video/mp4" })
            : new File([""], "placeholder", { type: "video/mp4" }),
        trimmedGloss,
      );

      await animationLibrary.performAction(versionId, "complete-processing", {
        asset: asset as unknown as Record<string, unknown>,
        qualityScore,
      });

      if (action === "published") {
        await animationLibrary.performAction(versionId, "approve", { notes });
        await animationLibrary.performAction(versionId, "publish");

        const jsonData = JSON.stringify(asset, null, 2);
        const blob = new Blob([jsonData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${trimmedGloss}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (action === "archived") {
        await animationLibrary.performAction(versionId, "archive");
      }

      const keywords = keywordsStr.split(",").map((k) => k.trim()).filter(Boolean);
      onPublish({
        gloss: trimmedGloss, category, language, difficulty, keywords, notes, status: action,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSubmitting(false);
    }
  }, [gloss, category, language, difficulty, keywordsStr, notes, asset, metadata, qualityScore, extractionResult, onPublish]);

  const formatMs = (ms: number): string => {
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <style>{`
          .publish-success svg { width: 56px; height: 56px; color: #4ade80; }
          .publish-success h2 { color: #e2e8f0; font-size: 22px; margin: 16px 0 8px; }
          .publish-success p { color: #64748b; font-size: 14px; }
        `}</style>
        <div className="publish-success">
          <CheckCircle2 />
          <h2>Animation Published</h2>
          <p>{gloss.toUpperCase()} has been registered in the Animation Library.</p>
          <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            JSON file has been downloaded. The asset is now available for Type-to-Sign playback.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .publish-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) { .publish-grid { grid-template-columns: 1fr; } }
        .publish-section { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 20px; }
        .publish-section h3 { font-size: 15px; font-weight: 600; color: #e2e8f0; margin: 0 0 16px; display: flex; align-items: center; gap: 8px; }
        .publish-section h3 svg { width: 18px; height: 18px; color: #60a5fa; }
        .form-group { margin-bottom: 14px; }
        .form-group label { display: block; font-size: 12px; font-weight: 500; color: #94a3b8; margin-bottom: 4px; }
        .form-group input, .form-group select, .form-group textarea {
          width: 100%; padding: 8px 12px; border: 1px solid #334155; border-radius: 6px;
          font-size: 13px; background: #1e293b; color: #e2e8f0; outline: none;
          transition: border-color 0.15s; box-sizing: border-box;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #60a5fa; }
        .form-group textarea { min-height: 60px; resize: vertical; font-family: inherit; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .stat-card { background: #1e293b; border-radius: 8px; padding: 12px; text-align: center; }
        .stat-card .stat-value { font-size: 20px; font-weight: 700; color: #e2e8f0; }
        .stat-card .stat-label { font-size: 11px; color: #64748b; margin-top: 2px; }
        .quality-bar { height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden; margin-top: 8px; }
        .quality-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .action-buttons { display: flex; gap: 10px; margin-top: 24px; grid-column: 1 / -1; justify-content: center; }
        .btn-publish { display: flex; align-items: center; gap: 8px; padding: 12px 28px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-publish:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-publish svg { width: 18px; height: 18px; }
        .btn-publish.primary { background: #2563eb; color: #fff; }
        .btn-publish.primary:hover:not(:disabled) { background: #1d4ed8; }
        .btn-publish.secondary { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
        .btn-publish.secondary:hover:not(:disabled) { background: #334155; }
        .btn-publish.danger { background: #1e293b; color: #f87171; border: 1px solid #7f1d1d; }
        .btn-publish.danger:hover:not(:disabled) { background: #2d1a1a; }
        .btn-check { background: #1e293b; color: #60a5fa; border: 1px solid #1e3a5f; }
        .btn-check:hover:not(:disabled) { background: #1e3a5f; }
        .error-box, .validation-box {
          padding: 10px 14px; border-radius: 8px; font-size: 13px;
          grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 8px;
        }
        .error-box { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5; }
        .validation-box.valid { background: rgba(22,163,74,0.1); border: 1px solid rgba(22,163,74,0.3); color: #86efac; }
        .validation-box.invalid { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3); color: #fca5a5; }
        .validation-box svg { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
        .validation-details { margin-top: 8px; }
        .validation-details li { font-size: 12px; margin-bottom: 3px; }
        .validation-details .warn { color: #fde68a; }
        .validation-details .err { color: #fca5a5; }
      `}</style>

      <div className="publish-grid">
        <div className="publish-section">
          <h3><Tag /> Metadata</h3>

          <div className="form-group">
            <label>Gloss Label *</label>
            <input type="text" placeholder="e.g., HOW_ARE_YOU" value={gloss} onChange={(e) => setGloss(e.target.value.toUpperCase())} />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label><Globe size={14} /> Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label><BookOpen size={14} /> Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Keywords (comma-separated)</label>
            <input type="text" placeholder="hello, greeting, wave" value={keywordsStr} onChange={(e) => setKeywordsStr(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea placeholder="Any notes about this animation..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn-publish btn-check" onClick={handleValidate} disabled={submitting}>
              <CheckCircle2 size={16} /> Validate Animation
            </button>
          </div>
        </div>

        <div className="publish-section">
          <h3><BarChart3 /> Animation Stats</h3>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{(asset.duration / 1000).toFixed(1)}s</div>
              <div className="stat-label"><Clock size={12} /> Duration</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{asset.totalFrames}</div>
              <div className="stat-label"><Layers size={12} /> Frame Count</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{asset.fps}</div>
              <div className="stat-label">FPS</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{aiMeta ? `${aiMeta.motionSmoothness}%` : `${qualityScore}%`}</div>
              <div className="stat-label"><BarChart3 size={12} /> Smoothness</div>
            </div>
          </div>

          {aiMeta && (
            <div style={{ marginTop: 12 }}>
              <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: 13, color: aiMeta.handVisibility > 50 ? "#4ade80" : "#f87171" }}>
                    {aiMeta.handVisibility}%
                  </div>
                  <div className="stat-label">Hand Visibility</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: 13 }}>
                    {aiMeta.dominantHand}
                  </div>
                  <div className="stat-label">Dominant Hand</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: 13, textTransform: "capitalize", color: aiMeta.estimatedDifficulty === "advanced" ? "#f87171" : aiMeta.estimatedDifficulty === "intermediate" ? "#fde68a" : "#4ade80" }}>
                    {aiMeta.estimatedDifficulty}
                  </div>
                  <div className="stat-label">Difficulty</div>
                </div>
              </div>

              <div className="quality-bar" style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                  <span>Landmark completeness</span>
                  <span>{aiMeta.landmarkCompleteness}%</span>
                </div>
                <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${aiMeta.landmarkCompleteness}%`, background: aiMeta.landmarkCompleteness > 70 ? "#16a34a" : aiMeta.landmarkCompleteness > 40 ? "#eab308" : "#dc2626", borderRadius: 2 }} />
                </div>
              </div>
              <div className="quality-bar" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                  <span>Movement score</span>
                  <span>{aiMeta.movementScore}%</span>
                </div>
                <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(1, aiMeta.movementScore / 100 * 100)}%`, background: aiMeta.movementScore > 50 ? "#16a34a" : aiMeta.movementScore > 20 ? "#eab308" : "#dc2626", borderRadius: 2 }} />
                </div>
              </div>
            </div>
          )}

          {aiValidation && (
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, fontSize: 12,
              background: aiValidation.verdict === "pass" ? "rgba(22,163,74,0.1)" : aiValidation.verdict === "warn" ? "rgba(234,179,8,0.1)" : "rgba(220,38,38,0.1)",
              border: `1px solid ${aiValidation.verdict === "pass" ? "rgba(22,163,74,0.3)" : aiValidation.verdict === "warn" ? "rgba(234,179,8,0.3)" : "rgba(220,38,38,0.3)"}`,
              color: aiValidation.verdict === "pass" ? "#86efac" : aiValidation.verdict === "warn" ? "#fde68a" : "#fca5a5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                {aiValidation.verdict === "pass" ? <CheckCircle2 size={14} /> : aiValidation.verdict === "warn" ? <AlertTriangle size={14} /> : <XCircle size={14} />}
                {aiValidation.verdict.toUpperCase()} — {aiValidation.summary}
                <span style={{ marginLeft: "auto" }}>{aiValidation.score}/100</span>
              </div>
            </div>
          )}

          {aiQuality && aiQuality.issues.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {aiQuality.issues.slice(0, 4).map((issue, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 0",
                  fontSize: 11, color: issue.severity === "error" ? "#fca5a5" : issue.severity === "warning" ? "#fde68a" : "#94a3b8",
                }}>
                  {issue.severity === "error" ? <XCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} /> :
                   issue.severity === "warning" ? <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} /> :
                   <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />}
                  <span>{issue.message}</span>
                </div>
              ))}
              {aiQuality.issues.length > 4 && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>+{aiQuality.issues.length - 4} more issues</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <FileJson size={16} color="#60a5fa" />
              <span style={{ fontSize: 13, color: "#94a3b8" }}>{gloss || "UNTITLED"}.json</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
              <div>Frames: {asset.frames.length}</div>
              <div>Source FPS: {metadata.sourceFps}</div>
              <div>Processing: {(metadata.processingTime / 1000).toFixed(1)}s</div>
              <div>Has pose: {asset.frames.some((f) => (f.poseLandmarks?.length ?? 0) > 0) ? "Yes" : "No"}</div>
              <div>Has face: {asset.frames.some((f) => (f.faceLandmarks?.length ?? 0) > 0) ? "Yes" : "No"}</div>
              <div>Has hands: {asset.frames.some((f) => f.landmarks.length > 0) ? "Yes" : "No"}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: "#1e293b", borderRadius: 8 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              Publishing registers this asset in the Animation Library with full versioning.
              The Type-to-Sign system will automatically use the published version.
              Raw video remains private. Only landmark JSON is used publicly.
            </span>
          </div>
        </div>

        {validation && (
          <div className={`validation-box ${validation.valid ? "valid" : "invalid"}`}>
            {validation.valid ? <CheckCircle2 /> : <XCircle />}
            <div>
              <strong>{validation.valid ? "Validation passed" : "Validation failed"}</strong>
              {!validation.valid && (
                <ul className="validation-details">
                  {validation.errors.map((e, i) => <li key={i} className="err">✗ {e}</li>)}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <ul className="validation-details">
                  {validation.warnings.map((w, i) => <li key={i} className="warn">⚠ {w}</li>)}
                </ul>
              )}
              <div style={{ fontSize: 11, marginTop: 6, color: "#64748b" }}>
                {validation.metrics.frameCount} frames · {validation.metrics.hasHandLandmarks ? "Hands ✓" : "Hands ✗"}
                {validation.metrics.hasPoseLandmarks ? " · Pose ✓" : " · Pose ✗"}
                {validation.metrics.hasFaceLandmarks ? " · Face ✓" : " · Face ✗"}
              </div>
            </div>
          </div>
        )}

        {error && !validation && (
          <div className="error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="action-buttons">
          <button
            className="btn-publish secondary"
            onClick={() => handlePublish("draft")}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            {submitting ? "Saving..." : "Save Draft"}
          </button>
          <button
            className="btn-publish primary"
            onClick={() => handlePublish("published")}
            disabled={submitting || !gloss.trim()}
          >
            {submitting ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            {submitting ? "Publishing..." : "Publish & Register"}
          </button>
          <button
            className="btn-publish danger"
            onClick={() => handlePublish("archived")}
            disabled={submitting}
          >
            <Archive size={16} /> Archive
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`}</style>
      </div>
    </div>
  );
}
