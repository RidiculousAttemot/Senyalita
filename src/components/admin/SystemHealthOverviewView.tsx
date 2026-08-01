import { Database, Film, FolderArchive, Gauge, HardDrive, Radio, ShieldCheck } from "lucide-react";
import type { ModelLoadResult } from "@/features/recognition/model/types";

export type SystemHealthData = {
  animationAssetCount: number | null;
  animationExtractionQueueCount: number;
  animationPublishedCount: number;
  averageLatencyMs: number | null;
  databaseAvailable: boolean;
  model: ModelLoadResult;
  recentPredictions: number | null;
  sourceBreakdown: Record<string, number>;
  storageAvailable: boolean;
  storageFileCount: number;
  telemetryAvailable: boolean;
  totalPredictions: number | null;
};

type ServiceTone = "healthy" | "attention" | "unknown";

export function SystemHealthOverviewView({ health }: { health: SystemHealthData }) {
  const serverServicesAvailable = health.databaseAvailable && health.storageAvailable;
  const modelRuntimeAvailable = health.model.status === "ready";
  const sourceEntries = Object.entries(health.sourceBreakdown).sort(([, left], [, right]) => right - left);

  return (
    <div className="admin-system-health">
      <header className="admin-dashboard-header">
        <div><p className="admin-overline">Production operations</p><h1>System health</h1><p className="admin-dashboard-subtitle">Current service checks, deployed recognition runtime signals, and the animation publishing pipeline.</p></div>
        <Status tone={serverServicesAvailable ? "healthy" : "unknown"} label={serverServicesAvailable ? "Core services available" : "Service checks unavailable"} />
      </header>
      <section className="admin-system-service-grid" aria-label="Service status">
        <Service icon={<Database size={18} />} label="Database" detail={health.databaseAvailable ? "Translation session read check succeeded" : "Translation session read check failed"} tone={health.databaseAvailable ? "healthy" : "unknown"} />
        <Service icon={<HardDrive size={18} />} label="Gesture storage" detail={health.storageAvailable ? `${health.storageFileCount.toLocaleString()} files indexed` : "Storage listing is unavailable"} tone={health.storageAvailable ? "healthy" : "unknown"} />
        <Service icon={<Gauge size={18} />} label="Recognition runtime" detail={modelRuntimeAvailable ? `${health.model.modelType ?? "Recognition model"} ready${health.model.classes ? ` with ${health.model.classes} classes` : ""}` : "Browser runtime monitoring unavailable"} tone={modelRuntimeAvailable ? "healthy" : "unknown"} />
        <Service icon={<Radio size={18} />} label="Telemetry" detail={health.telemetryAvailable ? "Recognition telemetry is flowing" : "Telemetry unavailable"} tone={health.telemetryAvailable ? "healthy" : "unknown"} />
      </section>
      <section className="admin-metric-grid" aria-label="Recognition operations summary">
        <Metric icon={<Gauge size={17} />} label="All predictions" note="Recorded translation logs" value={health.totalPredictions?.toLocaleString() ?? "Unavailable"} />
        <Metric icon={<Gauge size={17} />} label="Predictions, 30 days" note="Recent recognition activity" value={health.recentPredictions?.toLocaleString() ?? "Unavailable"} />
        <Metric icon={<ShieldCheck size={17} />} label="Average latency" note="Recent translation-log inference" value={health.averageLatencyMs === null ? "Unavailable" : `${health.averageLatencyMs.toFixed(1)} ms`} />
        <Metric icon={<Film size={17} />} label="Published animations" note="Live in Text-to-Sign" value={health.animationPublishedCount.toLocaleString()} />
      </section>
      <section className="admin-system-health-grid">
        <article className="admin-panel admin-system-source-panel"><div className="admin-panel-heading"><div><p className="admin-overline">30-day activity</p><h2>Recognition sources</h2></div><FolderArchive size={18} aria-hidden="true" /></div>{sourceEntries.length === 0 ? <p className="admin-empty-state">No recent recognition source data is available.</p> : <div className="admin-system-source-list">{sourceEntries.map(([source, count]) => <div key={source}><code>{source}</code><strong>{count.toLocaleString()}</strong></div>)}</div>}</article>
        <article className="admin-panel admin-system-assistant-panel"><div className="admin-panel-heading"><div><p className="admin-overline">Animation Studio</p><h2>Publishing pipeline</h2></div><Film size={18} aria-hidden="true" /></div><dl><div><dt>Animation assets</dt><dd>{health.animationAssetCount?.toLocaleString() ?? "Unavailable"}</dd></div><div><dt>Published</dt><dd>{health.animationPublishedCount.toLocaleString()}</dd></div><div><dt>Awaiting extraction or review</dt><dd>{health.animationExtractionQueueCount.toLocaleString()}</dd></div></dl></article>
      </section>
    </div>
  );
}

function Status({ label, tone }: { label: string; tone: ServiceTone }) {
  return <span className={`admin-status admin-status-${tone}`}><span className="admin-status-dot" aria-hidden="true" />{label}</span>;
}

function Service({ detail, icon, label, tone }: { detail: string; icon: React.ReactNode; label: string; tone: ServiceTone }) {
  return <article className="admin-system-service"><span className="admin-system-service-icon">{icon}</span><div><div><h2>{label}</h2><Status label={tone === "healthy" ? "Available" : "Unavailable"} tone={tone} /></div><p>{detail}</p></div></article>;
}

function Metric({ icon, label, note, value }: { icon: React.ReactNode; label: string; note: string; value: string }) {
  return <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon">{icon}</span></div><p className="admin-metric-label">{label}</p><strong className="admin-metric-value">{value}</strong><p className="admin-metric-note">{note}</p></article>;
}