import { SystemHealthOverviewView } from "@/components/admin/SystemHealthOverviewView";
import { getCachedResult } from "@/features/recognition/model";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminSystemHealthPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: databaseError } = await supabase.from("translation_sessions").select("id").limit(1);
  const { data: storageFiles, error: storageError } = await supabase.storage.from("gesture-videos").list();
  const { count: totalPredictions } = await supabase.from("translation_logs").select("*", { count: "exact", head: true });
  const { count: recentPredictions } = await supabase.from("translation_logs").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo);
  const { data: recentLogs } = await supabase.from("translation_logs").select("inference_time_ms, recognition_source").gte("created_at", thirtyDaysAgo);
  const { count: aiRepliesSent, error: telemetryError } = await supabase.from("telemetry_events").select("*", { count: "exact", head: true }).eq("event_type", "ai_reply_used");
  const { count: selectedReplies } = await supabase.from("conversation_messages").select("*", { count: "exact", head: true }).eq("is_selected_reply", true);
  const { count: captureCount } = await supabase.from("gesture_captures").select("*", { count: "exact", head: true });
  const { count: pendingReviewCount } = await supabase.from("review_queue").select("*", { count: "exact", head: true }).eq("status", "pending");

  const logs = recentLogs ?? [];
  const averageLatencyMs = logs.length > 0 ? logs.reduce((sum, log) => sum + (log.inference_time_ms ?? 0), 0) / logs.length : null;
  const sourceBreakdown = logs.reduce<Record<string, number>>((sources, log) => {
    const source = log.recognition_source ?? "unknown";
    sources[source] = (sources[source] ?? 0) + 1;
    return sources;
  }, {});
  const telemetryAvailable = !telemetryError;

  return <SystemHealthOverviewView health={{
    aiAcceptanceRate: telemetryAvailable && aiRepliesSent && aiRepliesSent > 0 ? (selectedReplies ?? 0) / aiRepliesSent : null,
    aiRepliesSent: telemetryAvailable ? aiRepliesSent ?? null : null,
    averageLatencyMs,
    captureCount: captureCount ?? null,
    databaseAvailable: !databaseError,
    model: getCachedResult(),
    pendingReviewCount: pendingReviewCount ?? null,
    recentPredictions: recentPredictions ?? null,
    sourceBreakdown,
    storageAvailable: !storageError,
    storageFileCount: storageFiles?.filter((file) => file.id && !file.id.endsWith("/")).length ?? 0,
    telemetryAvailable,
    totalPredictions: totalPredictions ?? null,
  }} />;
}
