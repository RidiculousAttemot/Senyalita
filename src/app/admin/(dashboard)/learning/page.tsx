import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConfidenceAnalytics } from "@/lib/supabase/queries/knowledgeBase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLearningPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: pairs } = await supabase.from("gesture_confusion_pairs").select("*").order("count", { ascending: false });

  const analytics = await getConfidenceAnalytics(30);

  return (
    <div>
      <h2>Learning Analytics</h2>

      <h3>Confusion Pairs</h3>
      <table className="admin-table">
        <thead><tr><th>Gesture</th><th>Confused With</th><th>Count</th></tr></thead>
        <tbody>
          {(pairs ?? []).slice(0, 30).map((p) => (
            <tr key={p.id}><td><code>{p.gesture_label}</code></td><td><code>{p.confused_with}</code></td><td>{p.count}</td></tr>
          ))}
          {!pairs?.length && <tr><td colSpan={3} className="text-muted">No confusion data yet</td></tr>}
        </tbody>
      </table>

      <h3>Most Confident Gestures</h3>
      <table className="admin-table">
        <thead><tr><th>Gesture</th><th>Avg Confidence</th><th>Samples</th></tr></thead>
        <tbody>
          {analytics.highest.map((g) => (
            <tr key={g.label}><td><code>{g.label}</code></td><td>{(g.avgConfidence * 100).toFixed(0)}%</td><td>{g.count}</td></tr>
          ))}
        </tbody>
      </table>

      <h3>Least Confident Gestures (≥3 samples)</h3>
      <table className="admin-table">
        <thead><tr><th>Gesture</th><th>Avg Confidence</th><th>Samples</th></tr></thead>
        <tbody>
          {analytics.lowest.map((g) => (
            <tr key={g.label}><td><code>{g.label}</code></td><td>{(g.avgConfidence * 100).toFixed(0)}%</td><td>{g.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
