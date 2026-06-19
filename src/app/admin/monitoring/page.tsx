import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { fetchModelMetricsDaily } from "@/lib/supabase/queries/analytics";
import { listAllFeedback } from "@/lib/supabase/queries/feedback";

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

export default async function AdminMonitoringPage() {
  await requireAdmin();
  const [metrics, feedback] = await Promise.all([
    fetchModelMetricsDaily(30),
    listAllFeedback(50)
  ]);

  const total = metrics.reduce((s, m) => s + m.total_predictions, 0);
  const lowConf = metrics.reduce((s, m) => s + m.low_confidence_count, 0);
  const unknown = metrics.reduce((s, m) => s + m.unknown_count, 0);
  const avgConf =
    total > 0
      ? metrics.reduce((s, m) => s + (m.avg_confidence ?? 0) * m.total_predictions, 0) / total
      : null;
  const avgInf =
    total > 0
      ? metrics.reduce((s, m) => s + (m.avg_inference_ms ?? 0) * m.total_predictions, 0) / total
      : null;
  const failureRate = total > 0 ? (lowConf + unknown) / total : 0;

  const correctCount = feedback.filter((f) => f.rating === "correct").length;
  const incorrectCount = feedback.filter((f) => f.rating === "incorrect").length;
  const totalFeedback = feedback.length;
  const userRating = totalFeedback > 0 ? correctCount / totalFeedback : null;

  return (
    <div>
      <h2>Model monitoring (last 30 days)</h2>

      <h3 className="analytics-section-title">Daily aggregates</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total predictions</span>
          <span className="analytics-value">{total}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">{formatPct(avgConf)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg inference</span>
          <span className="analytics-value">{formatMs(avgInf)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Low-confidence</span>
          <span className="analytics-value">{lowConf}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Unknown gestures</span>
          <span className="analytics-value">{unknown}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Failure rate</span>
          <span className="analytics-value">{formatPct(failureRate)}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Daily breakdown</h3>
      {metrics.length === 0 ? (
        <p className="panel-note">
          No daily rollups yet. Run <code>scripts/db-rollup-metrics.mjs</code> to
          populate the model_metrics_daily table from translation_logs.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Predictions</th>
                <th>Low-conf</th>
                <th>Unknown</th>
                <th>Avg conf</th>
                <th>Avg inf</th>
                <th>Failure</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.day}>
                  <td>{m.day}</td>
                  <td>{m.total_predictions}</td>
                  <td>{m.low_confidence_count}</td>
                  <td>{m.unknown_count}</td>
                  <td>{formatPct(m.avg_confidence)}</td>
                  <td>{formatMs(m.avg_inference_ms)}</td>
                  <td>{formatPct(m.failure_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">User feedback</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total feedback</span>
          <span className="analytics-value">{totalFeedback}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Correct</span>
          <span className="analytics-value">{correctCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Incorrect</span>
          <span className="analytics-value">{incorrectCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">User-rated accuracy</span>
          <span className="analytics-value">{formatPct(userRating)}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Recent feedback</h3>
      {feedback.length === 0 ? (
        <p className="panel-note">No feedback submitted yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>User</th>
                <th>Gesture</th>
                <th>Rating</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id}>
                  <td>{new Date(f.created_at).toLocaleString()}</td>
                  <td>
                    <code>{f.user_id.slice(0, 8)}</code>
                  </td>
                  <td>
                    <code>{f.gesture_label}</code>
                  </td>
                  <td>
                    <span
                      className={`role-pill ${
                        f.rating === "correct" ? "role-admin" : ""
                      }`}
                    >
                      {f.rating}
                    </span>
                  </td>
                  <td>{f.comment ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
