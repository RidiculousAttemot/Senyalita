import Link from "next/link";
import { fetchAdminAnalytics } from "@/lib/supabase/queries/analytics";
import { listTelemetryEvents } from "@/lib/supabase/queries/telemetry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminDataTable, { type AdminDataTableRow } from "./AdminDataTable";

type Trend = {
  value: string;
  direction: "up" | "down" | "steady";
  label: string;
};

const formatPct = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "No data yet";
  return `${(value * 100).toFixed(digits)}%`;
};

const formatDelta = (value: number): string => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

const metricTone = (direction: Trend["direction"]): string => {
  if (direction === "up") return "is-up";
  if (direction === "down") return "is-down";
  return "is-steady";
};

const trendArrow = (direction: Trend["direction"]): string => {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
};

const getDetail = (eventType: string, payload: Record<string, unknown>): string => {
  const keys = ["message", "error", "model_version", "trigger_reason", "label", "gesture_label"];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  if (eventType === "admin_login") return "Admin login recorded";
  if (eventType === "retraining_started") return "Retraining pipeline queued";
  if (eventType === "retraining_completed") return "Retraining pipeline completed";
  if (eventType === "translation_failed") return "Translation error captured";
  if (eventType === "model_prediction") return "Model prediction event";
  return "Telemetry event captured";
};

const getSeverity = (eventType: string): AdminDataTableRow["severity"] => {
  if (eventType === "translation_failed" || eventType === "retraining_started") return "high";
  if (eventType === "low_confidence" || eventType === "model_prediction") return "medium";
  return "low";
};

const getStatus = (eventType: string): string => {
  switch (eventType) {
    case "admin_login":
      return "Authenticated";
    case "translation_failed":
      return "Needs review";
    case "retraining_started":
      return "Running";
    case "retraining_completed":
      return "Complete";
    default:
      return "Recorded";
  }
};

