import { Bot, Database, FolderArchive, Gauge, HardDrive, ListChecks, Radio, ShieldCheck } from "lucide-react";
import type { ModelLoadResult } from "@/features/recognition/model/types";

export type SystemHealthData = {
  aiAcceptanceRate: number | null;
  aiRepliesSent: number | null;
  averageLatencyMs: number | null;
  captureCount: number | null;
  databaseAvailable: boolean;
  model: ModelLoadResult;
  pendingReviewCount: number | null;
  recentPredictions: number | null;
  sourceBreakdown: Record<string, number>;
  storageAvailable: boolean;
  storageFileCount: number;
  telemetryAvailable: boolean;
  totalPredictions: number | null;
};

type ServiceTone = "healthy" | "attention" | "unknown";

const formatMetricNumber = (value: number | null | undefined, fallback = "No data") => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return value.toLocaleString();
};

const formatPercent = (value: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "No data";
  return `${(value * 100).toFixed(1)}%`;
};

export function SystemHealthOverviewView({ health }: { health: SystemHealthData }) {
  const serverServicesAvailable = health.databaseAvailable && health.storageAvailable;
  const modelRuntimeAvailable = health.model.status === "ready";
  const sourceEntries = Object.entries(health.sourceBreakdown).sort(([, left], [, right]) => right - left);
  const noRecognitionActivity = sourceEntries.length === 0 && health.totalPredictions === 0;

  return (
    <div className="admin-system-health">
      <header className="admin-dashboard-header">
        <div><p className="admin-overline">Production operations</p><h1>System health</h1><p className="admin-dashboard-subtitle">Current service checks, deployed recognition runtime signals, and workflow backlog from the existing production data sources.</p></div>
        <Status tone={serverServicesAvailable ? "healthy" : "unknown"} label={serverServicesAvailable ? "Core services available" : "Service checks unavailable"} />
      </header>
      <section className="admin-system-service-grid" aria-label="Service status">
        <Service icon={<Database size={18} />} label="Database" detail={health.databaseAvailable ? "Translation session read check succeeded" : "Translation session read check failed"} tone={health.databaseAvailable ? "healthy" : "unknown"} />
        <Service icon={<HardDrive size={18} />} label="Gesture storage" detail={health.storageAvailable ? `${health.storageFileCount.toLocaleString()} files indexed` : "Storage listing is unavailable"} tone={health.storageAvailable ? "healthy" : "unknown"} />
        <Service icon={<Gauge size={18} />} label="Recognition runtime" detail={modelRuntimeAvailable ? `${health.model.modelType ?? "Recognition model"} ready${health.model.classes ? ` with ${health.model.classes} classes` : ""}` : "Browser runtime monitoring unavailable"} tone={modelRuntimeAvailable ? "healthy" : "unknown"} />
        <Service icon={<Radio size={18} />} label="Telemetry" detail={health.telemetryAvailable ? "Assistant usage events are available" : "Telemetry unavailable"} tone={health.telemetryAvailable ? "healthy" : "unknown"} />
      </section>
      <section className="admin-metric-grid" aria-label="Recognition operations summary">
        <Metric icon={<Bot size={17} />} label="All predictions" note="Recorded translation logs" value={formatMetricNumber(health.totalPredictions)} />
        <Metric icon={<Gauge size={17} />} label="Predictions, 30 days" note="Recent recognition activity" value={formatMetricNumber(health.recentPredictions)} />
        <Metric icon={<ShieldCheck size={17} />} label="Average latency" note="Recent translation-log inference" value={health.averageLatencyMs === null ? "No data" : `${health.averageLatencyMs.toFixed(1)} ms`} />
        <Metric icon={<ListChecks size={17} />} label="Review backlog" note="Pending review queue items" value={formatMetricNumber(health.pendingReviewCount)} />
      </section>
      <section className="admin-system-health-grid">
        <article className="admin-panel admin-system-source-panel"><div className="admin-panel-heading"><div><p className="admin-overline">30-day activity</p><h2>Recognition sources</h2></div><FolderArchive size={18} aria-hidden="true" /></div>{sourceEntries.length === 0 ? <p className="admin-empty-state">{noRecognitionActivity ? "No data" : "Not tracked"}</p> : <div className="admin-system-source-list">{sourceEntries.map(([source, count]) => <div key={source}><code>{source}</code><strong>{count.toLocaleString()}</strong></div>)}</div>}</article>
        <article className="admin-panel admin-system-assistant-panel"><div className="admin-panel-heading"><div><p className="admin-overline">Assistant usage</p><h2>Conversation signals</h2></div><Bot size={18} aria-hidden="true" /></div><dl><div><dt>AI replies used</dt><dd>{health.aiRepliesSent === null ? "No data" : health.aiRepliesSent === 0 ? "0" : health.aiRepliesSent.toLocaleString()}</dd></div><div><dt>Reply acceptance</dt><dd>{health.aiAcceptanceRate === null ? (health.aiRepliesSent === 0 ? "Not tracked" : "No data") : formatPercent(health.aiAcceptanceRate)}</dd></div><div><dt>Captured samples</dt><dd>{health.captureCount === null ? "No data" : health.captureCount === 0 ? "0" : health.captureCount.toLocaleString()}</dd></div></dl></article>
      </section>
    </div>
  );
}

function Status({ label, tone }: { label: string; tone: ServiceTone }) {
  return <span className={`admin-status admin-status-${tone}`}><span className="admin-status-dot" aria-hidden="true" />{label}</span>;
}

function Service({ detail, icon, label, tone }: { detail: string; icon: React.ReactNode; label: string; tone: ServiceTone }) {
  const statusLabel = tone === "healthy" ? "Available" : detail.includes("unavailable") || detail.includes("failed") ? "Unavailable" : "Not tracked";
  return <article className="admin-system-service"><span className="admin-system-service-icon">{icon}</span><div><div><h2>{label}</h2><Status label={statusLabel} tone={tone} /></div><p>{detail}</p></div></article>;
}

function Metric({ icon, label, note, value }: { icon: React.ReactNode; label: string; note: string; value: string }) {
  return <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon">{icon}</span></div><p className="admin-metric-label">{label}</p><strong className="admin-metric-value">{value}</strong><p className="admin-metric-note">{note}</p></article>;
}