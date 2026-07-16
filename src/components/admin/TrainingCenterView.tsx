import Link from "next/link";
import { Activity, ArrowRight, Database, FolderInput, Layers3, ShieldCheck } from "lucide-react";

type TrainingCenterViewProps = {
  totalSamples: number;
};

const workflowSteps = [
  "Prepare and validate landmark sequences",
  "Train the unified BiLSTM candidate",
  "Evaluate accuracy and class-level quality",
  "Export approved weights for browser inference",
];

export function TrainingCenterView({ totalSamples }: TrainingCenterViewProps) {
  return (
    <div className="admin-training-center">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Model operations</p>
          <h1>Training center</h1>
          <p className="admin-dashboard-subtitle">
            Prepare recognition data, assess production quality, and run the verified local training workflow.
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <Link className="admin-action-button" href="/admin/dataset">
            <FolderInput size={16} aria-hidden="true" />
            Capture samples
          </Link>
          <Link className="admin-action-button admin-action-button-primary" href="/admin/models">
            <Layers3 size={16} aria-hidden="true" />
            Model registry
          </Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="Training overview">
        <article className="admin-metric-card">
          <div className="admin-metric-card-head">
            <span className="admin-metric-icon"><Database size={17} aria-hidden="true" /></span>
            <span className="admin-metric-trend is-steady">Live count</span>
          </div>
          <p className="admin-metric-label">Captured samples</p>
          <strong className="admin-metric-value">{totalSamples.toLocaleString()}</strong>
          <p className="admin-metric-note">Submitted recordings awaiting review or training preparation.</p>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card-head">
            <span className="admin-metric-icon"><Activity size={17} aria-hidden="true" /></span>
            <span className="admin-metric-trend is-up">Production</span>
          </div>
          <p className="admin-metric-label">Current model</p>
          <strong className="admin-metric-value">BiLSTM v2</strong>
          <p className="admin-metric-note">94.86% test accuracy on the Kaggle-enriched unified dataset.</p>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card-head">
            <span className="admin-metric-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
            <span className="admin-metric-trend is-steady">Coverage</span>
          </div>
          <p className="admin-metric-label">Recognition classes</p>
          <strong className="admin-metric-value">133</strong>
          <p className="admin-metric-note">Alphabet and phrase labels delivered through on-device inference.</p>
        </article>
      </section>

      <section className="admin-training-workspace">
        <article className="admin-panel admin-training-workflow">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-overline">Verified workflow</p>
              <h2>From capture to browser model</h2>
            </div>
            <span className="admin-period-tag">Local workflow</span>
          </div>
          <ol>
            {workflowSteps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="admin-panel-note">
            Training runs through the repository scripts; this console reports and links to the operational inputs without starting a server-side job.
          </p>
        </article>

        <aside className="admin-panel admin-training-commands">
          <p className="admin-overline">Repository commands</p>
          <h2>Run locally</h2>
          <code>npm run build:unified-v4</code>
          <code>npm run train:unified</code>
          <code>npm run export:unified-tfjs</code>
          <p className="admin-panel-note">Use the full development environment for training and export operations.</p>
        </aside>
      </section>

      <section className="admin-training-actions" aria-label="Training operations">
        <Link href="/admin/collection">
          <span className="admin-training-action-icon"><Database size={18} aria-hidden="true" /></span>
          <span><strong>Data collection</strong><small>Review campaigns, difficult gestures, and sample coverage.</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link href="/admin/models">
          <span className="admin-training-action-icon"><Layers3 size={18} aria-hidden="true" /></span>
          <span><strong>Model registry</strong><small>Compare benchmark results and deployed versions.</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link href="/admin/model-health">
          <span className="admin-training-action-icon"><Activity size={18} aria-hidden="true" /></span>
          <span><strong>Model health</strong><small>Inspect inference performance and drift signals.</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}