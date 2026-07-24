"use client";

import { Play, Pause, SkipForward, SkipBack } from "lucide-react";
import type { AnimationClip, AnimationPlan, PlaybackState, AnimationInspectorData, PlaybackPlan } from "../types";

interface PlaybackTimelineProps {
  clips: AnimationClip[];
  playState: PlaybackState;
  plan?: AnimationPlan | null;
  playbackPlan?: PlaybackPlan | null;
  inspectorData?: AnimationInspectorData[];
  onSeek?: (time: number) => void;
}

const STRATEGY_COLORS: Record<string, string> = {
  exact_phrase: "#4ade80",
  phrase_alias: "#22d3ee",
  exact_gloss: "#4ade80",
  gloss_alias: "#22d3ee",
  synonym: "#fbbf24",
  morphological: "#a78bfa",
  category_mapping: "#f472b6",
  fingerspell: "#fb923c",
  unknown_placeholder: "#ef4444",
};

export function PlaybackTimeline({ clips, playState, plan, playbackPlan, inspectorData, onSeek }: PlaybackTimelineProps) {
  const totalDuration = clips.reduce((sum, c) => sum + c.asset.duration, 0);
  const progress = totalDuration > 0 ? (playState.currentTime / totalDuration) * 100 : 0;

  return (
    <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b", padding: 14, color: "#e2e8f0" }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Playback Timeline
        {playbackPlan && (
          <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8, fontWeight: 400, textTransform: "none" }}>
            ({playbackPlan.metadata.phraseCount}p / {playbackPlan.metadata.glossCount}g / {playbackPlan.metadata.fingerspellCount}f)
          </span>
        )}
      </h3>

      {/* Timeline bar */}
      <div style={{ position: "relative", height: 40, marginBottom: 12, background: "#1e293b", borderRadius: 6, overflow: "hidden" }}>
        {clips.map((clip, i) => {
          const start = clips.slice(0, i).reduce((sum, c) => sum + c.asset.duration, 0);
          const width = totalDuration > 0 ? (clip.asset.duration / totalDuration) * 100 : 0;
          const isActive = i === playState.currentIndex;
          const strategy = inspectorData?.[i]?.strategy;
          const borderColor = strategy ? STRATEGY_COLORS[strategy] ?? "#334155" : "#334155";
          return (
            <div
              key={clip.id}
              onClick={() => onSeek?.(start)}
              style={{
                position: "absolute",
                left: `${(start / totalDuration) * 100}%`,
                width: `${width}%`,
                height: "100%",
                background: isActive ? "rgba(96,165,250,0.25)" : "rgba(30,41,59,0.8)",
                borderRight: "1px solid #334155",
                borderBottom: strategy ? `2px solid ${borderColor}` : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                transition: "background 0.2s",
              }}
              title={`${clip.gesture} (${(clip.asset.duration / 1000).toFixed(1)}s) [${strategy ?? "?"}]`}
            >
              <span style={{ fontSize: 9, color: isActive ? "#60a5fa" : "#64748b", fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap", padding: "0 2px" }}>
                {clip.gesture}
              </span>
            </div>
          );
        })}

        {/* Playback cursor */}
        <div style={{
          position: "absolute",
          left: `${progress}%`,
          top: 0,
          width: 3,
          height: "100%",
          background: "#60a5fa",
          borderRadius: 1,
          transition: "left 0.05s linear",
          zIndex: 2,
          pointerEvents: "none",
        }} />
      </div>

      {/* Frame info */}
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#94a3b8", marginBottom: 8, flexWrap: "wrap" }}>
        <span>Time: {(playState.currentTime).toFixed(1)}s / {(totalDuration / 1000).toFixed(1)}s</span>
        <span>Clip: {playState.currentIndex + 1}/{clips.length}</span>
        <span>Gesture: {playState.currentGesture ?? "\u2014"}</span>
        <span>Speed: {playState.speed}\u00d7</span>
        {playbackPlan && (
          <>
            <span style={{ color: "#4ade80" }}>Phrases: {playbackPlan.metadata.phraseCount}</span>
            <span style={{ color: "#fbbf24" }}>Fallbacks: {playbackPlan.metadata.fallbackCount}</span>
            <span style={{ color: "#fb923c" }}>Fingerspell: {playbackPlan.metadata.fingerspellCount}</span>
          </>
        )}
      </div>

      {/* Inspector data for current clip */}
      {inspectorData && inspectorData.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 4 }}>
          {(() => {
            const current = inspectorData[playState.currentIndex];
            if (!current) return null;
            const items = [
              { label: "Strategy", value: current.strategy, color: STRATEGY_COLORS[current.strategy] ?? "#94a3b8" },
              { label: "Duration", value: `${(current.assetDuration / 1000).toFixed(1)}s` },
              { label: "Frames", value: current.frameCount.toString() },
              { label: "FPS", value: current.fps.toString() },
              { label: "Expression", value: current.expression },
              { label: "Speed", value: `${current.timingSpeed}\u00d7` },
              { label: "Confidence", value: `${Math.round(current.confidence * 100)}%` },
              { label: "Coarticulation", value: current.coarticulationScore > 0 ? "Active" : "Inactive" },
              { label: "Cache", value: current.cacheHit ? "Hit" : "Miss" },
            ];
            return items.map((item) => (
              <div key={item.label} style={{ background: "#1e293b", borderRadius: 4, padding: "4px 8px" }}>
                <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: item.color ?? "#e2e8f0" }}>{item.value}</div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Resolution chain */}
      {playbackPlan && playbackPlan.metadata.resolutionChain.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Chain:</span>
          {playbackPlan.metadata.resolutionChain.map((step, i) => (
            <span key={i} style={{
              padding: "1px 6px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "monospace",
              background: STRATEGY_COLORS[step] ? `${STRATEGY_COLORS[step]}22` : "#1e293b",
              color: STRATEGY_COLORS[step] ?? "#64748b",
              border: `1px solid ${STRATEGY_COLORS[step] ?? "#334155"}`,
            }}>
              {step}
            </span>
          ))}
        </div>
      )}

      {/* Gesture sequence */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
        {clips.map((clip, i) => {
          const strategy = inspectorData?.[i]?.strategy;
          const bgColor = strategy ? STRATEGY_COLORS[strategy] : undefined;
          return (
            <span key={clip.id} style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "monospace",
              background: i === playState.currentIndex
                ? bgColor ? `${bgColor}33` : "rgba(96,165,250,0.2)"
                : "#1e293b",
              color: i === playState.currentIndex ? (bgColor ?? "#60a5fa") : "#64748b",
              border: `1px solid ${i === playState.currentIndex ? (bgColor ? `${bgColor}55` : "rgba(96,165,250,0.3)") : "#334155"}`,
            }}>
              {clip.gesture}
            </span>
          );
        })}
      </div>
    </div>
  );
}
