import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAdminAnalytics } from "@/lib/supabase/queries/analytics";
import { listTelemetryEvents } from "@/lib/supabase/queries/telemetry";
import { getDashboardRecognitionSamples } from "@/lib/admin/dashboardRecognition";
import { computeAnimationCoverage } from "@/lib/admin/animationCoverage";
import { MODEL_LABELS } from "@/lib/admin/modelLabels";
import { DEPLOYED_MODEL } from "@/lib/admin/deployedModel";
import { getServiceStatus } from "@/lib/admin/dashboard";

const REVALIDATE = 60;

async function getSupabase() {
  return createSupabaseServerClient();
}

export async function getDashboardAnalytics(daysBack = 30) {
  const supabase = await getSupabase();
  return fetchAdminAnalytics(daysBack);
}

export async function getDashboardTelemetryEvents(limit = 100, daysBack = 14) {
  return listTelemetryEvents(undefined, limit, daysBack);
}

export async function getDashboardGestureCount() {
  const supabase = await getSupabase();
  const { count, error } = await supabase.from("gestures").select("id", { count: "exact", head: true });
  if (error) throw new Error(`getDashboardGestureCount: ${error.message}`);
  return count ?? 0;
}

export async function getDashboardTranslationLogs(daysBack = 14) {
  const supabase = await getSupabase();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const { data, error } = await supabase
    .from("translation_logs")
    .select("confidence, created_at, inference_time_ms")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1000); // Limit to last 1000 to prevent memory issues
  if (error) throw new Error(`getDashboardTranslationLogs: ${error.message}`);
  return data ?? [];
}

export async function getDashboardTodaySessionCount() {
  const supabase = await getSupabase();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("translation_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", startOfToday.toISOString());
  if (error) throw new Error(`getDashboardTodaySessionCount: ${error.message}`);
  return count ?? 0;
}

export async function getDashboardRecentLogs(limit = 20) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("translation_logs")
    .select("id, gesture_label, confidence, inference_time_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getDashboardRecentLogs: ${error.message}`);
  return data ?? [];
}

export async function getDashboardStorageAvailable() {
  const supabase = await getSupabase();
  const { error } = await supabase.storage.from("gesture-videos").list("", { limit: 1 });
  return !error;
}

export async function getDashboardAnimationAssets() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("animation_assets")
    .select("id, gloss, published_version_id")
    .limit(500); // Limit to prevent loading all assets at once
  if (error) throw new Error(`getDashboardAnimationAssets: ${error.message}`);
  return data ?? [];
}

export async function getDashboardAnimationVersions() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("animation_asset_versions")
    .select("status")
    .in("status", ["pending", "processing", "ready", "approved", "published", "archived"])
    .limit(500); // Limit to prevent loading all versions at once
  if (error) throw new Error(`getDashboardAnimationVersions: ${error.message}`);
  return data ?? [];
}

