import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowUpRight, BarChart3, BrainCircuit, Camera, Clock3, Database, Film, Gauge, Sparkles, Wand2, WandSparkles, BookOpen } from "lucide-react";
import { fetchAdminAnalytics } from "@/lib/supabase/queries/analytics";
import { listTelemetryEvents } from "@/lib/supabase/queries/telemetry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAdminPercent, getServiceStatus, isTelemetryUnavailableError } from "@/lib/admin/dashboard";
import { getMetricDisplay } from "@/lib/admin/dashboardMetrics";
import { getDashboardRecognitionSamples } from "@/lib/admin/dashboardRecognition";
import AdminDataTable, { type AdminDataTableRow } from "./AdminDataTable";
import { DashboardServiceGrid } from "./DashboardServiceGrid";
import { detectMissingAnimations } from "@/features/ai-assist";

type TrendDirection = "up" | "down" | "steady";

const metricTone = (direction: TrendDirection) => direction === "up" ? "is-up" : direction === "down" ? "is-down" : "is-steady";

const getActivityDetail = (eventType: string, payload: Record<string, unknown>): string => {
  for (const key of ["message", "error", "model_version", "trigger_reason", "label", "gesture_label"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  if (eventType === "retraining_started") return "Retraining workflow queued";
  if (eventType === "retraining_completed") return "Candidate model validation completed";
  if (eventType === "translation_failed") return "Translation error captured for review";
  return "Telemetry event captured";
};

const getSeverity = (eventType: string): AdminDataTableRow["severity"] => {
  if (eventType === "translation_failed" || eventType === "retraining_started") return "high";
  if (eventType === "low_confidence" || eventType === "model_prediction") return "medium";
  return "low";
};

const getStatus = (eventType: string): string => {
  if (eventType === "translation_failed") return "Needs review";
  if (eventType === "retraining_started") return "Running";
  if (eventType === "retraining_completed") return "Complete";
  if (eventType === "admin_login") return "Authenticated";
  return "Recorded";
};

const sparklinePath = (values: number[]): string => {
  if (!values.length) return "";
  const width = 280;
  const height = 88;
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const range = Math.max(maximum - minimum, 1);

  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - minimum) / range) * 70 - 9;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
};

