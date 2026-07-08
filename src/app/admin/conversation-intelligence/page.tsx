import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConversationIntelligenceAnalyzer } from "@/features/conversation/conversationIntelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const formatMs = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
};

export default async function ConversationIntelligencePage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await supabase
    .from("conversation_sessions")
    .select("id, started_at, ended_at, total_messages, communication_success")
    .gte("created_at", thirtyDaysAgo);

  const sessionIds = (sessions ?? []).map((s) => s.id);

  let messages: any[] = [];
  if (sessionIds.length > 0) {
    const { data: msgs } = await supabase
      .from("conversation_messages")
      .select("session_id, gesture_label, confidence, sender_type, is_selected_reply, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });
    messages = msgs ?? [];
  }

  const messageMap: Record<string, any[]> = {};
  for (const msg of messages) {
    if (!messageMap[msg.session_id]) messageMap[msg.session_id] = [];
    messageMap[msg.session_id].push(msg);
  }

  const analyzer = new ConversationIntelligenceAnalyzer();
  const report = analyzer.analyze(
    (sessions ?? []).map((s) => ({
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at ?? undefined,
      totalMessages: s.total_messages ?? 0,
      communicationSuccess: s.communication_success,
      messages: messageMap[s.id] ?? [],
    }))
  );

  const qualityIndex = report.qualityIndex;
  const indexColor = qualityIndex >= 80 ? "#22c55e" : qualityIndex >= 60 ? "#eab308" : "#ef4444";

  return (
    <div>
      <h2>Conversation Intelligence</h2>
      <p className="panel-note">
        In-depth conversation analytics, quality metrics, and communication efficiency analysis.
        {sessions?.length === 0 && " No conversation data available for the last 30 days."}
      </p>

      {sessions && sessions.length > 0 && (
        <>
          <h3 className="analytics-section-title">Overall Conversation Quality Index</h3>
          <div className="admin-cards">
            <div className="analytics-card" style={{ borderColor: indexColor }}>
              <span className="analytics-label">Quality Index</span>
              <span className="analytics-value" style={{ fontSize: 32, color: indexColor }}>
                {qualityIndex}/100
              </span>
            </div>
            <div className="analytics-card" style={{ borderColor: report.communicationEfficiency > 60 ? "#22c55e" : "#eab308" }}>
              <span className="analytics-label">Communication Efficiency</span>
              <span className="analytics-value">{report.communicationEfficiency}%</span>
            </div>
          </div>

          <h3 className="analytics-section-title">Factor Breakdown</h3>
          <div className="admin-cards">
            <div className="analytics-card" style={{ borderColor: "#22c55e" }}>
              <span className="analytics-label">Communication Success</span>
              <span className="analytics-value">{report.totalConversations > 0 ? formatPct(report.successfulConversations / report.totalConversations) : "—"}</span>
            </div>
            <div className="analytics-card" style={{ borderColor: "#eab308" }}>
              <span className="analytics-label">Stalled Conversations</span>
              <span className="analytics-value" style={{ color: report.stalledConversations > 0 ? "#ef4444" : "#22c55e" }}>
                {report.stalledConversations}
              </span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Repeated Clarifications</span>
              <span className="analytics-value">{report.repeatedClarifications}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Avg Response Time</span>
              <span className="analytics-value">{formatMs(report.averageResponseTime)}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Total Conversations</span>
              <span className="analytics-value">{report.totalConversations}</span>
            </div>
            <div className="analytics-card" style={{ borderColor: "#22c55e" }}>
              <span className="analytics-label">Successful</span>
              <span className="analytics-value">{report.successfulConversations}</span>
            </div>
          </div>

          {report.topMisunderstoodGestures.length > 0 && (
            <>
              <h3 className="analytics-section-title">Most Misunderstood Gestures</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Gesture</th>
                      <th>Clarification Count</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topMisunderstoodGestures.map((g) => (
                      <tr key={g.label}>
                        <td><code>{g.label}</code></td>
                        <td>{g.count}</td>
                        <td style={{ fontSize: 12, color: "#888" }}>
                          {g.count > 5 ? "Consider re-recording samples" : "Monitor"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {report.trends.dailySuccessRate.length > 0 && (
            <>
              <h3 className="analytics-section-title">Daily Trends (Last {report.trends.dailySuccessRate.length} days)</h3>
              <div className="admin-table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Success Rate</th>
                      <th>Avg Confidence</th>
                      <th>Messages</th>
                      <th>Clarification Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.trends.dailySuccessRate.map((rate, i) => {
                      const days = Object.keys(new Array(i + 1).fill(0));
                      const d = new Date(Date.now() - (report.trends.dailySuccessRate.length - 1 - i) * 86400000);
                      return (
                        <tr key={i}>
                          <td>{d.toLocaleDateString()}</td>
                          <td style={{ color: rate > 0.5 ? "#22c55e" : "#ef4444" }}>
                            {formatPct(rate)}
                          </td>
                          <td>{formatPct(report.trends.dailyAvgConfidence[i] ?? 0)}</td>
                          <td>{report.trends.dailyMessageCount[i]}</td>
                          <td>{formatPct(report.trends.dailyClarificationRate[i] ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h3 className="analytics-section-title">Recommendations</h3>
          <div className="panel" style={{ padding: 16 }}>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
              {report.recommendations.map((rec, i) => (
                <li key={i}>
                  <strong>{rec}</strong>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
