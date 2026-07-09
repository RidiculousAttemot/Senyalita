"use client";

import { useMemo, useState, useCallback } from "react";
import type { ConversationSession, FeedbackRow } from "@/lib/supabase/types";

type Props = {
  sessions: ConversationSession[];
  feedback: FeedbackRow[];
  profiles: Array<{ id: string; display_name: string | null }>;
};

export const EvaluationDashboard = ({ sessions, feedback, profiles }: Props) => {
  const [filter, setFilter] = useState("all");
  
  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.id, p.display_name ?? "Anonymous");
    }
    return map;
  }, [profiles]);
  
  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    const endedSessions = sessions.filter(s => s.status === "ended").length;
    const successfulSessions = sessions.filter(s => s.communication_success === true).length;
    const avgDuration = sessions
      .filter(s => s.started_at && s.ended_at)
      .reduce((sum, s) => sum + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()), 0) / (endedSessions || 1);
    
    const correctFeedback = feedback.filter(f => f.rating === "correct").length;
    const totalFeedback = feedback.length;
    const accuracy = totalFeedback > 0 ? correctFeedback / totalFeedback : 0;
    
    return {
      totalSessions,
      endedSessions,
      successfulSessions,
      successRate: endedSessions > 0 ? successfulSessions / endedSessions : 0,
      avgDurationSeconds: Math.round(avgDuration / 1000),
      totalFeedback,
      accuracy: Math.round(accuracy * 100),
    };
  }, [sessions, feedback]);
  
  const participantStats = useMemo(() => {
    const byUser = new Map<string, { sessions: number; successful: number; feedback: number }>();
    for (const s of sessions) {
      const current = byUser.get(s.user_id) ?? { sessions: 0, successful: 0, feedback: 0 };
      current.sessions++;
      if (s.communication_success) current.successful++;
      byUser.set(s.user_id, current);
    }
    for (const f of feedback) {
      if (f.user_id) {
        const current = byUser.get(f.user_id) ?? { sessions: 0, successful: 0, feedback: 0 };
        current.feedback++;
        byUser.set(f.user_id, current);
      }
    }
    return Array.from(byUser.entries()).map(([id, data]) => ({
      id,
      name: profileMap.get(id) ?? "Unknown",
      ...data,
    }));
  }, [sessions, feedback, profileMap]);
  
  const filteredParticipants = filter === "all"
    ? participantStats
    : participantStats.filter(p => (filter === "active" ? p.sessions > 0 : p.sessions === 0));
  
  const exportCsv = useCallback(() => {
    const header = "Participant,Sessions,Successful,Rate,Feedback\n";
    const rows = participantStats.map(
      (p) => `"${p.name}",${p.sessions},${p.successful},${p.sessions > 0 ? (p.successful / p.sessions * 100).toFixed(1) + "%" : "-"},${p.feedback}`
    ).join("\n");
    const summaryLines = [
      `\n\nSummary,,,,,\nMetric,Value,,,,\nTotal Sessions,${stats.totalSessions},,,,\nSuccess Rate,${(stats.successRate * 100).toFixed(0)}%,,,,\nAvg Duration,${stats.avgDurationSeconds}s,,,,\nFeedback Accuracy,${stats.accuracy}%,,,,\nTotal Feedback,${stats.totalFeedback},,,,\nParticipants,${participantStats.length},,,,`,
    ];
    const blob = new Blob([header + rows + summaryLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thesis-evaluation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [participantStats, stats]);

  return (
    <div className="admin-evaluation">
      <h1>Multi-User Evaluation</h1>
      <p className="evaluation-subtitle">Thesis-ready statistics from real user interactions</p>
      
      <div className="evaluation-overview">
        <div className="evaluation-card">
          <span className="evaluation-value">{stats.totalSessions}</span>
          <span className="evaluation-label">Total Sessions</span>
        </div>
        <div className="evaluation-card">
          <span className="evaluation-value">{(stats.successRate * 100).toFixed(0)}%</span>
          <span className="evaluation-label">Success Rate</span>
        </div>
        <div className="evaluation-card">
          <span className="evaluation-value">{stats.avgDurationSeconds}s</span>
          <span className="evaluation-label">Avg Duration</span>
        </div>
        <div className="evaluation-card">
          <span className="evaluation-value">{stats.accuracy}%</span>
          <span className="evaluation-label">Feedback Accuracy</span>
        </div>
        <div className="evaluation-card">
          <span className="evaluation-value">{stats.totalFeedback}</span>
          <span className="evaluation-label">Feedback Entries</span>
        </div>
        <div className="evaluation-card">
          <span className="evaluation-value">{participantStats.length}</span>
          <span className="evaluation-label">Participants</span>
        </div>
      </div>
      
      <div className="evaluation-actions" style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <div className="evaluation-filter" style={{ display: "flex", gap: 4 }}>
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`filter-btn ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>Active</button>
        </div>
        <button className="button button-secondary" style={{ fontSize: 12, padding: "4px 12px" }} onClick={exportCsv}>Export CSV (thesis)</button>
      </div>
      
      <table className="evaluation-table">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Sessions</th>
            <th>Successful</th>
            <th>Rate</th>
            <th>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {filteredParticipants.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.sessions}</td>
              <td>{p.successful}</td>
              <td>{p.sessions > 0 ? `${Math.round(p.successful / p.sessions * 100)}%` : "-"}</td>
              <td>{p.feedback}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
