"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Tag,
} from "lucide-react";
import type { VideoMetadata, ExtractionResult } from "./types";
import type {
  AnimationFrame,
} from "@/features/sign-animation/types";
import { extractLandmarksFromVideo, type ExtractionProgress as HolisticProgress } from "@/features/sign-animation/extraction";
import { processExtractedFrames } from "@/features/sign-animation/processing/landmarkProcessor";
import { LandmarkCanvasRenderer } from "@/features/sign-animation/renderer/LandmarkCanvasRenderer";
import { suggestGloss, type GlossSuggestionResult } from "@/features/ai-assist";

interface PoseExtractionTabProps {
  videoMeta: VideoMetadata;
  onExtractionComplete: (result: ExtractionResult) => void;
}

const STEPS = [
  { key: "reading", label: "Reading video..." },
  { key: "extracting", label: "Extracting landmarks (pose, face, hands)..." },
  { key: "normalizing", label: "Normalizing landmarks..." },
  { key: "generating", label: "Generating animation asset..." },
] as const;

export function PoseExtractionTab({ videoMeta, onExtractionComplete }: PoseExtractionTabProps) {
  const [glossSuggestion, setGlossSuggestion] = useState<GlossSuggestionResult | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [progress, setProgress] = useState({ status: "idle" as string, currentFrame: 0, totalFrames: 0, progressPercent: 0, message: "" });
  const [error, setError] = useState("");
  const [liveFrame, setLiveFrame] = useState<AnimationFrame | null>(null);
  const [showSplit, setShowSplit] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LandmarkCanvasRenderer | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!skeletonCanvasRef.current) return;
    rendererRef.current = new LandmarkCanvasRenderer(skeletonCanvasRef.current, {
      width: 400, height: 400, showLabels: true, backgroundColor: "#0f172a",
    });
    return () => { rendererRef.current = null; };
  }, []);

  useEffect(() => {
    if (liveFrame && rendererRef.current) {
      rendererRef.current.render(liveFrame);
    }
  }, [liveFrame]);

  const startExtraction = useCallback(async () => {
    setError("");
    setShowSplit(true);
    startTimeRef.current = Date.now();
    const vid = videoRef.current;
    if (!vid) return;

    vid.src = videoMeta.url;
    vid.load();

    try {
      await vid.play();
      vid.pause();

      const rawSequence = await extractLandmarksFromVideo(
        vid,
        {},
        (p: HolisticProgress) => {
          setProgress({
            status: "extracting",
            currentFrame: p.currentFrame,
            totalFrames: p.totalFrames,
            progressPercent: Math.round((p.currentFrame / p.totalFrames) * 100),
            message: `Extracting landmarks... (${p.currentFrame}/${p.totalFrames} frames)`,
          });
          if (p.frame) setLiveFrame(p.frame);
        },
      );

      setProgress((prev) => ({ ...prev, status: "normalizing", message: "Normalizing landmark data..." }));
      await new Promise((r) => setTimeout(r, 100));

      setProgress((prev) => ({ ...prev, status: "generating", message: "Generating animation asset..." }));

      const processed = processExtractedFrames(rawSequence.frames, Math.round(rawSequence.sourceFps), {
        targetFps: 30, label: "UNTITLED", smoothMotion: true, repairMissing: true, source: "animation-studio-extraction",
      });

      const processingTime = Date.now() - startTimeRef.current;

      setProgress({
        status: "complete", currentFrame: processed.asset.frames.length, totalFrames: processed.asset.frames.length,
        progressPercent: 100,
        message: `Complete — ${processed.asset.frames.length} frames extracted in ${(processingTime / 1000).toFixed(1)}s (OneEuro smoothing applied)`,
      });

      onExtractionComplete({
        asset: processed.asset, frames: processed.frames,
        metadata: { sourceFps: rawSequence.sourceFps, extractedFrames: rawSequence.frames.length, processingTime },
      });

      setSuggesting(true);
      suggestGloss(processed.asset).then((result) => { setGlossSuggestion(result); setSuggesting(false); });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      const details = err instanceof Error ? err.stack : "";
      setError(`${msg}${details ? `\n${details}` : ""}`);
      setProgress((prev) => ({ ...prev, status: "error", message: msg }));
    }
  }, [videoMeta, onExtractionComplete]);

  const isRunning = progress.status !== "idle" && progress.status !== "complete" && progress.status !== "error";

  return (
    <div style={{ color: "#e2e8f0" }}>
      <style>{`
        .pext-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .pext-split { grid-template-columns: 1fr; }
        }
        .pext-panel {
          border-radius: 10px;
          overflow: hidden;
          background: #000;
        }
        .pext-panel-label {
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: #1e293b;
          color: #94a3b8;
        }
        .pext-panel video {
          width: 100%;
          display: block;
        }
        .pext-panel canvas {
          width: 100%;
          display: block;
        }
        .pext-steps {
          max-width: 480px;
          margin: 0 auto;
        }
        .pext-step-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 20px;
          background: #0f172a;
          border-radius: 10px;
          border: 1px solid #1e293b;
        }
        .pext-step {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: #64748b;
          transition: all 0.2s;
        }
        .pext-step.active { color: #60a5fa; background: rgba(96,165,250,0.08); }
        .pext-step.done { color: #4ade80; }
        .pext-step.error { color: #f87171; background: rgba(248,113,113,0.08); }
        .pext-step svg { width: 18px; height: 18px; flex-shrink: 0; }
        .pext-bar { height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden; margin: 12px 0; }
        .pext-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #60a5fa); border-radius: 2px; transition: width 0.3s ease; }
        .pext-fps { text-align: center; font-size: 12px; color: #64748b; margin-top: 8px; }
        .pext-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: center; }
        .pext-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border: 1px solid #334155;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          background: #1e293b;
          color: #e2e8f0;
          transition: all 0.15s;
        }
        .pext-btn:hover:not(:disabled) { background: #334155; }
        .pext-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pext-btn-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
        .pext-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .pext-btn svg { width: 18px; height: 18px; }
        .pext-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(220,38,38,0.1);
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 13px;
          margin-top: 12px;
        }
        .pext-complete {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          background: rgba(22,163,74,0.1);
          border: 1px solid rgba(22,163,74,0.3);
          border-radius: 10px;
          color: #86efac;
          font-size: 14px;
          margin-top: 16px;
        }
        .pext-complete svg { width: 22px; height: 22px; flex-shrink: 0; }
        .pext-gloss {
          margin-top: 16px;
          padding: 16px;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 10px;
        }
        .pext-gloss-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #60a5fa;
          margin-bottom: 12px;
        }
        .pext-gloss-main {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pext-gloss-label { font-size: 12px; color: #64748b; }
        .pext-gloss-value { font-size: 20px; font-weight: 700; color: #e2e8f0; font-family: monospace; letter-spacing: 1px; }
        .pext-gloss-conf { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #1e293b; color: #4ade80; }
        .pext-gloss-alts {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .pext-gloss-alt {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          background: #1e293b;
          color: #94a3b8;
          border: 1px solid #334155;
          font-family: monospace;
        }
        .pext-gloss-alt small { color: #64748b; }
        .pext-gloss-err {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #fca5a5;
        }
        @keyframes pext-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Split view during extraction and after */}
      {showSplit && (
        <div className="pext-split">
          <div className="pext-panel">
            <div className="pext-panel-label">Original Video</div>
            <video ref={videoRef} src={videoMeta.url} controls preload="auto" />
          </div>
          <div className="pext-panel">
            <div className="pext-panel-label">
              Extracted Skeleton
              {isRunning && <span style={{ marginLeft: 8, color: "#60a5fa" }}>— live</span>}
            </div>
            <canvas ref={skeletonCanvasRef} width={400} height={400} style={{ width: "100%", height: "auto", aspectRatio: "1/1" }} />
          </div>
        </div>
      )}

      {/* Video preview when not yet started */}
      {!showSplit && (
        <div style={{ marginBottom: 20 }}>
          <video ref={videoRef} src={videoMeta.url} controls preload="auto" style={{ width: "100%", maxHeight: 320, borderRadius: 10, background: "#000" }} />
        </div>
      )}

      {/* Progress steps */}
      {(progress.status !== "complete" || error) && (
        <div className="pext-steps">
          <div className="pext-step-list">
            {STEPS.map((step) => {
              const order = STEPS.findIndex((s) => s.key === step.key);
              const currentOrder = STEPS.findIndex((s) => s.key === progress.status);
              let cls = "pext-step";
              if (order < currentOrder) cls += " done";
              else if (order === currentOrder) cls += " active";
              if (progress.status === "error") cls += " error";

              let icon = <Loader2 style={{ animation: order === currentOrder ? "pext-spin 1s linear infinite" : "none" }} />;
              if (order < currentOrder) icon = <CheckCircle2 />;
              if (progress.status === "error" && order === currentOrder) icon = <AlertCircle />;

              return (
                <div key={step.key} className={cls}>
                  {icon}
                  <span>{step.label}</span>
                  {order === currentOrder && progress.status === "extracting" && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                      {progress.currentFrame}/{progress.totalFrames}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {isRunning && (
            <div className="pext-bar">
              <div className="pext-fill" style={{ width: `${progress.progressPercent}%` }} />
            </div>
          )}

          {isRunning && (
            <div className="pext-fps">Processing... {progress.message}</div>
          )}

          {error && (
            <div className="pext-error">
              <AlertCircle />
              <span style={{ whiteSpace: "pre-wrap" }}>{error}</span>
            </div>
          )}

          <div className="pext-actions">
            <button
              className="pext-btn pext-btn-primary"
              onClick={startExtraction}
              disabled={isRunning}
              style={{ minWidth: 200, justifyContent: "center" }}
            >
              {isRunning ? (
                <><Loader2 style={{ animation: "pext-spin 1s linear infinite" }} /> Extracting...</>
              ) : (
                <><Play /> Start Extraction</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Complete */}
      {progress.status === "complete" && !error && (
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="pext-complete">
            <CheckCircle2 />
            <div>
              <strong>Extraction complete!</strong>
              <div style={{ fontSize: 12, marginTop: 2, color: "#6ee7b7" }}>{progress.message}</div>
            </div>
          </div>

          <div className="pext-gloss">
            <div className="pext-gloss-header">
              <Tag size={15} />
              <span>AI Gloss Suggestion</span>
              {suggesting && <Loader2 size={14} style={{ animation: "pext-spin 1s linear infinite" }} />}
            </div>
            {glossSuggestion && !suggesting && (
              <>
                {glossSuggestion.error ? (
                  <div className="pext-gloss-err">
                    <AlertCircle size={14} />
                    <span>{glossSuggestion.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="pext-gloss-main">
                      <span className="pext-gloss-label">Suggested gloss:</span>
                      <span className="pext-gloss-value">{glossSuggestion.suggested.gloss}</span>
                      <span className="pext-gloss-conf">
                        {Math.round(glossSuggestion.suggested.confidence * 100)}% confidence
                      </span>
                    </div>
                    {glossSuggestion.alternatives.length > 0 && (
                      <div className="pext-gloss-alts">
                        <span className="pext-gloss-label">Alternatives:</span>
                        {glossSuggestion.alternatives.slice(0, 3).map((alt, i) => (
                          <span key={i} className="pext-gloss-alt">
                            {alt.gloss} <small>{Math.round(alt.confidence * 100)}%</small>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
