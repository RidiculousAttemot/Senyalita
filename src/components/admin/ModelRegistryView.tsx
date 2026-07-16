import Link from "next/link";
import { ArrowUpRight, Box, CircleCheckBig, Clock3, Layers3 } from "lucide-react";
import type { ModelVersion } from "@/lib/supabase/types";

export type ArchitectureMetrics = {
  name: string;
  status: string;
  testAccuracy?: number;
  macroF1?: number;
  weightedF1?: number;
  testLoss?: number;
  params?: number;
  estimatedInferenceMs?: number;
  memoryFootprintKB?: number;
  epochsTrained?: number;
};

type ModelRegistryViewProps = {
  architectures: ArchitectureMetrics[];
  runtimeStatus: "loading" | "ready" | "error";
  versions: ModelVersion[];
};

const formatPercent = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? "—" : `${(value * 100).toFixed(digits)}%`;

export function ModelRegistryView({ architectures, runtimeStatus, versions }: ModelRegistryViewProps) {
  const runtimeIsReady = runtimeStatus === "ready";

  return (
    <div className="admin-model-registry">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Model operations</p>
          <h1>Model registry</h1>
          <p className="admin-dashboard-subtitle">
            Compare benchmarked architectures, inspect registered versions, and verify the browser recognition runtime.
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <Link className="admin-action-button" href="/admin/training">
            <Layers3 size={16} aria-hidden="true" />
            Training center
          </Link>
          <Link className="admin-action-button admin-action-button-primary" href="/admin/model-health">
            <ArrowUpRight size={16} aria-hidden="true" />
            Check model health
          </Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="Model runtime overview">
        <article className="admin-metric-card">
          <div className="admin-metric-card-head">
            <span className="admin-metric-icon"><CircleCheckBig size={17} aria-hidden="true" /></span>
            <span className={`admin-status ${runtimeIsReady ? "admin-status-healthy" : "admin-status-unknown"}`}>
              <span className="admin-status-dot" aria-hidden="true" />
              {runtimeIsReady ? "Operational" : "Monitoring unavailable"}
            </span>
          </div>
          <p className="admin-metric-label">Recognition runtime</p>
          <strong className="admin-metric-value">{runtimeStatus}</strong>
          <p className="admin-metric-note">Runtime state is available after the browser loads the recognition model.</p>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card-head">
            <span className="admin-metric-icon"><Box size={17} aria-hidden="true" /></span>
            <span className="admin-metric-trend is-steady">Deployed</span>
          </div>
          <p className="admin-metric-label">Production baseline</p>
          <strong className="admin-metric-value">BiLSTM v2</strong>
          <p className="admin-metric-note">133 recognition classes with TensorFlow.js browser inference.</p>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card-head">
            <span className="admin-metric-icon"><Clock3 size={17} aria-hidden="true" /></span>
            <span className="admin-metric-trend is-steady">Registry</span>
          </div>
          <p className="admin-metric-label">Registered versions</p>
          <strong className="admin-metric-value">{versions.length}</strong>
          <p className="admin-metric-note">Version records retained for deployment history and comparison.</p>
        </article>
      </section>

      <section className="admin-panel admin-model-table-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-overline">Benchmark</p>
            <h2>Architecture comparison</h2>
          </div>
          <span className="admin-period-tag">Local benchmark file</span>
        </div>
        {architectures.length === 0 ? (
          <p className="admin-empty-state">No benchmark data is available in this environment.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-model-table">
              <thead><tr><th>Architecture</th><th>Status</th><th>Accuracy</th><th>Macro F1</th><th>Inference</th><th>Memory</th><th>Parameters</th></tr></thead>
              <tbody>
                {architectures.map((architecture) => (
                  <tr key={architecture.name} className={architecture.testAccuracy && architecture.testAccuracy >= 0.9 ? "is-leading" : undefined}>
                    <td><code>{architecture.name}</code></td>
                    <td><span className={`admin-status ${architecture.status === "available" ? "admin-status-healthy" : "admin-status-unknown"}`}><span className="admin-status-dot" aria-hidden="true" />{architecture.status}</span></td>
                    <td>{formatPercent(architecture.testAccuracy, 2)}</td>
                    <td>{formatPercent(architecture.macroF1, 2)}</td>
                    <td>{architecture.estimatedInferenceMs === undefined ? "—" : `${architecture.estimatedInferenceMs.toFixed(1)} ms`}</td>
                    <td>{architecture.memoryFootprintKB === undefined ? "—" : `${architecture.memoryFootprintKB} KB`}</td>
                    <td>{architecture.params?.toLocaleString() ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel admin-model-table-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-overline">Deployment history</p>
            <h2>Registered versions</h2>
          </div>
          <span className="admin-period-tag">Database records</span>
        </div>
        {versions.length === 0 ? (
          <p className="admin-empty-state">No registered model versions.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-model-table">
              <thead><tr><th>Version</th><th>Architecture</th><th>Accuracy</th><th>Dataset size</th><th>Classes</th><th>Deployment</th><th>Status</th></tr></thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td><code>{version.version}</code></td>
                    <td>{version.architecture}</td>
                    <td>{formatPercent(version.accuracy)}</td>
                    <td>{version.dataset_size?.toLocaleString() ?? "—"}</td>
                    <td>{version.num_classes}</td>
                    <td>{version.deployment_date ? new Date(version.deployment_date).toLocaleDateString() : "Not deployed"}</td>
                    <td><span className={`admin-status ${version.is_active ? "admin-status-healthy" : "admin-status-unknown"}`}><span className="admin-status-dot" aria-hidden="true" />{version.is_active ? "Active" : "Historical"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}