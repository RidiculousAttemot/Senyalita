import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedResult } from "@/features/recognition/model";
import fs from "fs/promises";
import path from "path";

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

  const { data: modelVersions } = await supabase
    .from("model_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

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

  const { data: logs7d } = await supabase
    .from("translation_logs")
    .select("gesture_label, confidence, inference_time_ms, created_at")
    .gte("created_at", sevenDaysAgo);

  const avgInferenceMs7d = logs7d && logs7d.length > 0
    ? logs7d.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) / logs7d.length
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

  // v2: Additional metrics
  const { count: gestureCountRaw } = await supabase
    .from("gestures")
    .select("*", { count: "exact", head: true });
  const gestureCount = gestureCountRaw ?? 0;

  const { data: fslData } = await supabase
    .from("gesture_knowledge_base")
    .select("category");

  const translationCoverage = fslData?.length ?? 0;

  let animationAssetsCount = 0;
  let animationManifestTotal = 0;
  try {
    const manifestPath = path.join(process.cwd(), "public", "animations", "manifest.json");
    const manifestRaw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRaw);
    animationAssetsCount = manifest.generated ?? 0;
    animationManifestTotal = manifest.totalGestures ?? 0;
  } catch {}

  const datasetCoverage = trainingSampleCount ?? 0;
  const activeModelVersion = modelVersions && modelVersions.length > 0 ? modelVersions[0] : null;

  const aiHealthFactors = {
    modelStatus: modelLoadResult.status === "ready" ? 100 : modelLoadResult.status === "loading" ? 50 : 0,
    predictionQuality: Math.round(avgConfidence * 100),
    inferenceLatency: avgInferenceMs < 50 ? 100 : avgInferenceMs < 100 ? 80 : avgInferenceMs < 200 ? 60 : 30,
    conversationSuccess: totalConversations > 0 ? Math.round((successfulConversations / totalConversations) * 100) : 50,
    datasetGrowth: datasetCoverage > 100 ? 100 : datasetCoverage > 50 ? 80 : datasetCoverage > 10 ? 60 : 30,
    animationCoverage: animationManifestTotal > 0 ? Math.round((animationAssetsCount / gestureCount) * 100) : 50,
    translationCoverage: gestureCount > 0 ? Math.round((translationCoverage / gestureCount) * 100) : 50,
    acceptance: Math.round(acceptanceRate * 100),
  };

  const aiHealthScore = Math.round(
    aiHealthFactors.modelStatus * 0.15 +
    aiHealthFactors.predictionQuality * 0.2 +
    aiHealthFactors.inferenceLatency * 0.1 +
    aiHealthFactors.conversationSuccess * 0.15 +
    aiHealthFactors.datasetGrowth * 0.1 +
    aiHealthFactors.animationCoverage * 0.1 +
    aiHealthFactors.translationCoverage * 0.1 +
    aiHealthFactors.acceptance * 0.1
  );

  const healthColor = aiHealthScore >= 80 ? "#22c55e" : aiHealthScore >= 60 ? "#eab308" : "#ef4444";

  return (
    <div>
      <h2>System Intelligence Dashboard v2</h2>
      <p className="panel-note">
        Comprehensive AI health monitoring with live metrics, coverage analysis, and adaptive learning indicators.
      </p>

      {/* AI Health Score */}
      <h3 className="analytics-section-title">AI Health Score</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: healthColor }}>
          <span className="analytics-label">Overall AI Health</span>
          <span className="analytics-value" style={{ fontSize: 32, color: healthColor }}>
            {aiHealthScore}/100
          </span>
        </div>
        {Object.entries(aiHealthFactors).map(([key, value]) => (
          <div
            key={key}
            className="analytics-card"
            style={{
              borderColor: value >= 80 ? "#22c55e" : value >= 60 ? "#eab308" : "#ef4444",
            }}
          >
            <span className="analytics-label">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
            <span className="analytics-value">{value}/100</span>
          </div>
        ))}
      </div>

      {/* Model Status v2 */}
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
        {activeModelVersion && (
          <>
            <div className="analytics-card">
              <span className="analytics-label">Active Version</span>
              <span className="analytics-value">v{activeModelVersion.version ?? "?"}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Version Accuracy</span>
              <span className="analytics-value">{formatPct((activeModelVersion as any).accuracy)}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Deployed</span>
              <span className="analytics-value">{new Date((activeModelVersion as any).created_at).toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Per-Class Accuracy */}
      <h3 className="analytics-section-title">Per-Class Accuracy (30 days)</h3>
      {(() => {
        const classAccuracy = Object.entries(labelTotalCount)
          .map(([label, total]) => ({
            label,
            total,
            avgConf: labelConfSum[label] / total,
            lowConfRate: (labelLowConfCount[label] ?? 0) / total,
          }))
          .sort((a, b) => a.avgConf - b.avgConf)
          .slice(0, 20);

        if (classAccuracy.length === 0) {
          return <p className="panel-note">Not enough data.</p>;
        }

        return (
          <div className="admin-table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Gesture</th>
                  <th>Total</th>
                  <th>Avg Confidence</th>
                  <th>Low-Conf Rate</th>
                </tr>
              </thead>
              <tbody>
                {classAccuracy.map((c) => (
                  <tr key={c.label}>
                    <td><code>{c.label}</code></td>
                    <td>{c.total}</td>
                    <td style={{ color: c.avgConf >= 0.7 ? "#22c55e" : c.avgConf >= 0.5 ? "#eab308" : "#ef4444" }}>
                      {formatPct(c.avgConf)}
                    </td>
                    <td style={{ color: c.lowConfRate > 0.3 ? "#ef4444" : "#22c55e" }}>
                      {formatPct(c.lowConfRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Coverage Metrics */}
      <h3 className="analytics-section-title">Coverage Overview</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: (animationManifestTotal > 0 ? (animationAssetsCount / gestureCount) : 0) > 0.7 ? "#22c55e" : "#eab308" }}>
          <span className="analytics-label">Animation Coverage</span>
          <span className="analytics-value">{animationAssetsCount}/{gestureCount} ({gestureCount > 0 ? ((animationAssetsCount / gestureCount) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: (gestureCount > 0 ? (translationCoverage / gestureCount) : 0) > 0.7 ? "#22c55e" : "#eab308" }}>
          <span className="analytics-label">Translation Coverage</span>
          <span className="analytics-value">{translationCoverage}/{gestureCount} ({gestureCount > 0 ? ((translationCoverage / gestureCount) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Dataset Coverage</span>
          <span className="analytics-value">{formatNum(datasetCoverage)} training samples</span>
        </div>
      </div>

      {/* Live Inference Latency */}
      <h3 className="analytics-section-title">Live Inference Latency</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: avgInferenceMs < 50 ? "#22c55e" : avgInferenceMs < 100 ? "#eab308" : "#ef4444" }}>
          <span className="analytics-label">Avg latency (30d)</span>
          <span className="analytics-value">{avgInferenceMs.toFixed(1)} ms</span>
        </div>
        <div className="analytics-card" style={{ borderColor: avgInferenceMs7d < 50 ? "#22c55e" : avgInferenceMs7d < 100 ? "#eab308" : "#ef4444" }}>
          <span className="analytics-label">Avg latency (7d)</span>
          <span className="analytics-value">{avgInferenceMs7d.toFixed(1)} ms</span>
        </div>
      </div>

      {/* Prediction Confidence Trends */}
      <h3 className="analytics-section-title">Prediction Confidence Trends</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: "#22c55e" }}>
          <span className="analytics-label">High (≥0.7)</span>
          <span className="analytics-value">{formatNum(highConfidence.length)} ({totalPredictions > 0 ? ((highConfidence.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#eab308" }}>
          <span className="analytics-label">Medium (0.5–0.69)</span>
          <span className="analytics-value">{formatNum(mediumConfidence.length)} ({totalPredictions > 0 ? ((mediumConfidence.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#ef4444" }}>
          <span className="analytics-label">Low (&lt;0.5)</span>
          <span className="analytics-value">{formatNum(lowConfidence.length)} ({totalPredictions > 0 ? ((lowConfidence.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
      </div>

      {/* Gesture Difficulty Rankings */}
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

      {/* Correction Heatmap */}
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

      {/* Acceptance & Learning */}
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

      {/* Low-Confidence Trends */}
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

      {/* Conversation Trends */}
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

      {/* Model Version History */}
      {modelVersions && modelVersions.length > 1 && (
        <>
          <h3 className="analytics-section-title">Model Version History</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Accuracy</th>
                  <th>Dataset Size</th>
                  <th>Classes</th>
                  <th>Deployed</th>
                </tr>
              </thead>
              <tbody>
                {modelVersions.map((v: any) => (
                  <tr key={v.id}>
                    <td>v{v.version}</td>
                    <td>{formatPct(v.accuracy)}</td>
                    <td>{formatNum(v.dataset_size)}</td>
                    <td>{v.num_classes}</td>
                    <td>{new Date(v.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Most Confused Labels */}
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
                    {cl.lowConfRate > 0.5 ? "Consider re-recording samples" : "Monitor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Feedback */}
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

      {/* Recommendations */}
      <h3 className="analytics-section-title">Recommendations</h3>
      <div className="panel" style={{ padding: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
          {aiHealthScore < 60 && (
            <li><strong>AI Health Score below 60</strong> — Address the lowest-scoring factors above.</li>
          )}
          <li><strong>Low-confidence labels</strong> — Consider collecting more samples for labels with &gt;50% low-confidence rate.</li>
          <li><strong>Gesture difficulty</strong> — Use the difficulty rankings above to prioritize re-recording the hardest gestures.</li>
          <li><strong>Coverage gaps</strong> — Animation ({animationAssetsCount}/{gestureCount}) and translation ({translationCoverage}/{gestureCount}) coverage should be expanded.</li>
          <li><strong>Conversation flow</strong> — The flow prediction engine suggests next gestures based on conversation context.</li>
          <li><strong>Adaptive replies</strong> — Reply ranking now incorporates acceptance history and phrase frequency.</li>
          <li><strong>Mobile testing</strong> — If mobile FPS drops below 20, consider enabling CPU backend for TF.js.</li>
          <li><strong>Dataset augmentation</strong> — Use the Dataset Capture page to collect diverse samples.</li>
          {avgInferenceMs > 100 && (
            <li><strong>Inference latency is high ({avgInferenceMs.toFixed(0)}ms)</strong> — Consider model optimization or quantization.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
