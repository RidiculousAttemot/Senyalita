export default async function AdminOverviewPage() {
  // In local dev mode, Supabase queries are unavailable.
  // The layout already shows the local dev banner.
  const isLocalDev = process.env.NODE_ENV === "development";

  return (
    <div>
      <div className="admin-grid">
        <section className="panel">
          <h2>Alphabet / Sign Asset Library</h2>
          <p className="panel-note">
            Manage alphabet entries (A–Z) and sign assets for Type-to-Sign.
          </p>
          <ul className="admin-list">
            <li>
              <a href="/admin/gesture-library">
                View Alphabet Library
              </a>
            </li>
            <li>
              <a href="/admin/gesture-library/import">
                Import Gestures
              </a>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Quick links</h2>
          <ul className="admin-list">
            <li><a href="/admin/gestures">Manage Gestures</a></li>
            <li><a href="/admin/analytics">View Analytics</a></li>
            <li><a href="/admin/dataset">Dataset</a></li>
            <li><a href="/admin/system">System Health</a></li>
            <li><a href="/admin/model-health">Model Health</a></li>
            <li><a href="/admin/translation">Translation</a></li>
          </ul>
        </section>

        <section className="panel">
          <h2>Model & Recognition</h2>
          <ul className="admin-list">
            <li><a href="/admin/models">Models</a></li>
            <li><a href="/admin/models/training">Model Training</a></li>
            <li><a href="/admin/coverage">Gesture Coverage</a></li>
            <li><a href="/admin/recognition-analysis">Recognition Analysis</a></li>
          </ul>
        </section>
      </div>

      {isLocalDev && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Local Dev Info</h2>
          <p className="panel-note">
            Admin is running in local/developer mode.
            Supabase-dependent features (sessions, analytics, review queue)
            are unavailable until a Supabase session is established.
            Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code> to
            protect this page.
          </p>
        </section>
      )}
    </div>
  );
}
