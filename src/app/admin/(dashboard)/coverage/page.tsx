import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface LowConfidenceGesture {
  label: string;
  avg_confidence: number;
  count: number;
}

interface MissingItem {
  label: string;
  video_path?: string | null;
}

export default async function AdminCoveragePage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [
    { count: totalActive },
    { count: missingVideosCount },
    { data: replyLabelsRaw },
    { data: kbLabelsRaw },
    { data: allGestures },
    { data: logs },
  ] = await Promise.all([
    supabase
      .from("gestures")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("gestures")
      .select("*", { count: "exact", head: true })
      .is("video_path", null),
    supabase
      .from("gesture_reply_relationships")
      .select("gesture_label"),
    supabase
      .from("gesture_knowledge_base")
      .select("label"),
    supabase
      .from("gestures")
      .select("label, video_path")
      .eq("is_active", true),
    supabase
      .from("translation_logs")
      .select("gesture_label, confidence")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const replyLabels = new Set(replyLabelsRaw?.map((r) => r.gesture_label) ?? []);
  const kbLabels = new Set(kbLabelsRaw?.map((k) => k.label) ?? []);

  const gestures = (allGestures as MissingItem[]) ?? [];
  const missingVideos = gestures.filter((g) => !g.video_path);
  const missingReplies = gestures.filter((g) => !replyLabels.has(g.label));
  const missingKB = gestures.filter((g) => !kbLabels.has(g.label));

  const confMap = new Map<string, { total: number; count: number }>();
  for (const log of (logs as { gesture_label: string; confidence: number }[]) ?? []) {
    const entry = confMap.get(log.gesture_label) ?? { total: 0, count: 0 };
    entry.total += log.confidence;
    entry.count++;
    confMap.set(log.gesture_label, entry);
  }

  const lowConfidence: LowConfidenceGesture[] = Array.from(confMap.entries())
    .map(([label, { total, count }]) => ({ label, avg_confidence: total / count, count }))
    .sort((a, b) => a.avg_confidence - b.avg_confidence)
    .slice(0, 10);

  return (
    <div>
      <h2>Gesture Coverage Dashboard</h2>

      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total active gestures</span>
          <span className="analytics-value">{totalActive ?? 0}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Missing videos</span>
          <span className="analytics-value">{missingVideos.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Missing replies</span>
          <span className="analytics-value">{missingReplies.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Missing KB entries</span>
          <span className="analytics-value">{missingKB.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Low-confidence (30d)</span>
          <span className="analytics-value">{lowConfidence.length > 0 ? `${lowConfidence[0].label} (${(lowConfidence[0].avg_confidence * 100).toFixed(1)}%)` : "—"}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Lowest Confidence Gestures (last 30 days)</h3>
      {lowConfidence.length === 0 ? (
        <p className="panel-note">No prediction data in the last 30 days.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Label</th>
                <th>Avg confidence</th>
                <th>Predictions</th>
              </tr>
            </thead>
            <tbody>
              {lowConfidence.map((g, i) => (
                <tr key={g.label}>
                  <td>{i + 1}</td>
                  <td><code>{g.label}</code></td>
                  <td>{(g.avg_confidence * 100).toFixed(1)}%</td>
                  <td>{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Missing Videos</h3>
      {missingVideos.length === 0 ? (
        <p className="panel-note">All gestures have reference videos.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {missingVideos.map((g, i) => (
                <tr key={g.label}>
                  <td>{i + 1}</td>
                  <td><code>{g.label}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Missing Replies</h3>
      {missingReplies.length === 0 ? (
        <p className="panel-note">All gestures have at least one suggested reply.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {missingReplies.map((g, i) => (
                <tr key={g.label}>
                  <td>{i + 1}</td>
                  <td><code>{g.label}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Missing Knowledge Base Entries</h3>
      {missingKB.length === 0 ? (
        <p className="panel-note">All gestures have knowledge base entries.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {missingKB.map((g, i) => (
                <tr key={g.label}>
                  <td>{i + 1}</td>
                  <td><code>{g.label}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
