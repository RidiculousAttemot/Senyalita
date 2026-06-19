import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { listAllGesturesAdmin } from "@/lib/supabase/queries/gestures";
import { listAllSessions } from "@/lib/supabase/queries/translations";
import { fetchAdminAnalytics } from "@/lib/supabase/queries/analytics";

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const [gestures, sessions, analytics] = await Promise.all([
    listAllGesturesAdmin(),
    listAllSessions(5, 0),
    fetchAdminAnalytics(30)
  ]);

  return (
    <div>
      <p className="panel-note">
        Welcome {admin.email ?? "admin"}. You have full read/write access
        to the platform data.
      </p>
      <div className="admin-cards">
        <div className="analytics-card">
          <span className="analytics-label">Total sessions</span>
          <span className="analytics-value">{analytics.totals.sessions}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Total predictions</span>
          <span className="analytics-value">{analytics.totals.translations}</span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Avg confidence</span>
          <span className="analytics-value">
            {(analytics.totals.avg_confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="analytics-card">
          <span className="analytics-label">Gestures in library</span>
          <span className="analytics-value">{gestures.length}</span>
        </div>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h2>Recent sessions</h2>
          {sessions.rows.length === 0 ? (
            <p className="panel-note">No sessions yet.</p>
          ) : (
            <ul className="admin-list">
              {sessions.rows.map((s) => (
                <li key={s.id}>
                  <code>{s.id.slice(0, 8)}</code> ·{" "}
                  {new Date(s.started_at).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Quick links</h2>
          <ul className="admin-list">
            <li><a href="/admin/gestures">Manage Gestures</a></li>
            <li><a href="/admin/analytics">View Analytics</a></li>
            <li><a href="/admin/review">Review Queue</a></li>
            <li><a href="/admin/system">System Health</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