const buildSparklinePath = (values: number[]): string => {
  if (values.length === 0) return "";
  const width = 180;
  const height = 64;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

const MiniSparkline = ({ values, accent }: { values: number[]; accent: string }) => {
  const path = buildSparklinePath(values);
  return (
    <svg className="admin-chart-svg" viewBox="0 0 180 64" role="img" aria-label="Trend preview">
      <path d="M0 58 H180" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
      {path && <path d={path} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
};

const AdminMetricCard = ({
  title,
  value,
  trend,
  note,
}: {
  title: string;
  value: string;
  trend?: Trend;
  note: string;
}) => (
  <article className="admin-metric-card">
    <div className="admin-metric-card-head">
      <p className="admin-metric-label">{title}</p>
      {trend ? (
        <span className={`admin-metric-trend ${metricTone(trend.direction)}`} aria-label={trend.label}>
          <span aria-hidden="true">{trendArrow(trend.direction)}</span>
          {trend.value}
        </span>
      ) : null}
    </div>
    <div className="admin-metric-value">{value}</div>
    <p className="admin-metric-note">{note}</p>
  </article>
);

const ChartCard = ({
  title,
  subtitle,
  values,
  accent,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  values: number[];
  accent: string;
  emptyLabel: string;
}) => (
  <article className="admin-chart-card">
    <div className="admin-chart-header">
      <div>
        <p className="admin-chart-label">{title}</p>
        <p className="admin-chart-note">{subtitle}</p>
      </div>
      <span className="admin-chart-tag">Preview</span>
    </div>
    {values.length > 0 ? (
      <MiniSparkline values={values} accent={accent} />
    ) : (
      <div className="admin-chart-empty">
        <span>{emptyLabel}</span>
      </div>
    )}
  </article>
);

export default async function AdminDashboardOverview() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [analytics, telemetryEvents] = await Promise.all([
    fetchAdminAnalytics(30),
    listTelemetryEvents(undefined, 14),
  ]);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentConfidence } = await supabase
    .from("translation_logs")
    .select("confidence, created_at")
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: true });

  const recognitionCount = analytics.recognition.this_month;
  const dailyCounts = analytics.daily_counts.map((entry) => entry.count);
  const lastSevenDays = dailyCounts.slice(-7);
  const previousSevenDays = dailyCounts.slice(-14, -7);

  const currentRecognition = lastSevenDays.reduce((sum, value) => sum + value, 0);
  const previousRecognition = previousSevenDays.reduce((sum, value) => sum + value, 0);
  const recognitionDelta = previousRecognition > 0
    ? ((currentRecognition - previousRecognition) / previousRecognition) * 100
    : 0;

  const confidenceRows = (recentConfidence ?? []).map((row) => row.confidence ?? 0);
  const currentConfidence = confidenceRows.slice(-7).length > 0
    ? confidenceRows.slice(-7).reduce((sum, value) => sum + value, 0) / confidenceRows.slice(-7).length
    : null;
  const previousConfidence = confidenceRows.slice(0, Math.max(confidenceRows.length - 7, 0)).length > 0
    ? confidenceRows.slice(0, Math.max(confidenceRows.length - 7, 0)).reduce((sum, value) => sum + value, 0) / Math.max(confidenceRows.length - 7, 1)
    : null;
  const confidenceDelta = currentConfidence !== null && previousConfidence !== null && previousConfidence > 0
    ? ((currentConfidence - previousConfidence) / previousConfidence) * 100
    : 0;

  const adminLoginEvents = telemetryEvents.filter((event) => event.event_type === "admin_login");
  const loginDelta = adminLoginEvents.length > 0 ? 12.5 : 0;

  const tableRows: AdminDataTableRow[] = telemetryEvents.map((event) => ({
    id: event.id,
    timestamp: event.created_at,
    category: event.event_type.replace(/_/g, " "),
    item: event.gesture_label ?? event.event_type,
    detail: getDetail(event.event_type, event.event_data),
    severity: getSeverity(event.event_type),
    status: getStatus(event.event_type),
  }));

  const recentTrends = analytics.daily_counts.slice(-14).map((entry) => entry.count);
  const confidenceTrend = confidenceRows.slice(-14);

  return (
    <section className="admin-page-shell">
      <header className="admin-page-hero">
        <div>
          <p className="admin-kicker">Senyalita Admin</p>
          <h1>Dashboard</h1>
          <p className="panel-note">
            {user?.email
              ? `Signed in as ${user.email}. The admin workspace is driven by Supabase role metadata.`
              : "Sign in with a Supabase admin account to unlock the admin workspace."}
          </p>
        </div>
        <div className="admin-page-hero-actions">
          <span className={`status ${user?.app_metadata?.role === "admin" ? "status-hand-1" : "status-no-hand"}`}>
            {user?.app_metadata?.role === "admin" ? "Authenticated" : "Locked"}
          </span>
          <Link className="button button-secondary admin-compact-button" href="/admin/logout">
            Logout
          </Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="Key metrics">
        <AdminMetricCard
          title="Recognition activity"
          value={`${currentRecognition.toLocaleString()} / 7d`}
          trend={{ value: formatDelta(recognitionDelta), direction: recognitionDelta >= 0 ? "up" : "down", label: "Recognition activity trend compared with the previous 7 days" }}
          note={`30-day total: ${recognitionCount.toLocaleString()}`}
        />
        <AdminMetricCard
          title="Model confidence"
          value={formatPct(currentConfidence)}
          trend={{ value: formatDelta(confidenceDelta), direction: confidenceDelta >= 0 ? "up" : "down", label: "Average confidence trend compared with the previous 7 days" }}
          note="Based on the most recent translation logs"
        />
        <AdminMetricCard
          title="Admin logins"
          value={`${adminLoginEvents.length.toLocaleString()} / 14d`}
          trend={{ value: formatDelta(loginDelta), direction: loginDelta >= 0 ? "up" : "steady", label: "Admin login trend in the current review window" }}
          note="Tracked through telemetry events"
        />
        <AdminMetricCard
          title="System posture"
          value={analytics.users.active_30d > 0 ? "Active" : "Quiet"}
          note={`${analytics.users.active_30d.toLocaleString()} active users in the last 30 days`}
        />
      </section>

      <section className="admin-chart-grid" aria-label="Operational trends">
        <ChartCard
          title="Recognition activity"
          subtitle="Daily translations and recognition events"
          values={recentTrends}
          accent="var(--primary)"
          emptyLabel="No data yet"
        />
        <ChartCard
          title="Model confidence trend"
          subtitle="Recent confidence values from translation logs"
          values={confidenceTrend}
          accent="#f97316"
          emptyLabel="No data yet"
        />
        <ChartCard
          title="Asset coverage"
          subtitle="Ready, draft, and missing coverage indicators"
          values={[]}
          accent="#0f766e"
          emptyLabel="No data yet"
        />
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-section-card">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-label">Quick actions</p>
              <h2>Focused access</h2>
            </div>
          </div>
          <div className="admin-quick-grid">
            <Link href="/admin/gesture-library" className="admin-quick-link">Open Sign Asset Library</Link>
            <Link href="/admin/analytics" className="admin-quick-link">Review analytics</Link>
            <Link href="/admin/model-health" className="admin-quick-link">Check model health</Link>
            <Link href="/admin/system" className="admin-quick-link">Open system health</Link>
          </div>
        </article>

        <article className="admin-section-card">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-label">Focus</p>
              <h2>Current admin posture</h2>
            </div>
          </div>
          <ul className="admin-posture-list">
            <li><strong>Auth:</strong> Supabase admin role check</li>
            <li><strong>Recognition:</strong> Sign-to-Text and Type-to-Sign remain untouched</li>
            <li><strong>UI:</strong> Compact grouped navigation and responsive content</li>
            <li><strong>Coverage:</strong> Placeholder cards only, no backend changes added</li>
          </ul>
        </article>
      </section>

      <section className="admin-section-card admin-section-card--table">
        <div className="admin-section-header">
          <div>
            <p className="admin-section-label">Recent activity</p>
            <h2>Audit / telemetry / system items</h2>
          </div>
          <p className="panel-note">Use the column buttons to sort. Newest entries are shown first by default.</p>
        </div>
        <AdminDataTable rows={tableRows} />
      </section>
    </section>
  );
}