import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowUpRight, BrainCircuit, Clock3, Database, Film, Gauge, Sparkles, Wand2, WandSparkles } from "lucide-react";
import { fetchAdminAnalytics } from "@/lib/supabase/queries/analytics";
import { listTelemetryEvents } from "@/lib/supabase/queries/telemetry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAdminPercent, getServiceStatus, isTelemetryUnavailableError } from "@/lib/admin/dashboard";
import { getMetricDisplay } from "@/lib/admin/dashboardMetrics";
import { getDashboardRecognitionSamples } from "@/lib/admin/dashboardRecognition";
import AdminDataTable, { type AdminDataTableRow } from "./AdminDataTable";
import { DashboardServiceGrid } from "./DashboardServiceGrid";
import { computeAnimationCoverage } from "@/lib/admin/animationCoverage";
import { MODEL_LABELS } from "@/lib/admin/modelLabels";
import { DEPLOYED_MODEL } from "@/lib/admin/deployedModel";
import { buildTrendChart, TREND_CHART_HEIGHT, TREND_CHART_WIDTH } from "@/lib/admin/trendChart";

type TrendDirection = "up" | "down" | "steady";

/**
 * How many missing glosses to name before summarising the rest. At 94 missing
 * the full list is a wall of text that stops being read; a couple of rows is
 * enough to answer "what should I record next".
 */
const MISSING_PREVIEW = 24;

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