export async function getDashboardSystemHealth() {
  const supabase = await getSupabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    { error: databaseError },
    { data: storageFiles, error: storageError },
    { count: totalPredictions },
    { count: recentPredictions },
    { data: recentLogs },
    { count: aiRepliesSent, error: telemetryError },
    { count: selectedReplies },
    { count: captureCount },
    { count: pendingReviewCount },
  ] = await Promise.all([
    supabase.from("translation_sessions").select("id").limit(1),
    supabase.storage.from("gesture-videos").list(),
    supabase.from("translation_logs").select("*", { count: "exact", head: true }),
    supabase.from("translation_logs").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("translation_logs").select("inference_time_ms, recognition_source").gte("created_at", thirtyDaysAgo),
    supabase.from("telemetry_events").select("*", { count: "exact", head: true }).eq("event_type", "ai_reply_used"),
    supabase.from("conversation_messages").select("*", { count: "exact", head: true }).eq("is_selected_reply", true),
    supabase.from("gesture_captures").select("*", { count: "exact", head: true }),
    supabase.from("review_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const logs = recentLogs ?? [];
  const averageLatencyMs = logs.length > 0
    ? logs.reduce((sum, log) => sum + (log.inference_time_ms ?? 0), 0) / logs.length
    : null;
  const sourceBreakdown = logs.reduce<Record<string, number>>((sources, log) => {
    const source = log.recognition_source ?? "unknown";
    sources[source] = (sources[source] ?? 0) + 1;
    return sources;
  }, {});
  const telemetryAvailable = !telemetryError;

  return {
    aiAcceptanceRate: telemetryAvailable && aiRepliesSent && aiRepliesSent > 0 ? (selectedReplies ?? 0) / aiRepliesSent : null,
    aiRepliesSent: telemetryAvailable ? aiRepliesSent ?? null : null,
    averageLatencyMs,
    captureCount: captureCount ?? null,
    databaseAvailable: !databaseError,
    pendingReviewCount: pendingReviewCount ?? null,
    recentPredictions: recentPredictions ?? null,
    sourceBreakdown,
    storageAvailable: !storageError,
    storageFileCount: storageFiles?.filter((file) => file.id && !file.id.endsWith("/")).length ?? 0,
    telemetryAvailable,
    totalPredictions: totalPredictions ?? null,
  };
}

export async function getDashboardData() {
  const [
    analytics,
    telemetryEvents,
    gestureCount,
    confidenceResult,
    sessionCount,
    recentLogResult,
    storageAvailable,
    animationAssetsResult,
    animationVersionsResult,
  ] = await Promise.all([
    getDashboardAnalytics(30),
    getDashboardTelemetryEvents(100, 14),
    getDashboardGestureCount(),
    getDashboardTranslationLogs(14),
    getDashboardTodaySessionCount(),
    getDashboardRecentLogs(20),
    getDashboardStorageAvailable(),
    getDashboardAnimationAssets(),
    getDashboardAnimationVersions(),
  ]);

  const recognitionData = getDashboardRecognitionSamples({
    logs: confidenceResult.map((log) => ({
      confidence: log.confidence,
      created_at: log.created_at,
      inference_time_ms: log.inference_time_ms,
    })),
    telemetryEvents: telemetryEvents.map((event) => ({
      event_type: event.event_type,
      confidence: event.confidence,
      created_at: event.created_at,
      event_data: event.event_data,
    })),
  });
  const confidenceAvailable = confidenceResult.length > 0 || telemetryEvents.length > 0;
  const confidenceValues = recognitionData.samples.map((sample) => sample.confidence);
  const currentConfidence = confidenceValues.length
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : null;
  const highConfidenceRate = confidenceValues.length
    ? confidenceValues.filter((value) => value >= 0.6).length / confidenceValues.length
    : null;
  const dailyCounts = analytics.daily_counts.length
    ? analytics.daily_counts.slice(-14).map((entry) => entry.count)
    : Array.from(new Map(recognitionData.samples.map((sample) => [sample.createdAt.slice(0, 10), 0])).entries()).map(([day]) =>
        recognitionData.samples.filter((sample) => sample.createdAt.startsWith(day)).length,
      );
  const telemetryInferenceTimes = recognitionData.samples.flatMap((sample) =>
    sample.inferenceTimeMs === null ? [] : [sample.inferenceTimeMs],
  );
  const inferredLatency = telemetryInferenceTimes.length
    ? telemetryInferenceTimes.reduce((total, value) => total + value, 0) / telemetryInferenceTimes.length
    : null;
  const inferenceLatency = analytics.totals.avg_inference_ms ?? inferredLatency;
  const recognitionEventCount = analytics.recognition.this_month || recognitionData.samples.length;
  const recognitionSourceNote = recognitionData.source === "telemetry"
    ? "Based on browser recognition telemetry from the last 14 days"
    : recognitionData.source === "translation logs"
      ? "Based on translation logs from the last 14 days"
      : "No recognition activity recorded in the last 14 days";
  const failedTranslations = telemetryEvents.filter((event) => event.event_type === "translation_failed").length;

  const animationAssetsData = animationAssetsResult;
  const animationTotal = animationAssetsData.length;
  const publishedGlosses = animationAssetsData
    .filter((a) => a.published_version_id && a.gloss)
    .map((a) => a.gloss);
  const coverage = computeAnimationCoverage(MODEL_LABELS, publishedGlosses);
  const animationVersions = animationVersionsResult;
  const animationPublished = animationVersions.filter((v) => v.status === "published").length;
  const animationPending = animationVersions.filter((v) => v.status === "pending" || v.status === "processing").length;
  const animationApproved = animationVersions.filter((v) => v.status === "approved").length;

  const services = [
    {
      name: "Recognition engine",
      ...getServiceStatus({
        hasData: telemetryEvents.length > 0 || confidenceAvailable,
        isOperational: telemetryEvents.length > 0 ? failedTranslations === 0 : currentConfidence === null || currentConfidence >= 0.6,
        detail: telemetryEvents.length > 0
          ? (failedTranslations ? `${failedTranslations} translation failure${failedTranslations === 1 ? "" : "s"} in recent telemetry` : "Recognition telemetry is flowing")
          : confidenceAvailable
            ? (currentConfidence === null ? "No recognition activity recorded in the last 14 days" : "Recognition logs are available")
            : "Recognition logs could not be read",
      }),
    },
    {
      name: "MediaPipe",
      ...getServiceStatus({
        hasData: confidenceAvailable,
        isOperational: currentConfidence === null || currentConfidence >= 0.6,
        detail: confidenceAvailable
          ? (currentConfidence === null ? "No browser recognition activity recorded yet" : "Browser recognition logs are available")
          : "Browser recognition logs could not be read",
      }),
    },
    {
      name: "TensorFlow.js",
      ...getServiceStatus({
        hasData: confidenceAvailable,
        isOperational: currentConfidence === null || currentConfidence >= 0.6,
        detail: confidenceAvailable
          ? (currentConfidence === null ? "No browser inference activity recorded yet" : "Browser inference results are available")
          : "Browser inference logs could not be read",
      }),
    },
    {
      name: "Animation engine",
      ...getServiceStatus({
        hasData: true,
        isOperational: animationPublished > 0,
        detail: animationPublished > 0 ? `${animationPublished} published animations available` : "No published animations yet",
      }),
    },
    {
      name: "Supabase",
      ...getServiceStatus({
        hasData: true,
        isOperational: true,
        detail: telemetryEvents.length > 0 ? "Analytics and telemetry queries responded" : "Analytics queries responded; telemetry is not configured",
      }),
    },
    {
      name: "Storage",
      ...getServiceStatus({
        hasData: storageAvailable,
        isOperational: storageAvailable,
        detail: storageAvailable ? "Gesture asset storage is reachable" : "Gesture asset storage could not be reached",
      }),
    },
  ];

  return {
    analytics,
    telemetryEvents,
    recognitionData,
    confidenceAvailable,
    currentConfidence,
    highConfidenceRate,
    dailyCounts,
    inferenceLatency,
    recognitionEventCount,
    recognitionSourceNote,
    failedTranslations,
    gestureCount,
    sessionCount,
    recentLogResult,
    storageAvailable,
    animationTotal,
    publishedGlosses,
    coverage,
    animationPublished,
    animationPending,
    animationApproved,
    services,
  };
}