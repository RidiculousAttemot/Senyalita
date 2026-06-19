import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAdminAnalytics } from "@/lib/supabase/queries/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number | null | undefined, digits = 1): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
};

const formatMs = (n: number | null | undefined, digits = 1): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)} ms`;
};

const formatSec = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  return `${(ms / 1000).toFixed(1)} s`;
};

const formatMin = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  return `${(ms / 60000).toFixed(1)} min`;
};

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const data = await fetchAdminAnalytics(30);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Recognition trends (daily aggregates)
  const { data: dailyLogs } = await supabase
    .from("translation_logs")
    .select("gesture_label, confidence, inference_time_ms, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  const dayBuckets = new Map<string, { conf: number[]; lat: number[]; count: number }>();
  for (const log of (dailyLogs ?? [])) {
    const day = (log.created_at as string).slice(0, 10);
    const b = dayBuckets.get(day) ?? { conf: [], lat: [], count: 0 };
    if (log.confidence != null) b.conf.push(log.confidence);
    if (log.inference_time_ms != null) b.lat.push(log.inference_time_ms);
    b.count++;
    dayBuckets.set(day, b);
  }
  const dailyTrends = Array.from(dayBuckets.entries())
    .map(([day, b]) => ({
      day,
      count: b.count,
      avgConfidence: b.conf.length > 0 ? b.conf.reduce((s, v) => s + v, 0) / b.conf.length : 0,
      avgLatency: b.lat.length > 0 ? b.lat.reduce((s, v) => s + v, 0) / b.lat.length : 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // Conversation analytics
  const { data: convSessions } = await supabase
    .from("conversation_sessions")
    .select("status, started_at, ended_at, total_messages, communication_success")
    .gte("created_at", thirtyDaysAgo);

  const convList = convSessions ?? [];
  const activeConvs = convList.filter((s) => s.status === "active");
  const endedConvs = convList.filter((s) => s.status === "ended");
  const ratedConvs = endedConvs.filter((s) => s.communication_success !== null);
  const convSuccessCount = ratedConvs.filter((s) => s.communication_success === true).length;
  const totalConvMessages = convList.reduce((s, c) => s + (c.total_messages ?? 0), 0);
  const convDurations = endedConvs
    .filter((s) => s.ended_at && s.started_at)
    .map((s) => new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime());
  const avgConvDurationMs = convDurations.length > 0
    ? convDurations.reduce((s, v) => s + v, 0) / convDurations.length
    : null;

  // AI suggestion acceptance rate
  const { count: aiRepliesSent } = await supabase
    .from("telemetry_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "ai_reply_used")
    .gte("created_at", thirtyDaysAgo);

  // Selected replies in conversations (proxy for AI acceptance)
  const { count: selectedReplies } = await supabase
    .from("conversation_messages")
    .select("*", { count: "exact", head: true })
    .eq("is_selected_reply", true)
    .gte("created_at", thirtyDaysAgo);

  const aiAcceptanceRate =
    aiRepliesSent && aiRepliesSent > 0
      ? (selectedReplies ?? 0) / aiRepliesSent
      : null;

  // Learning analytics (gesture count from logs)
  const { data: distinctLabels } = await supabase
    .from("translation_logs")
    .select("gesture_label")
    .not("gesture_label", "is", null);

  const uniqueGesturesPracticed = new Set((distinctLabels ?? []).map((p) => p.gesture_label)).size;

  const recognition = data.recognition;
  const users = data.users;

  return (
    <div>
      <h2>Advanced Analytics (last 30 days)</h2>

      {/* ── Recognition Trends ── */}
      <h3 className="analytics-section-title">Recognition</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total recognitions</span>
          <span className="analytics-value">{recognition.total}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Today</span>
          <span className="analytics-value">{recognition.today}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">This week</span>
          <span className="analytics-value">{recognition.this_week}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">This month</span>
          <span className="analytics-value">{recognition.this_month}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">{formatPct(data.totals.avg_confidence)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg inference</span>
          <span className="analytics-value">{formatMs(data.totals.avg_inference_ms)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Low-confidence rate</span>
          <span className="analytics-value">{formatPct(recognition.low_confidence_rate)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Accuracy (user-rated)</span>
          <span className="analytics-value">{data.totals.users > 0 ? "—" : "—"}</span>
        </div>
      </div>

      {dailyTrends.length > 0 && (
        <>
          <h4 className="analytics-section-title" style={{ fontSize: 14, marginTop: 8 }}>Daily Trends</h4>
          <div className="admin-table-wrap">
            <table className="admin-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Predictions</th>
                  <th>Avg confidence</th>
                  <th>Avg latency (ms)</th>
                </tr>
              </thead>
              <tbody>
                {dailyTrends.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.count}</td>
                    <td>{formatPct(d.avgConfidence)}</td>
                    <td>{d.avgLatency.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Conversation Analytics ── */}
      <h3 className="analytics-section-title">Conversation</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total conversations</span>
          <span className="analytics-value">{convList.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Active</span>
          <span className="analytics-value">{activeConvs.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Ended</span>
          <span className="analytics-value">{endedConvs.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg duration</span>
          <span className="analytics-value">{formatMin(avgConvDurationMs)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg replies / session</span>
          <span className="analytics-value">
            {convList.length > 0 ? (totalConvMessages / convList.length).toFixed(1) : "—"}
          </span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Success rate</span>
          <span className="analytics-value">
            {ratedConvs.length > 0
              ? formatPct(convSuccessCount / ratedConvs.length)
              : "—"}
          </span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Successful</span>
          <span className="analytics-value">{convSuccessCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Unsuccessful</span>
          <span className="analytics-value">{ratedConvs.length - convSuccessCount}</span>
        </div>
      </div>

      {/* ── Learning Analytics ── */}
      <h3 className="analytics-section-title">Learning</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Unique gestures recognized</span>
          <span className="analytics-value">{uniqueGesturesPracticed}</span>
        </div>
      </div>

      {/* ── AI Analytics ── */}
      <h3 className="analytics-section-title">AI Assistant</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">AI replies sent</span>
          <span className="analytics-value">{aiRepliesSent ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Replies selected</span>
          <span className="analytics-value">{selectedReplies ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Suggestion acceptance rate</span>
          <span className="analytics-value">{formatPct(aiAcceptanceRate)}</span>
        </div>
      </div>

      {/* ── Users ── */}
      <h3 className="analytics-section-title">Users</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total users</span>
          <span className="analytics-value">{users.total}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Active users (30d)</span>
          <span className="analytics-value">{users.active_30d}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Sessions / user</span>
          <span className="analytics-value">{users.sessions_per_user.toFixed(2)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg session duration</span>
          <span className="analytics-value">{formatSec(users.avg_session_duration_ms)}</span>
        </div>
      </div>

      {/* ── Top gestures ── */}
      <h3 className="analytics-section-title">Top gestures</h3>
      {data.top_gestures.length === 0 ? (
        <p className="panel-note">No prediction data yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Label</th>
                <th>Count</th>
                <th>Avg confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.top_gestures.map((g, i) => (
                <tr key={g.label}>
                  <td>{i + 1}</td>
                  <td><code>{g.label}</code></td>
                  <td>{g.count}</td>
                  <td>{formatPct(g.avg_confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Top replies ── */}
      <h3 className="analytics-section-title">Top replies</h3>
      {data.top_replies.length === 0 ? (
        <p className="panel-note">No reply selections yet.</p>
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
              {data.top_replies.map((r, i) => (
                <tr key={r.reply_text}>
                  <td>{i + 1}</td>
                  <td>{r.reply_text}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Daily activity ── */}
      <h3 className="analytics-section-title">Daily activity</h3>
      {data.daily_counts.length === 0 ? (
        <p className="panel-note">No activity in the last 30 days.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.daily_counts.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
