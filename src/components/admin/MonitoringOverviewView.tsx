import { Activity, CircleAlert, Clock3, MessageSquareText, ShieldCheck, Target } from "lucide-react";
import type { FeedbackRow, ModelMetricsDailyRow } from "@/lib/supabase/types";

type MonitoringOverviewViewProps = {
  metrics: ModelMetricsDailyRow[];
  feedback: FeedbackRow[];
};

const formatPct = (value: number | null | undefined, digits = 1) => value === null || value === undefined || Number.isNaN(value) ? "-" : `${(value * 100).toFixed(digits)}%`;
const formatMs = (value: number | null | undefined, digits = 1) => value === null || value === undefined || Number.isNaN(value) ? "-" : `${value.toFixed(digits)} ms`;

export function MonitoringOverviewView({ feedback, metrics }: MonitoringOverviewViewProps) {
  const total = metrics.reduce((sum, metric) => sum + metric.total_predictions, 0);
  const lowConfidence = metrics.reduce((sum, metric) => sum + metric.low_confidence_count, 0);
  const unknown = metrics.reduce((sum, metric) => sum + metric.unknown_count, 0);
  const averageConfidence = total > 0 ? metrics.reduce((sum, metric) => sum + (metric.avg_confidence ?? 0) * metric.total_predictions, 0) / total : null;
  const averageInference = total > 0 ? metrics.reduce((sum, metric) => sum + (metric.avg_inference_ms ?? 0) * metric.total_predictions, 0) / total : null;
  const failureRate = total > 0 ? (lowConfidence + unknown) / total : null;
  const correct = feedback.filter((entry) => entry.rating === "correct").length;
  const incorrect = feedback.filter((entry) => entry.rating === "incorrect").length;
  const userRatedAccuracy = feedback.length > 0 ? correct / feedback.length : null;
  const metricsAvailable = metrics.length > 0;

  return (
    <div className="admin-monitoring-overview">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Recognition quality</p>
          <h1>Model monitoring</h1>
          <p className="admin-dashboard-subtitle">Review 30-day recognition rollups, identify confidence issues, and compare them with reported feedback.</p>
        </div>
        <span className={`admin-status ${metricsAvailable ? "admin-status-healthy" : "admin-status-unknown"}`}><span className="admin-status-dot" aria-hidden="true" />{metricsAvailable ? "30-day rollup" : "Rollups unavailable"}</span>
      </header>

      <section className="admin-metric-grid" aria-label="Recognition quality summary">
        <Metric icon={<Activity size={17} />} label="Predictions" note="Across available daily rollups" value={metricsAvailable ? total.toLocaleString() : "-"} />
        <Metric icon={<Target size={17} />} label="Average confidence" note="Weighted by prediction volume" value={formatPct(averageConfidence)} />
        <Metric icon={<Clock3 size={17} />} label="Average inference" note="Measured in browser sessions" value={formatMs(averageInference)} />
        <Metric icon={<CircleAlert size={17} />} label="Attention rate" note={`${lowConfidence} low confidence and ${unknown} unknown`} value={formatPct(failureRate)} />
      </section>

      <section className="admin-panel admin-monitoring-table-panel">
        <div className="admin-panel-heading"><div><p className="admin-overline">Daily telemetry</p><h2>Recognition rollups</h2></div><span className="admin-period-tag">Last 30 days</span></div>
        {metricsAvailable ? (
          <div className="admin-table-scroll"><table className="admin-model-table"><thead><tr><th>Day</th><th>Predictions</th><th>Low confidence</th><th>Unknown</th><th>Average confidence</th><th>Average inference</th><th>Attention rate</th></tr></thead><tbody>
            {metrics.map((metric) => <tr key={metric.day}><td>{metric.day}</td><td>{metric.total_predictions}</td><td>{metric.low_confidence_count}</td><td>{metric.unknown_count}</td><td>{formatPct(metric.avg_confidence)}</td><td>{formatMs(metric.avg_inference_ms)}</td><td>{formatPct(metric.failure_rate)}</td></tr>)}
          </tbody></table></div>
        ) : <p className="admin-empty-state">No daily rollups are available for the selected period.</p>}
      </section>

      <section className="admin-monitoring-feedback-grid">
        <article className="admin-panel admin-monitoring-feedback-summary">
          <div className="admin-panel-heading"><div><p className="admin-overline">Reported outcomes</p><h2>Feedback quality</h2></div><MessageSquareText size={18} aria-hidden="true" /></div>
          <dl><div><dt>Total feedback</dt><dd>{feedback.length}</dd></div><div><dt>Correct</dt><dd>{correct}</dd></div><div><dt>Incorrect</dt><dd>{incorrect}</dd></div><div><dt>User-rated accuracy</dt><dd>{formatPct(userRatedAccuracy)}</dd></div></dl>
        </article>
        <article className="admin-panel admin-monitoring-feedback-list">
          <div className="admin-panel-heading"><div><p className="admin-overline">Recent reports</p><h2>Feedback queue</h2></div><ShieldCheck size={18} aria-hidden="true" /></div>
          {feedback.length === 0 ? <p className="admin-empty-state">No feedback has been submitted yet.</p> : <div className="admin-table-scroll"><table className="admin-model-table"><thead><tr><th>Created</th><th>Gesture</th><th>Rating</th><th>Comment</th></tr></thead><tbody>{feedback.map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString()}</td><td><code>{entry.gesture_label}</code></td><td><span className={`admin-status ${entry.rating === "correct" ? "admin-status-healthy" : "admin-status-attention"}`}><span className="admin-status-dot" aria-hidden="true" />{entry.rating}</span></td><td>{entry.comment ?? "-"}</td></tr>)}</tbody></table></div>}
        </article>
      </section>
    </div>
  );
}

function Metric({ icon, label, note, value }: { icon: React.ReactNode; label: string; note: string; value: string }) {
  return <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon">{icon}</span></div><p className="admin-metric-label">{label}</p><strong className="admin-metric-value">{value}</strong><p className="admin-metric-note">{note}</p></article>;
}