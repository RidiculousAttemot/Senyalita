import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedResult } from "@/features/recognition/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};

function computeHealthScore(params: {
  totalPredictions: number;
  avgConfidence: number;
  feedbackAccuracy: number;
  trainingSamples: number;
  failureRate: number;
}): { score: number; color: string } {
  let score = 50;
  if (params.totalPredictions >= 1000) score += 20;
  if (params.avgConfidence >= 0.7) score += 10;
  if (params.feedbackAccuracy >= 0.7) score += 10;
  if (params.trainingSamples >= 5) score += 10;
  if (params.failureRate > 0.2) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  return { score, color };
}

export default async function AdminModelTrainingPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const modelLoadResult = getCachedResult();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentLogs },
    { data: feedback },
    { data: corrections },
    { data: trainingSamples },
  ] = await Promise.all([
    supabase
      .from("translation_logs")
      .select("confidence, inference_time_ms, created_at")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("feedback")
      .select("rating")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("prediction_corrections" as any)
      .select("id", { count: "exact", head: true }),
    supabase
      .from("training_samples" as any)
      .select("id", { count: "exact", head: true }),
  ]);

  const totalPredictions = recentLogs?.length ?? 0;
  const avgConfidence =
    totalPredictions > 0
      ? (recentLogs?.reduce((s, l) => s + (l.confidence ?? 0), 0) ?? 0) / totalPredictions
      : 0;
  const avgInferenceMs =
    totalPredictions > 0
      ? (recentLogs?.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) ?? 0) / totalPredictions
      : 0;
  const failureRate =
    totalPredictions > 0
      ? (recentLogs?.filter((l) => (l.confidence ?? 0) < 0.1 || (l.inference_time_ms ?? 0) <= 0).length ?? 0) / totalPredictions
      : 0;

  const feedbackCount = feedback?.length ?? 0;
  const feedbackAccuracy =
    feedbackCount > 0
      ? (feedback?.filter((f) => f.rating === "correct").length ?? 0) / feedbackCount
      : 0;
  const correctionCount = corrections?.length ?? 0;
  const trainingSampleCount = trainingSamples?.length ?? 0;

  const { score: healthScore, color: healthColor } = computeHealthScore({
    totalPredictions,
    avgConfidence,
    feedbackAccuracy,
    trainingSamples: trainingSampleCount,
    failureRate,
  });

  return (
    <div>
      <h2>Continuous Model Improvement</h2>

      <h3 className="analytics-section-title">Current Model</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Status</span>
          <span className="analytics-value">{modelLoadResult.status}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Classes</span>
          <span className="analytics-value">133</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Architecture</span>
          <span className="analytics-value">BiLSTM</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Runtime</span>
          <span className="analytics-value">TF.js WebGL</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Model Health Score</h3>
      <div className="panel" style={{ textAlign: "center", padding: 32 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: healthColor,
            lineHeight: 1,
          }}
        >
          {healthScore}
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: "#888" }}>
          {healthScore >= 80
            ? "Healthy — model is performing well"
            : healthScore >= 50
              ? "Fair — some metrics need attention"
              : "Poor — consider retraining or investigating data quality"}
        </div>
      </div>

      <h3 className="analytics-section-title">Data Quality (30 days)</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total predictions</span>
          <span className="analytics-value">{totalPredictions}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">{formatPct(avgConfidence)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg inference time</span>
          <span className="analytics-value">{avgInferenceMs.toFixed(1)} ms</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">User feedback count</span>
          <span className="analytics-value">{feedbackCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Feedback accuracy</span>
          <span className="analytics-value">{formatPct(feedbackAccuracy)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Corrections</span>
          <span className="analytics-value">{correctionCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Training samples</span>
          <span className="analytics-value">{trainingSampleCount}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Retraining Recommendations</h3>
      <div className="panel" style={{ padding: 16 }}>
        {totalPredictions === 0 ? (
          <p className="panel-note">No data yet. Start collecting predictions to see recommendations.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            {feedbackAccuracy < 0.8 && (
              <li>
                <strong>Consider retraining</strong> — user feedback accuracy is low ({formatPct(feedbackAccuracy)})
              </li>
            )}
            {trainingSampleCount >= 20 && (
              <li>
                <strong>Sufficient training samples collected</strong> for retraining cycle ({trainingSampleCount} samples)
              </li>
            )}
            {totalPredictions < 100 && (
              <li>
                <strong>Collect more real-world data</strong> before retraining ({totalPredictions} predictions)
              </li>
            )}
            {avgConfidence < 0.6 && (
              <li>
                <strong>Model confidence is below threshold</strong> — investigate data quality ({formatPct(avgConfidence)})
              </li>
            )}
            {feedbackAccuracy >= 0.8 && trainingSampleCount < 20 && totalPredictions >= 100 && avgConfidence >= 0.6 && (
              <li>All metrics look healthy. No retraining recommended at this time.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
