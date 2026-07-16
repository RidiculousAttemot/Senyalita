import Link from "next/link";
import { ArrowRight, ClipboardCheck, Database, ScanSearch, UsersRound } from "lucide-react";
import type { SessionDiversity, SignerProfile } from "@/lib/supabase/types";

export type CollectionCampaign = {
  name: string;
  target: number;
  priority: string;
  collected: number;
};

type CollectionOverviewViewProps = {
  campaigns: CollectionCampaign[];
  diversitySessions: SessionDiversity[];
  metrics: {
    approvedSamples: number;
    collectedSamples: number;
    pendingReviews: number;
    registeredSigners: number;
    totalPredictions: number;
  };
  signers: SignerProfile[];
};

const diversityDimensions: Array<{ label: string; field: keyof Pick<SessionDiversity, "background" | "camera_angle" | "environment" | "hand_dominance" | "lighting"> }> = [
  { label: "Lighting", field: "lighting" },
  { label: "Camera angle", field: "camera_angle" },
  { label: "Background", field: "background" },
  { label: "Hand dominance", field: "hand_dominance" },
  { label: "Environment", field: "environment" },
];

function getCampaignProgress(campaign: CollectionCampaign): number {
  return campaign.target > 0 ? Math.min(100, Math.round((campaign.collected / campaign.target) * 100)) : 0;
}

function getProgressClass(progress: number): string {
  if (progress >= 100) return "is-full";
  if (progress >= 75) return "is-three-quarters";
  if (progress >= 50) return "is-half";
  if (progress >= 25) return "is-quarter";
  return "is-empty";
}

export function CollectionOverviewView({ campaigns, diversitySessions, metrics, signers }: CollectionOverviewViewProps) {
  return (
    <div className="admin-collection-overview">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Recognition data</p>
          <h1>Data collection</h1>
          <p className="admin-dashboard-subtitle">
            Monitor review intake, real-world gesture campaigns, and signer diversity before data enters the training workflow.
          </p>
        </div>
        <div className="admin-dashboard-actions">
          <Link className="admin-action-button" href="/admin/dataset"><Database size={16} aria-hidden="true" />Capture samples</Link>
          <Link className="admin-action-button admin-action-button-primary" href="/admin/review"><ClipboardCheck size={16} aria-hidden="true" />Review queue</Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="Data collection overview">
        <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon"><ScanSearch size={17} aria-hidden="true" /></span><span className="admin-metric-trend is-steady">All time</span></div><p className="admin-metric-label">Recognition events</p><strong className="admin-metric-value">{metrics.totalPredictions.toLocaleString()}</strong><p className="admin-metric-note">Logged prediction events available for quality analysis.</p></article>
        <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon"><ClipboardCheck size={17} aria-hidden="true" /></span><span className={`admin-metric-trend ${metrics.pendingReviews > 0 ? "is-down" : "is-up"}`}>{metrics.pendingReviews > 0 ? "Needs review" : "Clear"}</span></div><p className="admin-metric-label">Pending review</p><strong className="admin-metric-value">{metrics.pendingReviews.toLocaleString()}</strong><p className="admin-metric-note">Corrections and samples waiting for reviewer decision.</p></article>
        <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon"><Database size={17} aria-hidden="true" /></span><span className="admin-metric-trend is-up">Approved</span></div><p className="admin-metric-label">Training samples</p><strong className="admin-metric-value">{metrics.approvedSamples.toLocaleString()}</strong><p className="admin-metric-note">Approved samples available to future model builds.</p></article>
        <article className="admin-metric-card"><div className="admin-metric-card-head"><span className="admin-metric-icon"><UsersRound size={17} aria-hidden="true" /></span><span className="admin-metric-trend is-steady">Coverage</span></div><p className="admin-metric-label">Registered signers</p><strong className="admin-metric-value">{metrics.registeredSigners.toLocaleString()}</strong><p className="admin-metric-note">Signer profiles contributing context to collection quality.</p></article>
      </section>

      <section className="admin-panel admin-collection-campaigns">
        <div className="admin-panel-heading"><div><p className="admin-overline">Collection targets</p><h2>Active campaigns</h2></div><span className="admin-period-tag">{metrics.collectedSamples.toLocaleString()} campaign samples</span></div>
        {campaigns.length === 0 ? <p className="admin-empty-state">No active collection campaigns are defined.</p> : (
          <div className="admin-campaign-list">
            {campaigns.map((campaign) => {
              const progress = getCampaignProgress(campaign);
              return <article key={campaign.name}><div><code>{campaign.name}</code><span className={`admin-campaign-priority ${campaign.priority === "P0" ? "is-critical" : ""}`}>{campaign.priority}</span></div><p>{campaign.collected.toLocaleString()} of {campaign.target.toLocaleString()} samples</p><div className="admin-campaign-progress"><span><i className={getProgressClass(progress)} /></span><strong>{progress}%</strong></div></article>;
            })}
          </div>
        )}
      </section>

      <section className="admin-collection-secondary-grid">
        <article className="admin-panel admin-collection-signers">
          <div className="admin-panel-heading"><div><p className="admin-overline">Participants</p><h2>Signer coverage</h2></div><span className="admin-period-tag">{signers.length} profiles</span></div>
          {signers.length === 0 ? <p className="admin-empty-state">No signer profiles have been registered.</p> : (
            <div className="admin-table-scroll"><table className="admin-model-table"><thead><tr><th>Signer</th><th>Experience</th><th>Handedness</th><th>Sessions</th><th>Last active</th></tr></thead><tbody>{signers.slice(0, 8).map((signer) => <tr key={signer.id}><td><code>{signer.signer_id}</code></td><td>{signer.signing_experience ?? "—"}</td><td>{signer.handedness ?? "—"}</td><td>{signer.total_sessions}</td><td>{signer.last_active_at ? new Date(signer.last_active_at).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>
          )}
        </article>

        <aside className="admin-panel admin-collection-diversity">
          <div className="admin-panel-heading"><div><p className="admin-overline">Capture context</p><h2>Diversity coverage</h2></div><span className="admin-period-tag">{diversitySessions.length} sessions</span></div>
          {diversitySessions.length === 0 ? <p className="admin-empty-state">No diversity metadata has been captured.</p> : <div className="admin-diversity-list">{diversityDimensions.map((dimension) => { const values = diversitySessions.reduce<Record<string, number>>((counts, session) => { const value = session[dimension.field] ?? "Unknown"; counts[value] = (counts[value] ?? 0) + 1; return counts; }, {}); return <article key={dimension.field}><h3>{dimension.label}</h3>{Object.entries(values).map(([value, count]) => <p key={value}><span>{value}</span><strong>{count}</strong></p>)}</article>; })}</div>}
        </aside>
      </section>

      <section className="admin-collection-actions" aria-label="Data collection operations">
        <Link href="/admin/review"><ClipboardCheck size={18} aria-hidden="true" /><span><strong>Review queue</strong><small>{metrics.pendingReviews} items awaiting a reviewer decision.</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        <Link href="/admin/training"><ScanSearch size={18} aria-hidden="true" /><span><strong>Training center</strong><small>Prepare approved data for the local model workflow.</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        <Link href="/admin/dataset"><Database size={18} aria-hidden="true" /><span><strong>Capture samples</strong><small>Open the camera workflow for a labelled gesture recording.</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}