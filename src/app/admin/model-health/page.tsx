import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedResult } from "@/features/recognition/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};

const formatNum = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString();
};

export default async function AdminModelHealthPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const modelLoadResult = getCachedResult();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentLogs } = await supabase
    .from("translation_logs")
    .select("gesture_label, confidence, inference_time_ms, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  const totalPredictions = recentLogs?.length ?? 0;
  const lowConfidence = recentLogs?.filter((l) => (l.confidence ?? 0) < 0.5) ?? [];
  const mediumConfidence = recentLogs?.filter((l) => (l.confidence ?? 0) >= 0.5 && (l.confidence ?? 0) < 0.7) ?? [];
  const highConfidence = recentLogs?.filter((l) => (l.confidence ?? 0) >= 0.7) ?? [];

  const avgConfidence = totalPredictions > 0
    ? (recentLogs?.reduce((s, l) => s + (l.confidence ?? 0), 0) ?? 0) / totalPredictions
    : 0;

  const avgInferenceMs = totalPredictions > 0
    ? (recentLogs?.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) ?? 0) / totalPredictions
    : 0;

  const labelLowConfCount: Record<string, number> = {};
  const labelTotalCount: Record<string, number> = {};
  const labelConfSum: Record<string, number> = {};
  for (const log of recentLogs ?? []) {
    if (!labelTotalCount[log.gesture_label]) {
      labelTotalCount[log.gesture_label] = 0;
      labelConfSum[log.gesture_label] = 0;
    }
    labelTotalCount[log.gesture_label]++;
    labelConfSum[log.gesture_label] += log.confidence ?? 0;
    if ((log.confidence ?? 0) < 0.6) {
      if (!labelLowConfCount[log.gesture_label]) labelLowConfCount[log.gesture_label] = 0;
      labelLowConfCount[log.gesture_label]++;
    }
  }

  const confusedLabels = Object.entries(labelTotalCount)
    .filter(([, total]) => total >= 3)
    .map(([label, total]) => ({
      label,
      total,
      lowConf: labelLowConfCount[label] ?? 0,
      lowConfRate: (labelLowConfCount[label] ?? 0) / total,
      avgConf: labelConfSum[label] / total,
    }))
    .filter((l) => l.lowConfRate > 0.3)
    .sort((a, b) => b.lowConfRate - a.lowConfRate)
    .slice(0, 15);

  const totalCorrections = recentLogs
    ? recentLogs.filter(l => (l.confidence ?? 0) < 0.5).length
    : 0;

  const { count: correctionCount } = await supabase
    .from("prediction_corrections")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo);

  const { data: conversationData } = await supabase
    .from("conversation_sessions")
    .select("communication_success, total_messages, created_at")
    .gte("created_at", thirtyDaysAgo);

  const totalConversations = conversationData?.length ?? 0;
  const successfulConversations = conversationData?.filter(c => c.communication_success === true).length ?? 0;
  const totalMessages = conversationData?.reduce((s, c) => s + (c.total_messages ?? 0), 0) ?? 0;

  const { data: intelligenceData } = await supabase
    .from("conversation_intelligence")
    .select("*")
    .order("day", { ascending: false })
    .limit(7);

  const { data: difficultyDataRaw } = await supabase
    .from("gesture_difficulty_tracking")
    .select("*")
    .order("difficulty_score", { ascending: false })
    .limit(10);

  type DifficultyRow = {
    gesture_label: string;
    difficulty_score: number;
    total_recognitions: number;
    correction_count: number;
    confusion_count: number;
    avg_confidence: number | null;
  };

  const difficultyData = (difficultyDataRaw ?? []) as unknown as DifficultyRow[];

  const acceptanceRate = totalPredictions > 0
    ? (totalPredictions - (correctionCount ?? 0)) / totalPredictions
    : 0;

  const correctionHeatmap = recentLogs
    ? recentLogs.reduce<Record<string, number>>((acc, l) => {
        if ((l.confidence ?? 0) < 0.4) {
          const day = new Date(l.created_at).toLocaleDateString();
          acc[day] = (acc[day] ?? 0) + 1;
        }
        return acc;
      }, {})
    : {};

  const { count: trainingSampleCount } = await supabase
    .from("training_samples")
    .select("*", { count: "exact", head: true });

  const { count: reviewQueueCount } = await supabase
    .from("review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div>
      <h2>System Intelligence Dashboard</h2>
      <p className="panel-note">
        Comprehensive overview of conversation intelligence, gesture difficulty, and adaptive communication metrics.
      </p>

      <h3 className="analytics-section-title">Model Status</h3>
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

      <h3 className="analytics-section-title">Recognition Quality (30 days)</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total predictions</span>
          <span className="analytics-value">{formatNum(totalPredictions)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">{formatPct(avgConfidence)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg inference time</span>
          <span className="analytics-value">{avgInferenceMs.toFixed(1)} ms</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#22c55e" }}>
          <span className="analytics-label">High confidence (≥0.7)</span>
          <span className="analytics-value">{formatNum(highConfidence.length)} ({totalPredictions > 0 ? ((highConfidence.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#eab308" }}>
          <span className="analytics-label">Medium (0.5–0.69)</span>
          <span className="analytics-value">{formatNum(mediumConfidence.length)} ({totalPredictions > 0 ? ((mediumConfidence.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#ef4444" }}>
          <span className="analytics-label">Low confidence (&lt;0.5)</span>
          <span className="analytics-value">{formatNum(lowConfidence.length)} ({totalPredictions > 0 ? ((lowConfidence.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Conversation Trends (30 days)</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total conversations</span>
          <span className="analytics-value">{formatNum(totalConversations)}</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#22c55e" }}>
          <span className="analytics-label">Successful</span>
          <span className="analytics-value">{formatNum(successfulConversations)} ({totalConversations > 0 ? ((successfulConversations / totalConversations) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Total messages</span>
          <span className="analytics-value">{formatNum(totalMessages)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg messages/conversation</span>
          <span className="analytics-value">{totalConversations > 0 ? (totalMessages / totalConversations).toFixed(1) : "—"}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Gesture Difficulty Rankings</h3>
      {!difficultyData || difficultyData.length === 0 ? (
        <p className="panel-note">Not enough data to compute gesture difficulty rankings.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Gesture</th>
                <th>Difficulty Score</th>
                <th>Avg Confidence</th>
                <th>Corrections</th>
                <th>Confusions</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {difficultyData.map((d, i) => (
                <tr key={d.gesture_label}>
                  <td>{i + 1}</td>
                  <td><code>{d.gesture_label}</code></td>
                  <td>{(d.difficulty_score * 100).toFixed(0)}%</td>
                  <td>{formatPct(d.avg_confidence)}</td>
                  <td>{d.correction_count}</td>
                  <td>{d.confusion_count}</td>
                  <td>{d.total_recognitions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Correction Heatmap (recent)</h3>
      {Object.keys(correctionHeatmap).length === 0 ? (
        <p className="panel-note">No low-confidence events recorded recently.</p>
      ) : (
        <div className="admin-cards">
          {Object.entries(correctionHeatmap).slice(0, 10).map(([day, count]) => (
            <div className="analytics-card" key={day} style={{ borderColor: count > 5 ? "#ef4444" : "#eab308" }}>
              <span className="analytics-label">{day}</span>
              <span className="analytics-value">{count} corrections</span>
            </div>
          ))}
        </div>
      )}

      <h3 className="analytics-section-title">Acceptance &amp; Learning Statistics</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: acceptanceRate > 0.8 ? "#22c55e" : "#eab308" }}>
          <span className="analytics-label">Reply acceptance rate</span>
          <span className="analytics-value">{formatPct(acceptanceRate)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Corrections (30d)</span>
          <span className="analytics-value">{formatNum(correctionCount)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Training samples (total)</span>
          <span className="analytics-value">{formatNum(trainingSampleCount)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Pending review queue</span>
          <span className="analytics-value">{formatNum(reviewQueueCount)}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Low-Confidence Trends</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: (totalPredictions > 0 && lowConfidence.length / totalPredictions > 0.2) ? "#ef4444" : "#22c55e" }}>
          <span className="analytics-label">Low-confidence rate</span>
          <span className="analytics-value">{totalPredictions > 0 ? formatPct(lowConfidence.length / totalPredictions) : "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Low-confidence trend</span>
          <span className="analytics-value">{totalPredictions > 0 ? ((lowConfidence.length / totalPredictions) - 0.15).toFixed(1) + "% vs baseline" : "—"}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Dataset Growth</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total training samples</span>
          <span className="analytics-value">{formatNum(trainingSampleCount)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Review queue (pending)</span>
          <span className="analytics-value">{formatNum(reviewQueueCount)}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Most Confused Labels (30 days)</h3>
      {confusedLabels.length === 0 ? (
        <p className="panel-note">Not enough data to compute confusion metrics.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Total predictions</th>
                <th>Low-confidence</th>
                <th>Low-conf rate</th>
                <th>Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {confusedLabels.map((cl) => (
                <tr key={cl.label}>
                  <td><code>{cl.label}</code></td>
                  <td>{cl.total}</td>
                  <td>{cl.lowConf}</td>
                  <td>{formatPct(cl.lowConfRate)}</td>
                  <td style={{ fontSize: 12, color: "#888" }}>
                    {cl.lowConfRate > 0.5
                      ? "Consider re-recording samples"
                      : "Monitor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">User Feedback (30 days)</h3>
      {!feedback || feedback.length === 0 ? (
        <p className="panel-note">No feedback submitted in the last 30 days.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gesture</th>
                <th>Rating</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((fb) => (
                <tr key={fb.id}>
                  <td>{new Date(fb.created_at).toLocaleDateString()}</td>
                  <td><code>{fb.gesture_label}</code></td>
                  <td>{fb.rating === "correct" ? "Correct" : "Incorrect"}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {fb.comment ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Explainable AI — Prediction Explanation Panel</h3>
      <p className="panel-note">
        The Explainable Recognition engine provides human-readable explanations for every prediction.
        Check the translation page with the debug overlay enabled to see live explanations.
      </p>

      <h3 className="analytics-section-title">Recommendations</h3>
      <div className="panel" style={{ padding: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          <li>
            <strong>Low-confidence labels</strong> — Consider collecting more samples for labels with &gt;50% low-confidence rate.
          </li>
          <li>
            <strong>Gesture difficulty</strong> — Use the difficulty rankings above to prioritize re-recording the hardest gestures.
          </li>
          <li>
            <strong>Conversation flow</strong> — The flow prediction engine suggests next gestures based on conversation context.
          </li>
          <li>
            <strong>Adaptive replies</strong> — Reply ranking now incorporates acceptance history and phrase frequency.
          </li>
          <li>
            <strong>Mobile testing</strong> — If mobile FPS drops below 20, consider enabling CPU backend for TF.js.
          </li>
          <li>
            <strong>Dataset augmentation</strong> — Use the Dataset Capture page to collect diverse samples.
          </li>
        </ul>
      </div>
    </div>
  );
}
