import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { buildResearchDataset } from "@/lib/supabase/queries/research";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminResearchPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const dataset = await buildResearchDataset(365);

  const [{ count: totalCorrections }, { count: totalTrainingSamples }] = await Promise.all([
    supabase.from("prediction_corrections" as any).select("*", { count: "exact", head: true }),
    supabase.from("training_samples" as any).select("*", { count: "exact", head: true }),
  ]);
  const totalAchievements = 0;

  return (
    <div>
      <h2>Research Dataset Builder</h2>
      <p className="panel-note">
        Generate anonymized research datasets for academic publications and thesis defense.
        All exports exclude personal identifiable information.
      </p>

      <h3 className="analytics-section-title">Dataset Summary (12 months)</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total recognitions</span>
          <span className="analytics-value">{dataset.stats.totalRecognitions}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">{(dataset.stats.avgConfidence * 100).toFixed(1)}%</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Corrections</span>
          <span className="analytics-value">{dataset.anonymizedCorrectionCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Training samples</span>
          <span className="analytics-value">{totalTrainingSamples ?? 0}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Conversations</span>
          <span className="analytics-value">{dataset.conversationCount}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Achievements unlocked</span>
          <span className="analytics-value">{totalAchievements ?? 0}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Correction flags</span>
          <span className="analytics-value">{totalCorrections ?? 0}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Gesture Distribution (Top 20)</h3>
      {dataset.stats.gestureDistribution.length === 0 ? (
        <p className="panel-note">No gesture data available.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Gesture</th>
                <th>Count</th>
                <th>% of total</th>
              </tr>
            </thead>
            <tbody>
              {dataset.stats.gestureDistribution.slice(0, 20).map((g, i) => (
                <tr key={g.label}>
                  <td>{i + 1}</td>
                  <td><code>{g.label}</code></td>
                  <td>{g.count}</td>
                  <td>{dataset.stats.totalRecognitions > 0
                    ? `${((g.count / dataset.stats.totalRecognitions) * 100).toFixed(1)}%`
                    : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">One-Click Export</h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="panel" style={{ padding: 16, flex: 1, minWidth: 280 }}>
          <h4 style={{ marginBottom: 8 }}>Thesis Package (CSV)</h4>
          <p style={{ fontSize: 13, marginBottom: 12, color: "#888" }}>
            Complete thesis export with conversations, evaluations, feedback, corrections,
            training samples, recognitions, and achievements. Ready for SPSS / Excel.
          </p>
          <a
            href="/api/admin/research/final-export"
            className="button"
            style={{ display: "inline-block" }}
          >
            Download CSV Export
          </a>
        </div>

        <div className="panel" style={{ padding: 16, flex: 1, minWidth: 280 }}>
          <h4 style={{ marginBottom: 8 }}>Research Dataset (JSON)</h4>
          <p style={{ fontSize: 13, marginBottom: 12, color: "#888" }}>
            Anonymized research dataset in JSON format. Includes recognition logs,
            corrections, conversations, and feedback suitable for data analysis.
          </p>
          <a
            href="/api/admin/research/export"
            className="button"
            style={{ display: "inline-block" }}
          >
            Download JSON Export
          </a>
        </div>
      </div>
    </div>
  );
}
