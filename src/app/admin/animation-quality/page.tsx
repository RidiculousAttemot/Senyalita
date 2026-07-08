"use client";

import React, { useEffect, useState } from "react";
import { AnimationLoader } from "@/features/sign-animation/loader";
import { AnimationQualityEvaluator } from "@/features/sign-animation/engine/qualityEvaluation";
import type { GestureAnimationAsset, AnimationQualityMetrics } from "@/features/sign-animation/types";

export default function AdminAnimationQualityPage() {
  const [metrics, setMetrics] = useState<AnimationQualityMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof AnimationQualityMetrics>("totalScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch("/animations/manifest.json");
        const manifest = await resp.json();
        const loader = new AnimationLoader();
        const evaluator = new AnimationQualityEvaluator();
        const results: AnimationQualityMetrics[] = [];

        for (const label of manifest.assets ?? []) {
          const asset = await loader.load(label);
          if (asset) {
            results.push(evaluator.evaluate(asset));
          }
        }
        setMetrics(results);
      } catch (e) {
        console.error("Failed to load animations", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sorted = [...metrics]
    .filter((m) => m.gesture.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

  const averageScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.totalScore, 0) / metrics.length) : 0;
  const averageSmoothness = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.smoothness, 0) / metrics.length) : 0;

  const scoreColor = (score: number) => {
    if (score >= 80) return "#bbf7d0";
    if (score >= 60) return "#fde68a";
    if (score >= 40) return "#fed7aa";
    return "#fca5a5";
  };

  const handleSort = (col: keyof AnimationQualityMetrics) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  const SortArrow = ({ col }: { col: keyof AnimationQualityMetrics }) =>
    sortBy === col ? <span style={{ marginLeft: 4 }}>{sortAsc ? "↑" : "↓"}</span> : null;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Animation Quality Dashboard</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Average Score</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: scoreColor(averageScore), margin: "4px 0 0" }}>
            {averageScore}%
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Average Smoothness</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: scoreColor(averageSmoothness), margin: "4px 0 0" }}>
            {averageSmoothness}%
          </p>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#1e293b" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Evaluated Gestures</span>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: "4px 0 0" }}>
            {metrics.length}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Search gestures..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ flex: 1, padding: "8px 12px", fontSize: 14 }}
        />
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading animation assets for evaluation...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {[
                  { key: "gesture" as const, label: "Gesture" },
                  { key: "totalScore" as const, label: "Score" },
                  { key: "smoothness" as const, label: "Smoothness" },
                  { key: "frameCount" as const, label: "Frames" },
                  { key: "missingLandmarks" as const, label: "Missing LMs" },
                  { key: "transitionQuality" as const, label: "Transition" },
                  { key: "playbackDuration" as const, label: "Duration" },
                  { key: "assetComplete" as const, label: "Complete" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: "8px 12px", textAlign: "left", color: "#94a3b8",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}<SortArrow col={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.gesture} style={{
                  borderBottom: "1px solid #0f172a",
                  background: m.totalScore < 40 ? "#1a1a2e" : "transparent",
                }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#e2e8f0" }}>{m.gesture}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 12,
                      background: m.totalScore >= 80 ? "#14532d" : m.totalScore >= 60 ? "#422006" : "#451a1a",
                      color: scoreColor(m.totalScore), fontWeight: 600,
                    }}>
                      {m.totalScore}%
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: scoreColor(m.smoothness) }}>{m.smoothness}%</td>
                  <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{m.frameCount}</td>
                  <td style={{ padding: "8px 12px", color: m.missingLandmarks > 0 ? "#fca5a5" : "#94a3b8" }}>
                    {m.missingLandmarks}
                  </td>
                  <td style={{ padding: "8px 12px", color: scoreColor(m.transitionQuality) }}>{m.transitionQuality}%</td>
                  <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{(m.playbackDuration / 1000).toFixed(1)}s</td>
                  <td style={{ padding: "8px 12px" }}>
                    {m.assetComplete
                      ? <span style={{ color: "#bbf7d0" }}>✓</span>
                      : <span style={{ color: "#fca5a5" }}>✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <p style={{ color: "#64748b", padding: 16, textAlign: "center" }}>No results found</p>
          )}
        </div>
      )}

      {metrics.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>Score Distribution</h2>
          <div style={{ display: "flex", gap: 4 }}>
            {["0-25", "26-50", "51-75", "76-100"].map((range) => {
              const count = metrics.filter((m) => {
                if (range === "0-25") return m.totalScore <= 25;
                if (range === "26-50") return m.totalScore > 25 && m.totalScore <= 50;
                if (range === "51-75") return m.totalScore > 50 && m.totalScore <= 75;
                return m.totalScore > 75;
              }).length;
              const pct = metrics.length > 0 ? (count / metrics.length) * 100 : 0;
              return (
                <div key={range} style={{ flex: 1, padding: 8, borderRadius: 6, background: "#1e293b", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{range}</div>
                  <div style={{
                    height: 40, background: "#0f172a", borderRadius: 4, marginTop: 4,
                    display: "flex", alignItems: "flex-end", overflow: "hidden",
                  }}>
                    <div style={{
                      width: "100%", height: `${pct}%`,
                      background: range === "76-100" ? "#22c55e" : range === "51-75" ? "#f59e0b" : range === "26-50" ? "#f97316" : "#ef4444",
                      borderRadius: 4, transition: "height 0.3s",
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 4 }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
