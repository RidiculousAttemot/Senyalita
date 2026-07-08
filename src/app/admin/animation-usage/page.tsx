"use client";

import React, { useEffect, useState } from "react";
import { AnimationUsageTracker, globalAnimationTracker } from "@/features/animation-tracking/animationTracker";
import type { AnimationTrackingStats, AnimationGestureStats } from "@/features/animation-tracking/animationTracker";

export default function AdminAnimationUsagePage() {
  const [tracker] = useState(() => globalAnimationTracker);
  const [stats, setStats] = useState<AnimationTrackingStats | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setStats(tracker.getOverallStats());
  }, [tracker]);

  const filteredGestures = stats
    ? stats.mostPlayedGestures.filter((g) =>
        g.gestureLabel.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const leastCompleted = stats
    ? stats.leastCompletedGestures.filter((g) =>
        g.gestureLabel.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  if (!stats) {
    return (
      <div>
        <h2>Animation Usage Analytics</h2>
        <p className="panel-note">No animation usage data recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Animation Usage Analytics</h2>
      <p className="panel-note">
        Track animation playback patterns, completion rates, and preferred avatar styles.
      </p>

      <h3 className="analytics-section-title">Overall Statistics</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total plays</span>
          <span className="analytics-value">{stats.totalPlays}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Replays</span>
          <span className="analytics-value">{stats.totalReplays}</span>
        </div>
        <div className="analytics-card" style={{ borderColor: stats.overallCompletionRate > 0.7 ? "#22c55e" : "#ef4444" }}>
          <span className="analytics-label">Completion rate</span>
          <span className="analytics-value">{(stats.overallCompletionRate * 100).toFixed(1)}%</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Interruptions</span>
          <span className="analytics-value">{stats.totalInterruptions}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg playback duration</span>
          <span className="analytics-value">{stats.averageDuration.toFixed(0)} ms</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Preferred avatar style</span>
          <span className="analytics-value">{stats.preferredStyleOverall}</span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search gestures..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#f1f5f9", width: 300 }}
        />
      </div>

      <h3 className="analytics-section-title">Most Played Gestures</h3>
      {filteredGestures.length === 0 ? (
        <p className="panel-note">No gesture data found.</p>
      ) : (
        <div className="admin-table-wrap" style={{ maxHeight: 500, overflowY: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Gesture</th>
                <th>Plays</th>
                <th>Replays</th>
                <th>Completions</th>
                <th>Interruptions</th>
                <th>Completion Rate</th>
                <th>Avg Duration</th>
                <th>Preferred Style</th>
              </tr>
            </thead>
            <tbody>
              {filteredGestures.map((g) => {
                const topStyle = Object.entries(g.preferredStyles)
                  .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";
                return (
                  <tr key={g.gestureLabel}>
                    <td><code>{g.gestureLabel}</code></td>
                    <td>{g.totalPlays}</td>
                    <td>{g.replays}</td>
                    <td>{g.completions}</td>
                    <td style={{ color: g.interruptionRate > 0.3 ? "#ef4444" : undefined }}>
                      {g.interruptions}
                    </td>
                    <td style={{ color: g.completionRate > 0.7 ? "#22c55e" : "#ef4444" }}>
                      {(g.completionRate * 100).toFixed(0)}%
                    </td>
                    <td>{g.averageDuration.toFixed(0)}ms</td>
                    <td>{topStyle}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Gestures Needing Improvement (Lowest Completion)</h3>
      {leastCompleted.length === 0 ? (
        <p className="panel-note">All gestures have good completion rates.</p>
      ) : (
        <div className="admin-table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Gesture</th>
                <th>Plays</th>
                <th>Completions</th>
                <th>Completion Rate</th>
                <th>Interruption Rate</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {leastCompleted.map((g) => (
                <tr key={g.gestureLabel}>
                  <td><code>{g.gestureLabel}</code></td>
                  <td>{g.totalPlays}</td>
                  <td>{g.completions}</td>
                  <td style={{ color: "#ef4444" }}>{(g.completionRate * 100).toFixed(0)}%</td>
                  <td style={{ color: g.interruptionRate > 0.3 ? "#ef4444" : "#22c55e" }}>
                    {(g.interruptionRate * 100).toFixed(0)}%
                  </td>
                  <td style={{ fontSize: 12, color: "#888" }}>
                    {g.completionRate < 0.3
                      ? "Consider re-recording animation"
                      : g.completionRate < 0.6
                      ? "Review animation quality"
                      : "Monitor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
