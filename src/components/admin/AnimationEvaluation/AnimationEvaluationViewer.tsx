"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { SignAnimationPlayer } from "@/features/sign-animation/player/SignAnimationPlayer";
import { AnimationLoader } from "@/features/sign-animation/loader/AnimationLoader";
import { AnimationQualityEvaluator } from "@/features/sign-animation/engine/qualityEvaluation";
import type {
  GestureAnimationAsset,
  AnimationClip,
  AnimationQualityMetrics,
  AvatarTheme,
  AnimationFrame,
} from "@/features/sign-animation/types";

const emptyMetrics: AnimationQualityMetrics = {
  gesture: "",
  smoothness: 0,
  frameCount: 0,
  missingLandmarks: 0,
  transitionQuality: 0,
  playbackDuration: 0,
  assetComplete: false,
  totalScore: 0,
};

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function frameTitle(frame: AnimationFrame, index: number): string {
  const hasPose = frame.poseLandmarks && frame.poseLandmarks.length > 0;
  const hasFace = frame.faceLandmarks && frame.faceLandmarks.length > 0;
  const handCount = frame.landmarks.length;
  return `Frame ${index + 1} — hands: ${handCount}${hasPose ? ", pose: yes" : ""}${hasFace ? ", face: yes" : ""}`;
}

export default function AnimationEvaluationViewer() {
  const [assets, setAssets] = useState<GestureAnimationAsset[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [metrics, setMetrics] = useState<AnimationQualityMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const playerRef = useRef<any>(null);
  const evaluator = useRef(new AnimationQualityEvaluator()).current;
  const loader = useRef(new AnimationLoader()).current;

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch("/animations/manifest.json");
        const manifest = await resp.json();
        const labels: string[] = manifest.assets ?? [];
        const loaded: GestureAnimationAsset[] = [];
        for (const label of labels) {
          const asset = await loader.load(label);
          if (asset) loaded.push(asset);
        }
        setAssets(loaded);
        if (loaded.length > 0) {
          setSelectedLabel(loaded[0].label);
          setMetrics(evaluator.evaluate(loaded[0]));
        }
      } catch (e) {
        console.error("Failed to load animations", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loader, evaluator]);

  const selectedAsset = assets.find((a) => a.label === selectedLabel);

  const handleSelect = useCallback(
    (label: string) => {
      setSelectedLabel(label);
      const asset = assets.find((a) => a.label === label);
      if (asset) {
        setMetrics(evaluator.evaluate(asset));
        setCurrentFrameIndex(0);
      }
    },
    [assets, evaluator],
  );

  const handleFrameStep = useCallback((delta: number) => {
    if (!selectedAsset) return;
    setCurrentFrameIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= selectedAsset.frames.length) return selectedAsset.frames.length - 1;
      return next;
    });
  }, [selectedAsset]);

  const clips: AnimationClip[] = selectedAsset
    ? [
        {
          id: selectedAsset.label,
          gesture: selectedAsset.label,
          asset: selectedAsset,
        },
      ]
    : [];

  const currentFrame = selectedAsset?.frames[currentFrameIndex] ?? null;
  const landmarkCount = currentFrame
    ? currentFrame.landmarks.reduce((s, h) => s + h.landmarks.length, 0)
    : 0;

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1400,
        margin: "0 auto",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Animation Evaluation Viewer</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Select a published animation to preview and evaluate quality metrics
      </p>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading animation assets...</p>
      ) : assets.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            borderRadius: 8,
            background: "#1e293b",
          }}
        >
          <p style={{ color: "#94a3b8" }}>
            No published animation assets found.
          </p>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Publish animations from the Animation Studio to see them here.
          </p>
        </div>
      ) : (
        <>
          {/* Asset selector */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>Animation:</label>
            <select
              value={selectedLabel}
              onChange={(e) => handleSelect(e.target.value)}
              className="input"
              style={{ flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 14 }}
            >
              {assets.map((a) => (
                <option key={a.label} value={a.label}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 360px",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* Left column: Player + scrubber */}
            <div>
              <SignAnimationPlayer
                ref={playerRef}
                clips={clips}
                width={500}
                height={500}
                speed={1}
                loop
                showControls
                theme="skeleton"
                showLabels
                showNonManual
                backgroundColor="#0f172a"
              />

              {/* Frame-by-frame scrubber */}
              {selectedAsset && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: "#1e293b",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      Frame {currentFrameIndex + 1} / {selectedAsset.frames.length}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {landmarkCount} landmarks
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, selectedAsset.frames.length - 1)}
                    value={currentFrameIndex}
                    onChange={(e) => setCurrentFrameIndex(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#3b82f6" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      marginTop: 8,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={() => handleFrameStep(-10)}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      title="-10 frames"
                    >
                      ⏪
                    </button>
                    <button
                      onClick={() => handleFrameStep(-1)}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      title="Previous frame"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => {
                        playerRef.current?.replay();
                      }}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      title="Play"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => handleFrameStep(1)}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      title="Next frame"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => handleFrameStep(10)}
                      className="button button-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      title="+10 frames"
                    >
                      ⏩
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right column: Evaluation panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Score card */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: "#1e293b",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Quality Score
                </div>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    color: scoreColor(metrics.totalScore),
                    textAlign: "center",
                    lineHeight: 1,
                  }}
                >
                  {metrics.totalScore}%
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: metrics.assetComplete ? "#14532d" : "#451a1a",
                      color: metrics.assetComplete ? "#bbf7d0" : "#fca5a5",
                    }}
                  >
                    {metrics.assetComplete ? "Complete" : "Incomplete"}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "#1e3a5f",
                      color: "#93c5fd",
                    }}
                  >
                    {metrics.frameCount} frames
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "#3b2f1a",
                      color: "#fde68a",
                    }}
                  >
                    {(metrics.playbackDuration / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Metric gauges */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: "#1e293b",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Metrics
                </div>

                <MetricBar
                  label="Smoothness"
                  value={metrics.smoothness}
                  color={scoreColor(metrics.smoothness)}
                />
                <MetricBar
                  label="Transition Quality"
                  value={metrics.transitionQuality}
                  color={scoreColor(metrics.transitionQuality)}
                />
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Missing Landmarks</span>
                    <span
                      style={{
                        color: metrics.missingLandmarks > 0 ? "#fca5a5" : "#bbf7d0",
                        fontWeight: 600,
                      }}
                    >
                      {metrics.missingLandmarks}
                    </span>
                  </div>
                </div>
              </div>

              {/* Frame details */}
              {currentFrame && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: "#1e293b",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      fontWeight: 500,
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Frame Details
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>
                    <strong>Frame:</strong> {currentFrameIndex + 1} / {selectedAsset!.frames.length}
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>
                    <strong>Timestamp:</strong> {(currentFrame.timestamp / 1000).toFixed(3)}s
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>
                    <strong>Hands:</strong> {currentFrame.landmarks.length}
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>
                    <strong>Total landmarks:</strong> {landmarkCount}
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                    <strong>Pose:</strong>{" "}
                    {currentFrame.poseLandmarks
                      ? `${currentFrame.poseLandmarks.length} points`
                      : "none"}
                    <span style={{ marginLeft: 12 }}>
                      <strong>Face:</strong>{" "}
                      {currentFrame.faceLandmarks
                        ? `${currentFrame.faceLandmarks.length} points`
                        : "none"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div
        style={{
          height: 6,
          background: "#0f172a",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, value)}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
