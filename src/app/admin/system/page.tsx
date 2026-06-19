import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedResult } from "@/features/recognition/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatPct = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};

export default async function AdminSystemHealthPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // ── Supabase connectivity ───────────────────────────────────────
  let dbOk = false;
  const { error: connErr } = await supabase
    .from("translation_sessions")
    .select("id")
    .limit(1);
  if (!connErr) dbOk = true;

  // ── Storage usage ────────────────────────────────────────────────
  let storageFileCount = 0;
  const { data: storageFiles, error: storageErr } = await supabase.storage
    .from("gesture-videos")
    .list();
  if (!storageErr && storageFiles) {
    storageFileCount = storageFiles.filter((f) => f.id && !f.id.endsWith("/")).length;
  }

  // ── Model status ─────────────────────────────────────────────────
  const modelResult = getCachedResult();

  // ── Recognition stats ────────────────────────────────────────────
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: totalPredictions } = await supabase
    .from("translation_logs")
    .select("*", { count: "exact", head: true });

  const { count: recentPredictions } = await supabase
    .from("translation_logs")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo);

  const { data: recentLogs } = await supabase
    .from("translation_logs")
    .select("inference_time_ms, recognition_source")
    .gte("created_at", thirtyDaysAgo);

  const recentCount = recentLogs?.length ?? 0;
  const avgLatency =
    recentCount > 0
      ? (recentLogs?.reduce(
          (s, l) => s + ((l as unknown as { inference_time_ms: number }).inference_time_ms ?? 0),
          0
        ) ?? 0) / recentCount
      : null;

  const sourceBreakdown: Record<string, number> = {};
  for (const log of recentLogs ?? []) {
    const src = (log as unknown as { recognition_source: string | null }).recognition_source ?? "unknown";
    sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + 1;
  }

  // ── AI stats ─────────────────────────────────────────────────────
  const { count: aiRepliesSent } = await supabase
    .from("telemetry_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "ai_reply_used");

  const { count: selectedReplies } = await supabase
    .from("conversation_messages")
    .select("*", { count: "exact", head: true })
    .eq("is_selected_reply", true);

  const aiAcceptanceRate =
    aiRepliesSent && aiRepliesSent > 0
      ? (selectedReplies ?? 0) / aiRepliesSent
      : null;

  // ── Storage / Capture stats ──────────────────────────────────────
  const { count: captureCount } = await supabase
    .from("gesture_captures")
    .select("*", { count: "exact", head: true });

  const { count: pendingReviewCount } = await supabase
    .from("review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div>
      <h2>System Health Center</h2>

      <h3 className="analytics-section-title">Supabase</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Database</span>
          <span
            className="analytics-value"
            style={{ color: dbOk ? "#22c55e" : "#ef4444" }}
          >
            {dbOk ? "Connected" : "Error"}
          </span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Storage (gesture-videos)</span>
          <span className="analytics-value">
            {storageErr ? "Error" : `${storageFileCount} files`}
          </span>
        </div>
      </div>

      <h3 className="analytics-section-title">Recognition</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Model status</span>
          <span className="analytics-value">{modelResult.status}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Total predictions</span>
          <span className="analytics-value">{totalPredictions ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Recent (30d)</span>
          <span className="analytics-value">{recentPredictions ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg latency (30d)</span>
          <span className="analytics-value">
            {avgLatency !== null ? `${avgLatency.toFixed(1)} ms` : "—"}
          </span>
        </div>
        {Object.entries(sourceBreakdown).length > 0 && (
          <div className="analytics-card" style={{ gridColumn: "1 / -1" }}>
            <span className="analytics-label">Source breakdown (30d)</span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              {Object.entries(sourceBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([src, count]) => (
                  <span key={src} style={{ fontSize: 13 }}>
                    <strong>{src}:</strong> {count}{" "}
                    <span style={{ color: "#888" }}>
                      ({((count / recentCount) * 100).toFixed(1)}%)
                    </span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      <h3 className="analytics-section-title">AI Assistant</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">AI replies sent</span>
          <span className="analytics-value">{aiRepliesSent ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Acceptance rate</span>
          <span className="analytics-value">{formatPct(aiAcceptanceRate)}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Storage</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Dataset captures</span>
          <span className="analytics-value">{captureCount ?? "—"}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Review queue pending</span>
          <span className="analytics-value">{pendingReviewCount ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
