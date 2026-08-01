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

  const [
    { error: databaseError },
    { data: storageFiles, error: storageError },
    { count: totalPredictions },
    { count: recentPredictions },
    { data: recentLogs },
    { count: telemetryCount, error: telemetryError },
    { count: animationAssetCount, error: animationAssetsError },
    { data: animationVersions },
  ] = await Promise.all([
    supabase.from("translation_sessions").select("id").limit(1),
    supabase.storage.from("gesture-videos").list(),
    supabase.from("translation_logs").select("*", { count: "exact", head: true }),
    supabase.from("translation_logs").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("translation_logs").select("inference_time_ms, recognition_source").gte("created_at", thirtyDaysAgo),
    supabase.from("telemetry_events").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("animation_assets").select("*", { count: "exact", head: true }),
    supabase.from("animation_asset_versions").select("status"),
  ]);

  const logs = recentLogs ?? [];
  const averageLatencyMs = logs.length > 0 ? logs.reduce((sum, log) => sum + (log.inference_time_ms ?? 0), 0) / logs.length : null;
  const sourceBreakdown = logs.reduce<Record<string, number>>((sources, log) => {
    const source = log.recognition_source ?? "unknown";
    sources[source] = (sources[source] ?? 0) + 1;
    return sources;
  }, {});

  const versions = animationVersions ?? [];
  const animationPublishedCount = versions.filter((v) => v.status === "published").length;
  const animationExtractionQueueCount = versions.filter((v) => v.status === "pending" || v.status === "processing").length;

  return <SystemHealthOverviewView health={{
    animationAssetCount: animationAssetsError ? null : animationAssetCount ?? null,
    animationExtractionQueueCount,
    animationPublishedCount,
    averageLatencyMs,
    databaseAvailable: !databaseError,
    model: getCachedResult(),
    recentPredictions: recentPredictions ?? null,
    sourceBreakdown,
    storageAvailable: !storageError,
    storageFileCount: storageFiles?.filter((file) => file.id && !file.id.endsWith("/")).length ?? 0,
    telemetryAvailable: !telemetryError && telemetryCount !== null,
    totalPredictions: totalPredictions ?? null,
  }} />;
}
