import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readdirSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminCollectionPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [
    { data: pendingReviews },
    { data: approvedSamples },
    { data: signerProfiles },
    { data: diversitySessions },
    { count: totalPredictions },
  ] = await Promise.all([
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("training_samples").select("id", { count: "exact", head: true }),
    supabase.from("signer_profiles").select("*"),
    supabase.from("session_diversity_metadata").select("*"),
    supabase.from("translation_logs").select("*", { count: "exact", head: true }),
  ]);

  // Load campaign definitions
  const campaignsDir = resolve(process.cwd(), "datasets/real_world/campaigns");
  let campaigns: Array<{ name: string; target: number; priority: string }> = [];
  if (existsSync(campaignsDir)) {
    for (const f of readdirSync(campaignsDir).filter(f => f.startsWith("campaign_") && f.endsWith(".json"))) {
      try {
        const c = JSON.parse(readFileSync(resolve(campaignsDir, f), "utf-8"));
        campaigns.push({
          name: c.campaign,
          target: c.target_samples ?? 20,
          priority: `P${c.priority - 1}`,
        });
      } catch {}
    }
  }

  // Load collected samples
  const collectedDir = resolve(process.cwd(), "datasets/real_world/collected");
  let collectedSamples = 0;
  let collectedSigners = new Set<string>();
  if (existsSync(collectedDir)) {
    for (const campaignDir of readdirSync(collectedDir)) {
      const campaignPath = resolve(collectedDir, campaignDir);
      if (!existsSync(campaignPath)) continue;
      for (const f of readdirSync(campaignPath).filter(f => f.endsWith(".json"))) {
        try {
          const data = JSON.parse(readFileSync(resolve(campaignPath, f), "utf-8"));
          collectedSamples += data.session?.samples_collected ?? 0;
          if (data.session?.signer_id) collectedSigners.add(data.session.signer_id);
        } catch {}
      }
    }
  }

  const pending = pendingReviews?.length ?? 0;
  const approved = approvedSamples?.length ?? 0;
  const signers = signerProfiles ?? [];
  const diversity = diversitySessions ?? [];

  return (
    <div>
      <h2>Data Collection Dashboard</h2>
      <p className="panel-note">
        Track real-world data collection progress for Phase 34 pilot deployment and difficult gesture campaigns.
      </p>

      <h3 className="analytics-section-title">Pipeline Overview</h3>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total predictions</span>
          <span className="analytics-value">{totalPredictions ?? 0}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Pending review</span>
          <span className="analytics-value">{pending}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Approved samples</span>
          <span className="analytics-value">{approved}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Registered signers</span>
          <span className="analytics-value">{signers.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Diversity sessions</span>
          <span className="analytics-value">{diversity.length}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Campaign samples</span>
          <span className="analytics-value">{collectedSamples}</span>
        </div>
      </div>

      <h3 className="analytics-section-title">Active Campaigns</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Priority</th>
              <th>Target</th>
              <th>Collected</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#888" }}>No campaigns defined</td></tr>
            ) : campaigns.map(c => {
              const cDir = c.name.toLowerCase();
              let collected = 0;
              if (existsSync(resolve(collectedDir, cDir))) {
                for (const f of readdirSync(resolve(collectedDir, cDir)).filter(f => f.endsWith(".json"))) {
                  try {
                    const data = JSON.parse(readFileSync(resolve(collectedDir, cDir, f), "utf-8"));
                    collected += data.session?.samples_collected ?? 0;
                  } catch {}
                }
              }
              const pct = Math.min(100, Math.round((collected / c.target) * 100));
              return (
                <tr key={c.name}>
                  <td><code>{c.name}</code></td>
                  <td>{c.priority}</td>
                  <td>{c.target}</td>
                  <td>{collected}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 8, background: "#333", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: pct >= 100 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444",
                          borderRadius: 4,
                          transition: "width 0.3s",
                        }} />
                      </div>
                      <span style={{ fontSize: 12, minWidth: 36 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="analytics-section-title">Signer Demographics</h3>
      {signers.length === 0 ? (
        <p className="panel-note">No signer profiles registered yet. Use <code>POST /api/signers/register</code> to register.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Signer ID</th>
                <th>Experience</th>
                <th>Handedness</th>
                <th>Age Range</th>
                <th>Sessions</th>
                <th>Gestures</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {signers.map(s => (
                <tr key={s.id}>
                  <td><code>{s.signer_id}</code></td>
                  <td>{s.signing_experience ?? "—"}</td>
                  <td>{s.handedness ?? "—"}</td>
                  <td>{s.age_range ?? "—"}</td>
                  <td>{s.total_sessions}</td>
                  <td>{s.total_gestures}</td>
                  <td style={{ fontSize: 12 }}>{s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="analytics-section-title">Diversity Coverage</h3>
      {diversity.length === 0 ? (
        <p className="panel-note">No diversity metadata captured yet. Enable client-side metadata capture.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { label: "Lighting", field: "lighting" as const },
              { label: "Camera Angle", field: "camera_angle" as const },
              { label: "Background", field: "background" as const },
              { label: "Hand Dominance", field: "hand_dominance" as const },
              { label: "Environment", field: "environment" as const },
            ].map(dim => {
              const counts: Record<string, number> = {};
              for (const d of diversity) {
                const val = d[dim.field] ?? "unknown";
                counts[val] = (counts[val] ?? 0) + 1;
              }
              return (
                <div key={dim.field} className="panel" style={{ padding: 12 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>{dim.label}</h4>
                  {Object.entries(counts).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>{k}</span>
                      <span style={{ color: "#888" }}>{v}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 className="analytics-section-title">Quick Actions</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/admin/review" className="button">Review Queue ({pending})</a>
        <a href="/admin/models/training" className="button button-secondary">Training Center</a>
        <a href="/admin/dataset" className="button button-secondary">Dataset Manager</a>
      </div>
    </div>
  );
}