function TrendCard({ eyebrow, title, note, values, accent, unit }: {
  eyebrow: string;
  title: string;
  note: string;
  values: number[];
  accent: string;
  unit: string;
}) {
  const chart = buildTrendChart(values);
  const viewBox = `0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`;

  return (
    <article className="admin-panel admin-trend-card">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-overline">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="admin-period-tag">14 days</span>
      </div>
      {chart.kind === "empty" ? (
        <div className="admin-chart-empty">No data yet</div>
      ) : (
        <svg className="admin-trend-chart" viewBox={viewBox} role="img" aria-label={`${title} over the last 14 days`}>
          <path d={`M0 79 H${TREND_CHART_WIDTH}`} stroke="#E2E8F0" strokeWidth="1" />
          {chart.kind === "point" ? (
            <circle cx={chart.point.x} cy={chart.point.y.toFixed(1)} r="4.5" fill={accent} />
          ) : (
            <path d={chart.path} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      )}
      <p className="admin-panel-note">
        {chart.kind === "point"
          ? `${note}. Only one ${unit} of activity so far, so there is no trend to draw yet.`
          : note}
      </p>
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

  // model_versions is deliberately not queried. See lib/admin/deployedModel.ts:
  // the table does not exist here and nothing in the app writes it, so asking
  // produced three permanent "Unavailable" surfaces and no information.
  const [analytics, telemetryResult, gestureResult, confidenceResult, sessionResult, recentLogResult, storageResult, animationAssetsResult, animationVersionsResult] = await Promise.all([
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
    supabase.storage.from("gesture-videos").list("", { limit: 1 }),
    supabase.from("animation_assets").select("id, gloss, published_version_id"),
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
  const storageAvailable = !storageResult.error;
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
  const animationAssetsData = animationAssetsResult.data as { id: string; gloss: string; published_version_id: string | null }[] | null;
  const animationTotal = animationAssetsData?.length ?? 0;
  // Only a published version is visible to the public app, so only a published
  // version counts as covered. The previous card counted every row, which meant
  // an upload raised coverage before anyone had approved it.
  const publishedGlosses = (animationAssetsData ?? [])
    .filter((a) => a.published_version_id && a.gloss)
    .map((a) => a.gloss);
  const coverage = animationAssetsAvailable
    ? computeAnimationCoverage(MODEL_LABELS, publishedGlosses)
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
          <Link href="/admin/animation-studio" className="admin-action-button admin-action-button-primary"><Wand2 size={16} /> Create Animation</Link>
          <Link href="/admin/animation-library" className="admin-action-button"><Film size={16} /> Open Animation Library</Link>
          <Link href="/admin/animation-dataset" className="admin-action-button"><Database size={16} /> Animation Dataset</Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="System performance metrics">
        <MetricCard icon={BrainCircuit} label="Deployed model" value={DEPLOYED_MODEL.architecture} note={`${DEPLOYED_MODEL.classes} recognisable classes · ${DEPLOYED_MODEL.format}`} direction="steady" />
        <MetricCard icon={Activity} label="Recognition confidence" value={getMetricDisplay({ value: currentConfidence, available: confidenceAvailable, format: (value) => formatAdminPercent(value) })} note={confidenceAvailable ? `Mean of ${confidenceValues.length.toLocaleString()} recognitions. ${recognitionSourceNote}` : "Recognition data could not be read"} direction={currentConfidence === null ? undefined : currentConfidence < 0.7 ? "down" : "up"} />
        {/*
          This card read "Library gestures 36" next to "Animation assets 38"
          and "37 of 131", and the three looked like one quantity measured
          badly. They are three unrelated sets, so the note names the other two
          rather than leaving the reader to guess which is which.
        */}
        <MetricCard
          icon={Database}
          label="Reference gesture catalogue"
          value={getMetricDisplay({ value: gestureResult.count, available: gesturesAvailable })}
          note={gesturesAvailable
            ? `Rows in the gestures table — a curated reference list. Not the ${animationAssetsAvailable ? `${animationTotal} animated glosses` : "animated glosses"}, and not the ${MODEL_LABELS.length} classes the model recognises`
            : "Gesture library could not be read"}
        />
        <MetricCard icon={Clock3} label="Camera sessions today" value={getMetricDisplay({ value: sessionResult.count, available: sessionsAvailable })} note={sessionsAvailable ? "Sessions started since midnight" : "Session data could not be read"} />
        <MetricCard icon={Sparkles} label="Recognition events" value={recognitionEventCount.toLocaleString()} note={recognitionData.source === "telemetry" ? "Browser telemetry from the last 14 days" : "Activity across the last 30 days"} />
        <MetricCard icon={WandSparkles} label="High-confidence recognition" value={getMetricDisplay({ value: highConfidenceRate, available: confidenceAvailable, format: (value) => formatAdminPercent(value) })} note="Share of recognitions at or above the 60% confidence threshold" direction={highConfidenceRate === null ? undefined : highConfidenceRate < 0.8 ? "down" : "up"} />
        <MetricCard icon={Gauge} label="Inference latency" value={getMetricDisplay({ value: inferenceLatency, available: confidenceAvailable, format: (value) => `${value.toFixed(1)} ms` })} note={recognitionData.source === "telemetry" ? "Browser inference time from the last 14 days" : "Average browser inference time over the last 30 days"} />
      </section>

      {/*
        These four sat next to "36" and "37" elsewhere on the page and read as
        four attempts at one quantity. They are four different quantities, and
        each label now names its own noun and denominator:
          animation_assets rows            -- one per gloss
          versions at status='published'   -- one per live version
          versions mid-pipeline            -- pending + processing
          versions at status='approved'    -- a QUEUE, drained by publishing
      */}
      <section className="admin-metric-grid" aria-label="Animation pipeline metrics">
        <MetricCard icon={Film} label="Glosses with an animation" value={getMetricDisplay({ value: animationTotal, available: animationAssetsAvailable })} note={animationAssetsAvailable ? "Rows in animation_assets — one per gloss, counting every version" : "Animation asset data unavailable"} />
        <MetricCard icon={Wand2} label="Live published versions" value={getMetricDisplay({ value: animationPublished, available: animationVersionsAvailable })} note={animationVersionsAvailable ? `Serving Type-to-Sign now. ${animationTotal === animationPublished ? "Every gloss has exactly one" : "One per published gloss"}` : "Version data unavailable"} />
        <MetricCard icon={Sparkles} label="In the pipeline" value={getMetricDisplay({ value: animationPending, available: animationVersionsAvailable })} note={animationVersionsAvailable ? "Versions still extracting or awaiting review" : "Version data unavailable"} />
        <MetricCard icon={Database} label="Approved, awaiting publish" value={getMetricDisplay({ value: animationApproved, available: animationVersionsAvailable })} note={animationVersionsAvailable ? "A queue, not a total. Publishing moves a version out of approved, so zero means nothing is waiting — it does not mean publishing skipped review" : "Version data unavailable"} />
      </section>

      {coverage && (
        <section className="admin-panel" style={{ marginBottom: 24 }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-overline">Vocabulary coverage</p>
              <h2>Signs the system can recognise but cannot show</h2>
            </div>
            <Link href="/admin/animation-studio" className="admin-inline-link">Animation Studio <ArrowUpRight size={15} /></Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, padding: "0 20px 8px" }}>
            <article className="admin-metric-card">
              <p className="admin-metric-label">Published coverage</p>
              <strong className="admin-metric-value" style={{ color: coverage.percent > 70 ? "#047857" : coverage.percent > 40 ? "#B45309" : "#B91C1C" }}>
                {coverage.percent}%
              </strong>
              {/*
                The intersection, and it is smaller than both sides on purpose.
                publishedGlosses is the same set behind "Live published
                versions"; this counts only the members of it that the model can
                also recognise, so it reads one lower for every published gloss
                with no model class. Naming that gap here is what stops the two
                numbers looking like a mistake.
              */}
              <p className="admin-metric-note">
                {coverage.published} of {coverage.total} classes the model can recognise
                {coverage.unrecognised.length > 0 && (
                  <>
                    {" "}— from {publishedGlosses.length} published glosses, {coverage.unrecognised.length} of which
                    {coverage.unrecognised.length === 1 ? " has" : " have"} no model class
                    {" "}({coverage.unrecognised.join(", ")})
                  </>
                )}
              </p>
            </article>
            <article className="admin-metric-card">
              <p className="admin-metric-label">Not yet animated</p>
              <strong className="admin-metric-value">{coverage.missing}</strong>
              <p className="admin-metric-note">Recognised by the camera, fingerspelled in Type-to-Sign</p>
            </article>
            {coverage.groups.map((group) => (
              <article className="admin-metric-card" key={group.name}>
                <p className="admin-metric-label">{group.name}</p>
                <strong className="admin-metric-value">{group.published}<span style={{ fontSize: 15, opacity: 0.55 }}> / {group.total}</span></strong>
                <p className="admin-metric-note">
                  {group.missing.length === 0 ? "Fully covered" : `${group.missing.length} still to publish`}
                </p>
              </article>
            ))}
          </div>
          {coverage.missing > 0 && (
            <div style={{ padding: "0 20px 20px" }}>
              <p className="admin-metric-label" style={{ marginBottom: 8 }}>Not yet published, in model order</p>
              <p style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8, wordBreak: "break-word", margin: 0 }}>
                {coverage.groups.flatMap((g) => g.missing).slice(0, MISSING_PREVIEW).join("  ·  ")}
                {coverage.missing > MISSING_PREVIEW && (
                  <span style={{ opacity: 0.6 }}>{"  ·  "}and {coverage.missing - MISSING_PREVIEW} more</span>
                )}
              </p>
            </div>
          )}
          {coverage.unrecognised.length > 0 && (
            <div style={{ padding: "0 20px 20px" }}>
              <p className="admin-metric-label" style={{ marginBottom: 8 }}>
                Published but not in the model ({coverage.unrecognised.length})
              </p>
              <p className="admin-panel-note" style={{ margin: "0 0 6px" }}>
                Usable in Type-to-Sign. The camera cannot recognise these, so they are not counted above.
              </p>
              <p style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.8, wordBreak: "break-word", margin: 0 }}>
                {coverage.unrecognised.join("  ·  ")}
              </p>
            </div>
          )}
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

      {/* Distinct eyebrows: both cards read "Operational trend", which said
          nothing about either and looked copy-pasted because it was. What
          separates them is the x-axis -- one point per day against one point
          per recognition -- so that is what they now say. */}
      <section className="admin-chart-grid" aria-label="Recognition performance charts">
        <TrendCard
          eyebrow="Volume per day"
          title="Recognition usage"
          note="Recognitions and translations recorded each day"
          values={dailyCounts}
          accent="#2563EB"
          unit="day"
        />
        <TrendCard
          eyebrow="Quality per recognition"
          title="Confidence profile"
          note={recognitionSourceNote}
          values={confidenceValues.slice(-14)}
          accent="#0F766E"
          unit="recognition"
        />
      </section>

      <section className="admin-dashboard-secondary-grid">
        <article className="admin-panel admin-quick-actions">
          <div className="admin-panel-heading">
            <div><p className="admin-overline">Command center</p><h2>Continue a workflow</h2></div>
          </div>
          <div className="admin-quick-action-grid">
            <Link href="/admin/animation-studio">Create Animation <ArrowUpRight size={15} /></Link>
            <Link href="/admin/animation-library">Animation Library <ArrowUpRight size={15} /></Link>
            <Link href="/admin/animation-dataset">Animation Dataset <ArrowUpRight size={15} /></Link>
            <Link href="/admin/animation-inspector">Animation Inspector <ArrowUpRight size={15} /></Link>
            <Link href="/admin/system">System Health <ArrowUpRight size={15} /></Link>
          </div>
        </article>
        <article className="admin-panel admin-model-summary">
          <p className="admin-overline">Production model</p>
          <h2>{DEPLOYED_MODEL.architecture}</h2>
          <p>The recognition model this build serves, read from the shipped artifacts. It changes only when the weights are replaced, so it cannot drift from what the browser actually loads.</p>
          <div className="admin-model-summary-stats">
            <span><strong>{DEPLOYED_MODEL.classes.toLocaleString()}</strong> recognisable classes</span>
            <span><strong>{DEPLOYED_MODEL.format}</strong> artifact format</span>
            {DEPLOYED_MODEL.convertedAt && (
              <span><strong>{new Date(DEPLOYED_MODEL.convertedAt).toLocaleDateString()}</strong> exported</span>
            )}
          </div>
          <Link href="/admin/system" className="admin-inline-link">System health <ArrowUpRight size={15} /></Link>
        </article>
      </section>

      <section className="admin-panel admin-activity-panel">
        <div className="admin-panel-heading">
          <div><p className="admin-overline">Recent activity</p><h2>Telemetry and system events</h2></div>
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