function TrendCard({ title, note, values, accent }: { title: string; note: string; values: number[]; accent: string }) {
  const path = sparklinePath(values);

  return (
    <article className="admin-panel admin-trend-card">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-overline">Operational trend</p>
          <h2>{title}</h2>
        </div>
        <span className="admin-period-tag">14 days</span>
      </div>
      {path ? (
        <svg className="admin-trend-chart" viewBox="0 0 280 88" role="img" aria-label={`${title} trend over fourteen days`}>
          <path d="M0 79 H280" stroke="#e8e4dd" strokeWidth="1" />
          <path d={path} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : <div className="admin-chart-empty">No data connected</div>}
      <p className="admin-panel-note">{note}</p>
    </article>
  );
}

function MetricCard({ icon: Icon, label, value, note, direction }: { icon: LucideIcon; label: string; value: string; note: string; direction?: TrendDirection }) {
  return (
    <article className="admin-metric-card">
      <div className="admin-metric-card-head">
        <span className="admin-metric-icon"><Icon size={17} strokeWidth={1.9} /></span>
        {direction && <span className={`admin-metric-trend ${metricTone(direction)}`}>{direction === "up" ? "Improving" : direction === "down" ? "Review" : "Stable"}</span>}
      </div>
      <p className="admin-metric-label">{label}</p>
      <strong className="admin-metric-value">{value}</strong>
      <p className="admin-metric-note">{note}</p>
    </article>
  );
}

export default async function AdminDashboardOverview() {
  const supabase = await createSupabaseServerClient();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [analytics, telemetryResult, gestureResult, confidenceResult, sessionResult, recentLogResult, activeModelResult, storageResult, animationAssetsResult, animationVersionsResult] = await Promise.all([
    fetchAdminAnalytics(30),
    listTelemetryEvents(undefined, 100, 14)
      .then((events) => ({ events, available: true, missingTable: false }))
      .catch((error: unknown) => {
        const missingTable = isTelemetryUnavailableError(error);
        console.warn("Admin telemetry is unavailable:", error);
        return { events: [], available: false, missingTable };
      }),
    supabase.from("gestures").select("id", { count: "exact", head: true }),
    supabase.from("translation_logs").select("confidence, created_at, inference_time_ms").gte("created_at", fourteenDaysAgo).order("created_at", { ascending: true }),
    supabase.from("translation_sessions").select("id", { count: "exact", head: true }).gte("started_at", startOfToday.toISOString()),
    supabase.from("translation_logs").select("id, gesture_label, confidence, inference_time_ms, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("model_versions").select("version, architecture, accuracy, num_classes").eq("is_active", true).maybeSingle(),
    supabase.storage.from("gesture-videos").list("", { limit: 1 }),
    supabase.from("animation_assets").select("id, gloss"),
    supabase.from("animation_asset_versions").select("status").in("status", ["pending", "processing", "ready", "approved", "published", "archived"]),
  ]);

  const telemetryEvents = telemetryResult.events;
  const recognitionData = getDashboardRecognitionSamples({
    logs: confidenceResult.data ?? [],
    telemetryEvents,
  });
  const confidenceAvailable = !confidenceResult.error || telemetryResult.available;
  const sessionsAvailable = !sessionResult.error;
  const gesturesAvailable = !gestureResult.error;
  const recentLogsAvailable = !recentLogResult.error;
  const modelAvailable = !activeModelResult.error;
  const storageAvailable = !storageResult.error;
  const activeModel = activeModelResult.data;
  const activeModelName = activeModel ? `${activeModel.architecture} ${activeModel.version}` : null;
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
  const telemetryInferenceTimes = recognitionData.samples.flatMap((sample) => sample.inferenceTimeMs === null ? [] : [sample.inferenceTimeMs]);
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
  const telemetryRows: AdminDataTableRow[] = telemetryEvents.map((event) => ({
    id: event.id,
    timestamp: event.created_at,
    category: event.event_type.replace(/_/g, " "),
    item: event.gesture_label ?? event.event_type,
    detail: getActivityDetail(event.event_type, event.event_data),
    severity: getSeverity(event.event_type),
    status: getStatus(event.event_type),
  }));
  const recognitionRows: AdminDataTableRow[] = (recentLogResult.data ?? []).map((log) => ({
    id: log.id,
    timestamp: log.created_at,
    category: "recognition",
    item: log.gesture_label,
    detail: `${formatAdminPercent(log.confidence)} confidence, ${Number(log.inference_time_ms).toFixed(1)} ms inference`,
    severity: log.confidence < 0.6 ? "medium" : "low",
    status: log.confidence < 0.6 ? "Low confidence" : "Recorded",
  }));
  const activityRows = telemetryResult.available ? telemetryRows : recognitionRows;
  const recognitionOperational = currentConfidence === null || currentConfidence >= 0.6;

  const animationAssetsAvailable = !animationAssetsResult.error;
  const animationVersionsAvailable = !animationVersionsResult.error;
  const animationAssetsData = animationAssetsResult.data as { id: string; gloss: string }[] | null;
  const animationTotal = animationAssetsData?.length ?? 0;
  const animationGlosses = (animationAssetsData ?? []).map((a) => a.gloss).filter(Boolean);
  const coverageReport = animationGlosses.length > 0
    ? detectMissingAnimations(animationGlosses)
    : null;
  const animationVersions = animationVersionsResult.data ?? [];
  const animationPublished = animationVersions.filter((v) => v.status === "published").length;
  const animationPending = animationVersions.filter((v) => v.status === "pending" || v.status === "processing").length;
  const animationApproved = animationVersions.filter((v) => v.status === "approved").length;

  const services = [
    { name: "Recognition engine", ...getServiceStatus({ hasData: telemetryResult.available || confidenceAvailable, isOperational: telemetryResult.available ? failedTranslations === 0 : recognitionOperational, detail: telemetryResult.available ? (failedTranslations ? `${failedTranslations} translation failure${failedTranslations === 1 ? "" : "s"} in recent telemetry` : "Recognition telemetry is flowing") : confidenceAvailable ? (currentConfidence === null ? "No recognition activity recorded in the last 14 days" : "Recognition logs are available") : "Recognition logs could not be read" }) },
    { name: "MediaPipe", ...getServiceStatus({ hasData: confidenceAvailable, isOperational: recognitionOperational, detail: confidenceAvailable ? (currentConfidence === null ? "No browser recognition activity recorded yet" : "Browser recognition logs are available") : "Browser recognition logs could not be read" }) },
    { name: "TensorFlow.js", ...getServiceStatus({ hasData: confidenceAvailable, isOperational: recognitionOperational, detail: confidenceAvailable ? (currentConfidence === null ? "No browser inference activity recorded yet" : "Browser inference results are available") : "Browser inference logs could not be read" }) },
    { name: "Animation engine", ...getServiceStatus({ hasData: animationAssetsAvailable, isOperational: animationPublished > 0, detail: animationAssetsAvailable ? (animationPublished > 0 ? `${animationPublished} published animations available` : "No published animations yet") : "Animation data unavailable" }) },
    { name: "Supabase", ...getServiceStatus({ hasData: true, isOperational: true, detail: telemetryResult.available ? "Analytics and telemetry queries responded" : "Analytics queries responded; telemetry is not configured" }) },
    { name: "Storage", ...getServiceStatus({ hasData: storageAvailable, isOperational: storageAvailable, detail: storageAvailable ? "Gesture asset storage is reachable" : "Gesture asset storage could not be reached" }) },
  ];

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Senyalita AI Operations</p>
          <h1>System overview</h1>
          <p className="admin-dashboard-subtitle">Monitor recognition quality, model activity, and the workflows that keep Filipino Sign Language translation reliable.</p>
        </div>
        <div className="admin-dashboard-actions">
          <Link href="/admin/training" className="admin-action-button"><BrainCircuit size={16} /> Start Recognition Training</Link>
          <Link href="/admin/animation-studio" className="admin-action-button admin-action-button-primary"><Wand2 size={16} /> Create Animation</Link>
          <Link href="/admin/animation-library" className="admin-action-button"><Film size={16} /> Open Animation Library</Link>
          <Link href="/admin/analytics" className="admin-action-button"><BarChart3 size={16} /> View Analytics</Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="System performance metrics">
        <MetricCard icon={Gauge} label="Model accuracy" value={getMetricDisplay({ value: activeModel?.accuracy, available: modelAvailable, format: (value) => formatAdminPercent(value) })} note={modelAvailable ? (activeModel ? "Active model registry entry" : "No active model is configured") : "Model registry could not be read"} direction={activeModel?.accuracy === null || activeModel?.accuracy === undefined ? undefined : "steady"} />
        <MetricCard icon={Activity} label="Recognition confidence" value={getMetricDisplay({ value: currentConfidence, available: confidenceAvailable, format: (value) => formatAdminPercent(value) })} note={confidenceAvailable ? recognitionSourceNote : "Recognition data could not be read"} direction={currentConfidence === null ? undefined : currentConfidence < 0.7 ? "down" : "up"} />
        <MetricCard icon={Database} label="Library gestures" value={getMetricDisplay({ value: gestureResult.count, available: gesturesAvailable })} note={gesturesAvailable ? "Gesture definitions in the library" : "Gesture library could not be read"} />
        <MetricCard icon={Clock3} label="Camera sessions today" value={getMetricDisplay({ value: sessionResult.count, available: sessionsAvailable })} note={sessionsAvailable ? "Sessions started since midnight" : "Session data could not be read"} />
        <MetricCard icon={Sparkles} label="Recognition events" value={recognitionEventCount.toLocaleString()} note={recognitionData.source === "telemetry" ? "Browser telemetry from the last 14 days" : "Activity across the last 30 days"} />
        <MetricCard icon={WandSparkles} label="High-confidence recognition" value={getMetricDisplay({ value: highConfidenceRate, available: confidenceAvailable, format: (value) => formatAdminPercent(value) })} note="Recognitions at or above the configured confidence threshold" direction={highConfidenceRate === null ? undefined : highConfidenceRate < 0.8 ? "down" : "up"} />
        <MetricCard icon={BrainCircuit} label="Active model" value={activeModelName ?? (modelAvailable ? "No active model" : "Unavailable")} note={modelAvailable ? "Configured in the model registry" : "Model registry could not be read"} direction={activeModel ? "steady" : undefined} />
        <MetricCard icon={Gauge} label="Inference latency" value={getMetricDisplay({ value: inferenceLatency, available: confidenceAvailable, format: (value) => `${value.toFixed(1)} ms` })} note={recognitionData.source === "telemetry" ? "Browser inference time from the last 14 days" : "Average browser inference time over the last 30 days"} />
      </section>

      <section className="admin-metric-grid" aria-label="Animation pipeline metrics">
        <MetricCard icon={Film} label="Animation assets" value={getMetricDisplay({ value: animationTotal, available: animationAssetsAvailable })} note={animationAssetsAvailable ? "Total animation assets in library" : "Animation asset data unavailable"} />
        <MetricCard icon={Wand2} label="Published animations" value={getMetricDisplay({ value: animationPublished, available: animationVersionsAvailable })} note={animationVersionsAvailable ? "Published and available for Type-to-Sign" : "Version data unavailable"} />
        <MetricCard icon={Sparkles} label="Pending review" value={getMetricDisplay({ value: animationPending, available: animationVersionsAvailable })} note={animationVersionsAvailable ? "Awaiting extraction or admin review" : "Version data unavailable"} />
        <MetricCard icon={Database} label="Approved assets" value={getMetricDisplay({ value: animationApproved, available: animationVersionsAvailable })} note={animationVersionsAvailable ? "Approved, ready to publish" : "Version data unavailable"} />
      </section>

      {coverageReport && (
        <section className="admin-panel" style={{ marginBottom: 24 }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-overline">Gloss coverage</p>
              <h2>Animation library coverage</h2>
            </div>
            <Link href="/admin/animation-studio" className="admin-inline-link">Animation Studio <ArrowUpRight size={15} /></Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "0 20px 20px" }}>
            <article className="admin-metric-card">
              <p className="admin-metric-label">Coverage</p>
              <strong className="admin-metric-value" style={{ color: coverageReport.coveragePercent > 70 ? "#4ade80" : coverageReport.coveragePercent > 40 ? "#fde68a" : "#f87171" }}>
                {coverageReport.coveragePercent}%
              </strong>
              <p className="admin-metric-note">{coverageReport.coveredGlosses} of {coverageReport.totalGlosses} glosses in library</p>
            </article>
            <article className="admin-metric-card">
              <p className="admin-metric-label">Missing animations</p>
              <strong className="admin-metric-value">{coverageReport.missingGlosses}</strong>
              <p className="admin-metric-note">{coverageReport.missingEntries.filter((e) => e.priority === "high").length} high priority</p>
            </article>
            <article className="admin-metric-card">
              <p className="admin-metric-label">Next to create</p>
              <strong className="admin-metric-value" style={{ fontSize: 14, fontFamily: "monospace" }}>
                {coverageReport.missingEntries[0]?.gloss ?? "—"}
              </strong>
              <p className="admin-metric-note">{coverageReport.missingEntries[0]?.reason ?? "All glosses covered"}</p>
            </article>
          </div>
        </section>
      )}

      <section className="admin-status-panel admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-overline">Realtime system status</p>
            <h2>Operational services</h2>
          </div>
          <Link href="/admin/system" className="admin-inline-link">System health <ArrowUpRight size={15} /></Link>
        </div>
        <DashboardServiceGrid services={services} />
      </section>

      <section className="admin-chart-grid" aria-label="Recognition performance charts">
        <TrendCard title="Recognition usage" note="Daily recognition and translation activity" values={dailyCounts} accent="#c96745" />
        <TrendCard title="Confidence profile" note={recognitionSourceNote} values={confidenceValues.slice(-14)} accent="#236f83" />
      </section>

      <section className="admin-dashboard-secondary-grid">
        <article className="admin-panel admin-quick-actions">
          <div className="admin-panel-heading">
            <div><p className="admin-overline">Command center</p><h2>Continue a workflow</h2></div>
          </div>
          <div className="admin-quick-action-grid">
            <Link href="/admin/animation-studio">Create Animation <ArrowUpRight size={15} /></Link>
            <Link href="/admin/animation-library">Animation Library <ArrowUpRight size={15} /></Link>
            <Link href="/admin/training">Start Training <ArrowUpRight size={15} /></Link>
            <Link href="/admin/collection">Dataset Manager <ArrowUpRight size={15} /></Link>
            <Link href="/admin/analytics">View Analytics <ArrowUpRight size={15} /></Link>
          </div>
        </article>
        <article className="admin-panel admin-model-summary">
          <p className="admin-overline">Production model</p>
          <h2>{activeModelName ?? (modelAvailable ? "No active model" : "Model registry unavailable")}</h2>
          <p>{activeModel ? "The model currently marked active for the browser recognition workflow." : "Model deployment details are available in model management."}</p>
          <div className="admin-model-summary-stats"><span><strong>{getMetricDisplay({ value: activeModel?.accuracy, available: modelAvailable, format: (value) => formatAdminPercent(value) })}</strong> validated accuracy</span><span><strong>{getMetricDisplay({ value: activeModel?.num_classes, available: modelAvailable })}</strong> configured classes</span></div>
          <Link href="/admin/models" className="admin-inline-link">Open model management <ArrowUpRight size={15} /></Link>
        </article>
      </section>

      <section className="admin-panel admin-activity-panel">
        <div className="admin-panel-heading">
          <div><p className="admin-overline">Recent activity</p><h2>Telemetry and system events</h2></div>
          <Link href="/admin/audits" className="admin-inline-link">View audits <ArrowUpRight size={15} /></Link>
        </div>
        {activityRows.length ? (
          <AdminDataTable rows={activityRows} />
        ) : (
          <p className="admin-panel-note">
            {recentLogsAvailable
              ? "No recognition or telemetry activity has been recorded yet."
              : "Recent activity could not be read. Check the dashboard data source and try again."}
          </p>
        )}
      </section>
    </section>
  );
}