import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};

export default async function AdminConversationsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: sessions } = await supabase
    .from("conversation_sessions")
    .select("*")
    .order("started_at", { ascending: false });

  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("*");

  const { data: telemetry } = await supabase
    .from("telemetry_events")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: feedback } = await supabase
    .from("feedback")
    .select("gesture_label, rating, created_at");

  const total = sessions?.length ?? 0;
  const ended = sessions?.filter((s) => s.status === "ended") ?? [];
  const active = sessions?.filter((s) => s.status === "active") ?? [];
  const successful = ended.filter((s) => s.communication_success === true);
  const totalMessages = messages?.length ?? 0;

  const avgDurationMs = ended.length > 0
    ? ended.reduce((sum, s) => sum + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()), 0) / ended.length
    : 0;

  const avgMessagesPerSession = total > 0 && messages ? totalMessages / total : 0;

  const selectedReplyMessages = messages?.filter((m) => m.is_selected_reply) ?? [];
  const aiReplyEvents = telemetry?.filter((t) => t.event_type === "ai_reply_used") ?? [];
  const aiReplyAcceptanceRate = selectedReplyMessages.length > 0 && aiReplyEvents.length > 0
    ? Math.min(selectedReplyMessages.length / (aiReplyEvents.length || 1), 1)
    : 0;

  const feedbackCorrect = feedback?.filter((f) => f.rating === "correct") ?? [];
  const feedbackTotal = feedback?.length ?? 0;
  const feedbackAccuracy = feedbackTotal > 0 ? feedbackCorrect.length / feedbackTotal : 0;

  const msgs = messages ?? [];
  const responseTimes: number[] = [];
  const signerMessages = msgs.filter((m) => m.sender_type === "signer");
  const responderMessages = msgs.filter((m) => m.sender_type === "responder");
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (msg.sender_type === "responder" && i > 0) {
      const prev = msgs[i - 1];
      const timeDiff = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
      if (timeDiff > 0 && timeDiff < 300000) responseTimes.push(timeDiff);
    }
  }
  const avgResponseTimeMs = responseTimes.length > 0
    ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
    : 0;

  const labelCounts: Record<string, number> = {};
  messages?.forEach((m) => {
    if (m.gesture_label) labelCounts[m.gesture_label] = (labelCounts[m.gesture_label] ?? 0) + 1;
  });
  const topGestures = Object.entries(labelCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const replyCounts: Record<string, number> = {};
  messages?.forEach((m) => {
    if (m.sender_type === "responder" && !m.gesture_label) {
      replyCounts[m.translated_text] = (replyCounts[m.translated_text] ?? 0) + 1;
    }
  });
  const topReplies = Object.entries(replyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div>
      <h2>Conversation Analytics</h2>

      <h3 className="analytics-section-title">Overview</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total sessions</span>
          <span className="analytics-value">{total}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Active</span>
          <span className="analytics-value">{active.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Ended</span>
          <span className="analytics-value">{ended.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg duration</span>
          <span className="analytics-value">{avgDurationMs > 0 ? `${(avgDurationMs / 60000).toFixed(1)} min` : "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg messages/session</span>
          <span className="analytics-value">{avgMessagesPerSession.toFixed(1)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Success rate</span>
          <span className="analytics-value">
            {ended.length > 0 ? formatPct(successful.length / ended.length) : "—"}
          </span>
        </div>
      </div>

      <h3 className="analytics-section-title">Quality Metrics</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Avg response time</span>
          <span className="analytics-value">{avgResponseTimeMs > 0 ? `${(avgResponseTimeMs / 1000).toFixed(1)}s` : "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">AI reply acceptance</span>
          <span className="analytics-value">{formatPct(aiReplyAcceptanceRate)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Feedback accuracy</span>
          <span className="analytics-value">{formatPct(feedbackAccuracy)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Signer messages</span>
          <span className="analytics-value">{signerMessages.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Responder messages</span>
          <span className="analytics-value">{responderMessages.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Selected replies</span>
          <span className="analytics-value">{selectedReplyMessages.length}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Most Recognized Gestures</h3>
      {topGestures.length === 0 ? (
        <p className="panel-note">No gesture data yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Gesture</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {topGestures.map(([label, count], i) => (
                <tr key={label}>
                  <td>{i + 1}</td>
                  <td><code>{label}</code></td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Most Selected Replies</h3>
      {topReplies.length === 0 ? (
        <p className="panel-note">No reply data yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Reply</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {topReplies.map(([text, count], i) => (
                <tr key={text}>
                  <td>{i + 1}</td>
                  <td>{text}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Recent Sessions</h3>
      {!sessions || sessions.length === 0 ? (
        <p className="panel-note">No sessions yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Duration</th>
                <th>Messages</th>
                <th>Avg response</th>
                <th>Status</th>
                <th>Success</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 20).map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td>{s.ended_at ? `${((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000).toFixed(1)}m` : "—"}</td>
                  <td>{s.total_messages}</td>
                  <td>{avgResponseTimeMs > 0 ? `${(avgResponseTimeMs / 1000).toFixed(0)}s` : "—"}</td>
                  <td>{s.status}</td>
                  <td>{s.communication_success === null ? "—" : s.communication_success ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
