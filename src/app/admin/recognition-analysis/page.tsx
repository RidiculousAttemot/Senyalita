import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};

type ConfusionPair = {
  labelA: string;
  labelB: string;
  count: number;
};

type ConfidenceDistribution = {
  range: string;
  count: number;
  percentage: number;
};

export default async function RecognitionAnalysisPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await supabase
    .from("translation_logs")
    .select("gesture_label, confidence, inference_time_ms, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  const { data: corrections } = await supabase
    .from("prediction_corrections")
    .select("predicted_label, corrected_label, confidence, created_at")
    .gte("created_at", thirtyDaysAgo);

  const { data: signers } = await supabase
    .from("signer_profiles")
    .select("*");

  const { count: totalSessions } = await supabase
    .from("translation_sessions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo);

  const logList = logs ?? [];
  const correctionList = (corrections ?? []) as any[];
  const signerList = signers ?? [];
  const totalPredictions = logList.length;

  const avgConfidence = totalPredictions > 0
    ? logList.reduce((s, l) => s + (l.confidence ?? 0), 0) / totalPredictions
    : 0;
  const avgLatency = totalPredictions > 0
    ? logList.reduce((s, l) => s + (l.inference_time_ms ?? 0), 0) / totalPredictions
    : 0;

  const lowConf = logList.filter((l) => (l.confidence ?? 0) < 0.5);
  const medConf = logList.filter((l) => (l.confidence ?? 0) >= 0.5 && (l.confidence ?? 0) < 0.7);
  const highConf = logList.filter((l) => (l.confidence ?? 0) >= 0.7);

  const distBins = [
    { min: 0.9, max: 1.01, label: "0.90–1.00" },
    { min: 0.8, max: 0.9, label: "0.80–0.89" },
    { min: 0.7, max: 0.8, label: "0.70–0.79" },
    { min: 0.6, max: 0.7, label: "0.60–0.69" },
    { min: 0.5, max: 0.6, label: "0.50–0.59" },
    { min: 0.4, max: 0.5, label: "0.40–0.49" },
    { min: 0.3, max: 0.4, label: "0.30–0.39" },
    { min: 0, max: 0.3, label: "0.00–0.29" },
  ];

  const distribution: ConfidenceDistribution[] = distBins.map((bin) => {
    const count = logList.filter((l) => {
      const c = l.confidence ?? 0;
      return c >= bin.min && c < bin.max;
    }).length;
    return {
      range: bin.label,
      count,
      percentage: totalPredictions > 0 ? count / totalPredictions : 0,
    };
  });

  const labelStats: Record<string, { total: number; lowConf: number; sumConf: number; sumLatency: number; corrections: number }> = {};
  for (const log of logList) {
    if (!labelStats[log.gesture_label]) {
      labelStats[log.gesture_label] = { total: 0, lowConf: 0, sumConf: 0, sumLatency: 0, corrections: 0 };
    }
    labelStats[log.gesture_label].total++;
    labelStats[log.gesture_label].sumConf += log.confidence ?? 0;
    labelStats[log.gesture_label].sumLatency += log.inference_time_ms ?? 0;
    if ((log.confidence ?? 0) < 0.5) {
      labelStats[log.gesture_label].lowConf++;
    }
  }

  for (const corr of correctionList) {
    const label = corr.predicted_label ?? corr.corrected_label;
    if (labelStats[label]) {
      labelStats[label].corrections++;
    }
  }

  const gestureTable = Object.entries(labelStats)
    .map(([label, s]) => ({
      label,
      total: s.total,
      avgConf: s.sumConf / s.total,
      avgLatency: s.sumLatency / s.total,
      lowConfRate: s.lowConf / s.total,
      correctionRate: s.corrections / Math.max(s.total, 1),
      falsePositiveRate: s.total > 0
        ? (correctionList.filter((c: any) => c.predicted_label === label && !c.corrected_label).length) / s.total
        : 0,
    }))
    .sort((a, b) => b.lowConfRate - a.lowConfRate);

  const confusionMap = new Map<string, ConfusionPair>();
  for (const corr of correctionList) {
    if (corr.predicted_label && corr.corrected_label && corr.predicted_label !== corr.corrected_label) {
      const key = [corr.predicted_label, corr.corrected_label].sort().join("::");
      const existing = confusionMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        confusionMap.set(key, { labelA: corr.predicted_label, labelB: corr.corrected_label, count: 1 });
      }
    }
  }
  const confusionPairs = Array.from(confusionMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);

  const rejectionRate = totalPredictions > 0
    ? logList.filter((l) => (l.confidence ?? 0) < 0.4).length / totalPredictions
    : 0;

  const falsePositives = correctionList.filter((c: any) => c.predicted_label && !c.corrected_label).length;
  const falseNegatives = correctionList.filter((c: any) => c.corrected_label && !c.predicted_label).length;

  const signerStats = {
    total: signerList.length,
    avgConfidenceBySigner: signerList.length > 0
      ? signerList.reduce((s: number, signer: any) => s + (signer.avg_confidence ?? 0.7), 0) / signerList.length
      : 0,
  };

  return (
    <div>
      <h2>Recognition Error Analytics</h2>
      <p className="panel-note">
        Comprehensive error analysis, confusion patterns, and recognition quality metrics.
      </p>

      <h3 className="analytics-section-title">Overview</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total predictions (30d)</span>
          <span className="analytics-value">{totalPredictions.toLocaleString()}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">{formatPct(avgConfidence)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg inference latency</span>
          <span className="analytics-value">{avgLatency.toFixed(1)} ms</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Rejection rate (&lt;0.4)</span>
          <span className="analytics-value">{formatPct(rejectionRate)}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Total sessions</span>
          <span className="analytics-value">{totalSessions?.toLocaleString() ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Registered signers</span>
          <span className="analytics-value">{signerStats.total}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Confidence Distribution</h3>
      <div className="admin-cards">
        {distribution.map((bin) => (
          <div
            key={bin.range}
            className="analytics-card"
            style={{
              borderColor:
                bin.range.startsWith("0.90") ? "#22c55e" :
                bin.range.startsWith("0.80") ? "#86efac" :
                bin.range.startsWith("0.70") ? "#eab308" :
                bin.range.startsWith("0.60") ? "#f97316" :
                bin.range.startsWith("0.50") ? "#ef4444" :
                "#dc2626",
            }}
          >
            <span className="analytics-label">{bin.range}</span>
            <span className="analytics-value">
              {bin.count} ({formatPct(bin.percentage)})
            </span>
          </div>
        ))}
      </div>

      <h3 className="analytics-section-title">High / Medium / Low Breakdown</h3>
      <div className="admin-cards">
        <div className="analytics-card" style={{ borderColor: "#22c55e" }}>
          <span className="analytics-label">High confidence (≥0.7)</span>
          <span className="analytics-value">{highConf.length} ({totalPredictions > 0 ? ((highConf.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#eab308" }}>
          <span className="analytics-label">Medium (0.5–0.69)</span>
          <span className="analytics-value">{medConf.length} ({totalPredictions > 0 ? ((medConf.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
        <div className="analytics-card" style={{ borderColor: "#ef4444" }}>
          <span className="analytics-label">Low confidence (&lt;0.5)</span>
          <span className="analytics-value">{lowConf.length} ({totalPredictions > 0 ? ((lowConf.length / totalPredictions) * 100).toFixed(1) : 0}%)</span>
        </div>
      </div>

      {correctionList.length > 0 && (
        <>
          <h3 className="analytics-section-title">Error Analysis</h3>
          <div className="admin-cards">
            <div className="analytics-card" style={{ borderColor: "#ef4444" }}>
              <span className="analytics-label">Total corrections</span>
              <span className="analytics-value">{correctionList.length}</span>
            </div>
            <div className="analytics-card" style={{ borderColor: "#f97316" }}>
              <span className="analytics-label">False positives</span>
              <span className="analytics-value">{falsePositives}</span>
            </div>
            <div className="analytics-card" style={{ borderColor: "#eab308" }}>
              <span className="analytics-label">False negatives</span>
              <span className="analytics-value">{falseNegatives}</span>
            </div>
          </div>
        </>
      )}

      {confusionPairs.length > 0 && (
        <>
          <h3 className="analytics-section-title">Most Confused Gesture Pairs</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Gesture A</th>
                  <th>Gesture B</th>
                  <th>Confusion Count</th>
                </tr>
              </thead>
              <tbody>
                {confusionPairs.map((pair, i) => (
                  <tr key={pair.labelA + pair.labelB}>
                    <td>{i + 1}</td>
                    <td><code>{pair.labelA}</code></td>
                    <td><code>{pair.labelB}</code></td>
                    <td>{pair.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="analytics-section-title">Per-Gesture Quality Metrics</h3>
      {gestureTable.length === 0 ? (
        <p className="panel-note">No gesture data available for the selected period.</p>
      ) : (
        <div className="admin-table-wrap" style={{ maxHeight: 600, overflowY: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Gesture</th>
                <th>Total</th>
                <th>Avg Confidence</th>
                <th>Avg Latency (ms)</th>
                <th>Low-Conf Rate</th>
                <th>Correction Rate</th>
              </tr>
            </thead>
            <tbody>
              {gestureTable.map((g) => (
                <tr key={g.label}>
                  <td><code>{g.label}</code></td>
                  <td>{g.total}</td>
                  <td>{formatPct(g.avgConf)}</td>
                  <td>{g.avgLatency.toFixed(1)}</td>
                  <td style={{ color: g.lowConfRate > 0.3 ? "#ef4444" : "#22c55e" }}>
                    {formatPct(g.lowConfRate)}
                  </td>
                  <td style={{ color: g.correctionRate > 0.2 ? "#ef4444" : "#22c55e" }}>
                    {formatPct(g.correctionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {signerStats.total > 0 && (
        <>
          <h3 className="analytics-section-title">Signer Statistics</h3>
          <div className="admin-cards">
            <div className="analytics-card">
              <span className="analytics-label">Registered signers</span>
              <span className="analytics-value">{signerStats.total}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Avg confidence across signers</span>
              <span className="analytics-value">{formatPct(signerStats.avgConfidenceBySigner)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
