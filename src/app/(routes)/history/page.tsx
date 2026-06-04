"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSessions,
  deleteSession,
  clearAll,
  getSessionAnalytics,
  getAllLogs,
  getAllSessionAnalytics,
  getLogs,
  Session,
  LogEntry
} from "@/features/logging";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    setSessions(getSessions());
  }, [refreshKey]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const selectedLogs = useMemo(
    () => (selectedSessionId ? getLogs(selectedSessionId) : []),
    [selectedSessionId]
  );

  const selectedAnalytics = useMemo(
    () => (selectedSessionId ? getSessionAnalytics(selectedSessionId) : null),
    [selectedSessionId]
  );

  const allAnalytics = useMemo(() => getAllSessionAnalytics(), []);

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
    refresh();
  };

  const handleClearAll = () => {
    clearAll();
    setSelectedSessionId(null);
    refresh();
  };

  const exportJson = () => {
    const allLogs = getAllLogs();
    const blob = new Blob([JSON.stringify(allLogs, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fsl-predictions-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const allLogs = getAllLogs();
    const header =
      "id,timestamp,predictedLabel,confidence,smoothingEnabled,inferenceTimeMs,fps\n";
    const rows = allLogs
      .map(
        (l) =>
          `${l.id},${l.timestamp},${l.predictedLabel},${l.confidence},${l.smoothingEnabled},${l.inferenceTimeMs},${l.fps}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fsl-predictions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSessionJson = (sessionId: string) => {
    const logs = getLogs(sessionId);
    const session = sessions.find((s) => s.sessionId === sessionId);
    const payload = { session, logs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fsl-session-${sessionId.slice(0, 20)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  return (
    <main className="page">
      <div className="history-header">
        <h1>Recognition history</h1>
        <div className="capture-actions">
          <button className="button" onClick={exportJson}>
            Export all JSON
          </button>
          <button className="button button-secondary" onClick={exportCsv}>
            Export all CSV
          </button>
          <button
            className="button button-secondary"
            onClick={handleClearAll}
            disabled={sessions.length === 0}
          >
            Clear all history
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="panel-note">
            No recognition sessions recorded yet. Use the camera page to start a session.
          </p>
        </div>
      ) : (
        <>
          <div className="history-analytics">
            <div className="analytics-card">
              <span className="analytics-label">Sessions</span>
              <span className="analytics-value">{allAnalytics.totalSessions}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Total predictions</span>
              <span className="analytics-value">{allAnalytics.totalPredictions}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Avg confidence</span>
              <span className="analytics-value">
                {(allAnalytics.averageConfidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Most recognized</span>
              <span className="analytics-value">
                {allAnalytics.mostRecognizedLabel || "N/A"}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Total duration</span>
              <span className="analytics-value">
                {formatDuration(allAnalytics.totalDurationMs)}
              </span>
            </div>
          </div>

          <div className="history-layout">
            <div className="history-list">
              <h2>Sessions</h2>
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  className={`session-card ${
                    selectedSessionId === session.sessionId ? "session-card-active" : ""
                  }`}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                >
                  <span className="session-card-date">
                    {new Date(session.startedAt).toLocaleString()}
                  </span>
                  <span className="session-card-meta">
                    {session.totalPredictions} predictions &middot;{" "}
                    {(session.averageConfidence * 100).toFixed(0)}% avg confidence
                  </span>
                </button>
              ))}
            </div>

            <div className="history-detail">
              {selectedSession ? (
                <div className="panel">
                  <div className="session-detail-header">
                    <h2>Session details</h2>
                    <div className="capture-actions">
                      <button
                        className="button button-secondary"
                        onClick={() => exportSessionJson(selectedSession.sessionId)}
                      >
                        Export JSON
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => handleDeleteSession(selectedSession.sessionId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="history-analytics" style={{ marginTop: 8 }}>
                    <div className="analytics-card">
                      <span className="analytics-label">Started</span>
                      <span className="analytics-value">
                        {new Date(selectedSession.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="analytics-card">
                      <span className="analytics-label">Duration</span>
                      <span className="analytics-value">
                        {selectedAnalytics
                          ? formatDuration(selectedAnalytics.sessionDurationMs)
                          : "N/A"}
                      </span>
                    </div>
                    <div className="analytics-card">
                      <span className="analytics-label">Avg confidence</span>
                      <span className="analytics-value">
                        {(selectedSession.averageConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="analytics-card">
                      <span className="analytics-label">Avg FPS</span>
                      <span className="analytics-value">
                        {selectedSession.averageFps.toFixed(1)}
                      </span>
                    </div>
                    <div className="analytics-card">
                      <span className="analytics-label">Avg inference</span>
                      <span className="analytics-value">
                        {selectedSession.averageInferenceTime.toFixed(1)}ms
                      </span>
                    </div>
                    <div className="analytics-card">
                      <span className="analytics-label">Total predictions</span>
                      <span className="analytics-value">
                        {selectedSession.totalPredictions}
                      </span>
                    </div>
                  </div>

                  {selectedAnalytics && (
                    <div className="session-analytics" style={{ marginTop: 12 }}>
                      <h3>Analytics</h3>
                      <div className="history-analytics">
                        <div className="analytics-card">
                          <span className="analytics-label">Most recognized</span>
                          <span className="analytics-value">
                            {selectedAnalytics.mostRecognizedLabel || "N/A"}
                          </span>
                        </div>
                        <div className="analytics-card">
                          <span className="analytics-label">Highest conf</span>
                          <span className="analytics-value">
                            {selectedAnalytics.highestConfidenceLabel}{" "}
                            ({(selectedAnalytics.highestConfidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="analytics-card">
                          <span className="analytics-label">Lowest conf</span>
                          <span className="analytics-value">
                            {selectedAnalytics.lowestConfidenceLabel}{" "}
                            ({(selectedAnalytics.lowestConfidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="session-log-list" style={{ marginTop: 12 }}>
                    <h3>Prediction log ({selectedLogs.length} entries)</h3>
                    {selectedLogs.length === 0 ? (
                      <p className="panel-note">No predictions logged.</p>
                    ) : (
                      <div className="log-table-wrap">
                        <table className="log-table">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Label</th>
                              <th>Confidence</th>
                              <th>Inference</th>
                              <th>FPS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLogs.map((log) => (
                              <tr key={log.id}>
                                <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                                <td className="log-label">{log.predictedLabel}</td>
                                <td>{(log.confidence * 100).toFixed(0)}%</td>
                                <td>{log.inferenceTimeMs.toFixed(1)}ms</td>
                                <td>{log.fps}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="panel">
                  <p className="panel-note">
                    Select a session from the list to view details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
