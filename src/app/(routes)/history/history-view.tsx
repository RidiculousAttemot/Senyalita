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
  getTranscripts,
  Session,
  LogEntry
} from "@/features/logging";
import {
  deleteOwnSession,
  getSessionLogs,
  type UserSessionRow
} from "@/features/logging/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  authenticated: boolean;
  initialSessions: UserSessionRow[];
}

interface ConversationSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  total_messages: number;
  communication_success: boolean | null;
  participant_name: string | null;
}

interface CloudSessionLogs {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  logs: Array<{
    id: string;
    gestureLabel: string;
    confidence: number;
    inferenceTimeMs: number;
    createdAt: string;
  }>;
  transcripts: Array<{ id: string; content: string; createdAt: string }>;
}

export default function HistoryView({ authenticated, initialSessions }: Props) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cloudDetails, setCloudDetails] = useState<CloudSessionLogs | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [convSessions, setConvSessions] = useState<ConversationSession[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [convLoading, setConvLoading] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!authenticated) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("history-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "translation_sessions" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "translation_logs" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_sessions" },
        () => fetchConvSessions()
      )
      .subscribe();
    fetchConvSessions();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authenticated]);

  const fetchConvSessions = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("conversation_sessions")
      .select("*")
      .order("started_at", { ascending: false });
    setConvSessions(data ?? []);
  };

  const fetchConvMessages = async (sessionId: string) => {
    setConvLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    setConvMessages(data ?? []);
    setConvLoading(false);
  };

  const [localSessions, setLocalSessions] = useState<Session[]>([]);
  useEffect(() => {
    if (authenticated) {
      setLocalSessions([]);
      return;
    }
    setLocalSessions(getSessions());
  }, [authenticated, refreshKey]);

  const sessions = useMemo(() => {
    if (authenticated) {
      return initialSessions.map((s) => ({
        sessionId: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt ?? "",
        totalPredictions: s.totalPredictions,
        averageConfidence: s.averageConfidence,
        averageInferenceTime: 0,
        averageFps: 0
      }));
    }
    return localSessions;
  }, [authenticated, initialSessions, localSessions]);

  useEffect(() => {
    if (!authenticated || !selectedSessionId) {
      setCloudDetails(null);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    (async () => {
      const result = await getSessionLogs({ sessionId: selectedSessionId });
      if (cancelled) return;
      setCloudDetails({
        id: result.session?.id ?? selectedSessionId,
        startedAt: result.session?.startedAt ?? null,
        endedAt: result.session?.endedAt ?? null,
        logs: result.logs,
        transcripts: result.transcripts
      });
      setCloudLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, selectedSessionId, refreshKey]);

  const selectedSession =
    sessions.find((s) => s.sessionId === selectedSessionId) ?? null;

  const localSelectedLogs: LogEntry[] =
    !authenticated && selectedSessionId ? getLogs(selectedSessionId) : [];
  const localSelectedAnalytics =
    !authenticated && selectedSessionId
      ? getSessionAnalytics(selectedSessionId)
      : null;
  const localSelectedTranscripts =
    !authenticated && selectedSessionId ? getTranscripts(selectedSessionId) : [];

  const allAnalytics = authenticated ? null : getAllSessionAnalytics();

  const handleDeleteSession = async (sessionId: string) => {
    if (authenticated) {
      try {
        await deleteOwnSession(sessionId);
      } catch (e) {
        console.error("delete session failed", e);
        return;
      }
    } else {
      deleteSession(sessionId);
    }
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
    refresh();
  };

  const handleClearAll = () => {
    if (authenticated) return;
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

  const formatDuration = (ms: number | null | undefined): string => {
    if (!ms || ms <= 0) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  return (
    <main className="page">
      <div className="history-header">
        <h1>Recognition history</h1>
        <div className="history-mode-badge" data-mode={authenticated ? "cloud" : "local"}>
          {authenticated ? "Cloud (Supabase)" : "Local (browser only)"}
        </div>
        <div className="capture-actions">
          {!authenticated && (
            <>
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
            </>
          )}
          {authenticated && (
            <span className="button" style={{ opacity: 0.5, cursor: "default" }}>
              Manage account
            </span>
          )}
        </div>
      </div>

      {authenticated && (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="panel-note">
            Cloud history is stored in Supabase and shared across all your devices. Local
            browser history (if any) was imported the first time you opened the camera page
            after signing in.
          </p>
        </div>
      )}

      <div className="capture-actions" style={{ marginTop: 12, marginBottom: 8 }}>
        <button
          className={`button ${!showConversations ? "button-primary" : "button-secondary"}`}
          onClick={() => { setShowConversations(false); setSelectedConvId(null); }}
        >
          Translation sessions
        </button>
        <button
          className={`button ${showConversations ? "button-primary" : "button-secondary"}`}
          onClick={() => { setShowConversations(true); setSelectedSessionId(null); }}
        >
          Conversations
        </button>
      </div>

      {showConversations && (
        <>
          <div className="history-layout">
            <div className="history-list">
              <h2>Conversation sessions</h2>
              {convSessions.length === 0 ? (
                <p className="panel-note">No conversation sessions yet.</p>
              ) : (
                convSessions.map((cs) => (
                  <button
                    key={cs.id}
                    className={`session-card ${selectedConvId === cs.id ? "session-card-active" : ""}`}
                    onClick={() => { setSelectedConvId(cs.id); fetchConvMessages(cs.id); }}
                  >
                    <span className="session-card-date">
                      {new Date(cs.started_at).toLocaleString()}
                    </span>
                    <span className="session-card-meta">
                      {cs.total_messages} messages{cs.communication_success === true ? " \u2705" : cs.communication_success === false ? " \u274C" : ""}{cs.participant_name ? ` \u00B7 ${cs.participant_name}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="history-detail">
              {selectedConvId && (
                <div className="panel">
                  <div className="session-detail-header">
                    <h2>Conversation details</h2>
                    <div className="capture-actions">
                      <button
                        className="button button-secondary"
                        onClick={async () => {
                          const conv = convSessions.find(c => c.id === selectedConvId);
                          if (!conv || conv.communication_success === null) return;
                          const supabase = createSupabaseBrowserClient();
                          await supabase
                            .from("conversation_sessions")
                            .update({ communication_success: null })
                            .eq("id", selectedConvId);
                          fetchConvSessions();
                        }}
                      >
                        Reset success
                      </button>
                      <button
                        className="button"
                        onClick={() => {
                          const text = convMessages
                            .map((m) => `[${new Date(m.created_at).toLocaleTimeString()}] ${m.sender_type}: ${m.translated_text || m.gesture_label}${m.confidence != null ? ` (${(m.confidence * 100).toFixed(0)}%)` : ""}`)
                            .join("\n");
                          const blob = new Blob([text], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `conversation-${selectedConvId.slice(0, 8)}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        Export TXT
                      </button>
                    </div>
                  </div>

                  {convLoading ? (
                    <p className="panel-note">Loading messages...</p>
                  ) : convMessages.length === 0 ? (
                    <p className="panel-note">No messages in this session.</p>
                  ) : (
                    <div className="session-log-list" style={{ marginTop: 12 }}>
                      <h3>Messages ({convMessages.length})</h3>
                      <div className="log-table-wrap">
                        <table className="log-table">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Sender</th>
                              <th>Text</th>
                              <th>Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {convMessages.map((msg) => (
                              <tr key={msg.id}>
                                <td>{new Date(msg.created_at).toLocaleTimeString()}</td>
                                <td>{msg.sender_type}</td>
                                <td className="log-label">{msg.translated_text || msg.gesture_label}</td>
                                <td>{msg.confidence != null ? `${(msg.confidence * 100).toFixed(0)}%` : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!selectedConvId && (
                <div className="panel">
                  <p className="panel-note">Select a conversation to view messages.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!showConversations && (sessions.length === 0 ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="panel-note">
            {authenticated
              ? "No recognition sessions stored in the cloud yet. Use the camera page to start a session."
              : "No recognition sessions recorded yet. Use the camera page to start a session."}
          </p>
        </div>
      ) : (
        <>
          {!authenticated && allAnalytics && (
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
          )}

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
                    {session.totalPredictions > 0
                      ? `${session.totalPredictions} predictions · ${(
                          session.averageConfidence * 100
                        ).toFixed(0)}% avg confidence`
                      : "No metrics"}
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
                        {formatDuration(
                          authenticated
                            ? null
                            : localSelectedAnalytics?.sessionDurationMs
                        )}
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

                  {authenticated ? (
                    cloudLoading ? (
                      <p className="panel-note">Loading cloud session...</p>
                    ) : cloudDetails ? (
                      <>
                        {cloudDetails.transcripts.length > 0 && (
                          <div className="session-log-list" style={{ marginTop: 12 }}>
                            <h3>Transcript ({cloudDetails.transcripts.length})</h3>
                            {cloudDetails.transcripts.map((t) => (
                              <p key={t.id} className="transcript-line">
                                {t.content}
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="session-log-list" style={{ marginTop: 12 }}>
                          <h3>Prediction log ({cloudDetails.logs.length} entries)</h3>
                          {cloudDetails.logs.length === 0 ? (
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
                                  </tr>
                                </thead>
                                <tbody>
                                  {cloudDetails.logs.map((log) => (
                                    <tr key={log.id}>
                                      <td>{new Date(log.createdAt).toLocaleTimeString()}</td>
                                      <td className="log-label">{log.gestureLabel}</td>
                                      <td>{(log.confidence * 100).toFixed(0)}%</td>
                                      <td>{log.inferenceTimeMs.toFixed(1)}ms</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="panel-note">No data returned for this session.</p>
                    )
                  ) : (
                    <>
                      {localSelectedAnalytics && (
                        <div className="session-analytics" style={{ marginTop: 12 }}>
                          <h3>Analytics</h3>
                          <div className="history-analytics">
                            <div className="analytics-card">
                              <span className="analytics-label">Most recognized</span>
                              <span className="analytics-value">
                                {localSelectedAnalytics.mostRecognizedLabel || "N/A"}
                              </span>
                            </div>
                            <div className="analytics-card">
                              <span className="analytics-label">Highest conf</span>
                              <span className="analytics-value">
                                {localSelectedAnalytics.highestConfidenceLabel}{" "}
                                ({(localSelectedAnalytics.highestConfidence * 100).toFixed(0)}%)
                              </span>
                            </div>
                            <div className="analytics-card">
                              <span className="analytics-label">Lowest conf</span>
                              <span className="analytics-value">
                                {localSelectedAnalytics.lowestConfidenceLabel}{" "}
                                ({(localSelectedAnalytics.lowestConfidence * 100).toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {localSelectedTranscripts.length > 0 && (
                        <div className="session-log-list" style={{ marginTop: 12 }}>
                          <h3>Transcript ({localSelectedTranscripts.length})</h3>
                          {localSelectedTranscripts.map((t, i) => (
                            <p key={i} className="transcript-line">
                              {t.label}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="session-log-list" style={{ marginTop: 12 }}>
                        <h3>Prediction log ({localSelectedLogs.length} entries)</h3>
                        {localSelectedLogs.length === 0 ? (
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
                                {localSelectedLogs.map((log) => (
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
                    </>
                  )}
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
      ))}
    </main>
  );
}
