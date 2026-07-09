import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOOL_CATEGORIES = [
  {
    id: "core",
    label: "Core Management",
    icon: "📦",
    color: "var(--primary)",
    tools: [
      { href: "/admin/gesture-library", label: "Sign Asset Library", desc: "Alphabet entries, gesture assets, import reference clips", implemented: true },
      { href: "/admin/dataset", label: "Dataset", desc: "Inspect captured samples, coverage, and recognition health", implemented: true },
      { href: "/admin/models", label: "Models", desc: "Model management, training, and deployment", implemented: true },
      { href: "/admin/translation", label: "Translation", desc: "Translation rules, glossary, and Type-to-Sign configuration", implemented: true },
    ],
  },
  {
    id: "evaluation",
    label: "Evaluation",
    icon: "📊",
    color: "#059669",
    tools: [
      { href: "/admin/analytics", label: "Analytics", desc: "Usage metrics, translation stats, and performance dashboards", implemented: true },
      { href: "/admin/monitoring", label: "Monitoring", desc: "System health, error tracking, and uptime monitoring", implemented: true },
      { href: "/admin/model-health", label: "Model Health", desc: "Model performance, drift detection, and accuracy tracking", implemented: true },
      { href: "/admin/recognition-analysis", label: "Recognition Analysis", desc: "Detailed gesture recognition accuracy and confusion matrices", implemented: true },
    ],
  },
  {
    id: "learning",
    label: "Learning & Content",
    icon: "📚",
    color: "#d97706",
    tools: [
      { href: "/admin/learning", label: "Learning", desc: "Active learning pipelines and annotation workflows", implemented: true },
      { href: "/admin/knowledge-base", label: "Knowledge Base", desc: "Documentation, guides, and reference materials", implemented: true },
      { href: "/admin/research", label: "Research", desc: "Research experiments, ablation studies, and findings", implemented: true },
      { href: "/admin/research-insights", label: "Research Insights", desc: "Curated insights from research and evaluations", implemented: true },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: "⚙️",
    color: "#6366f1",
    tools: [
      { href: "/admin/users", label: "Users", desc: "User management and role administration", implemented: true },
      { href: "/admin/system", label: "System Health", desc: "Infrastructure status, logs, and diagnostics", implemented: true },
      { href: "/admin/gesture-library/import", label: "Import", desc: "Bulk import gestures, assets, and annotations", implemented: true },
      { href: "/admin/collection", label: "Collection", desc: "Data collection campaigns and session management", implemented: true },
    ],
  },
];

const STATUS_ITEMS = [
  { label: "Auth Provider", value: "Supabase Auth", icon: "🔐" },
  { label: "Required Role", value: "admin (app_metadata)", icon: "👤" },
  { label: "Current Model", value: "Unified BiLSTM v4", icon: "🧠" },
  { label: "Type-to-Sign", value: "Alphabet-first", icon: "⌨️" },
  { label: "Sign-to-Text", value: "Active", icon: "📹" },
];

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = user?.app_metadata?.role === "admin";

  return (
    <main className="sidebar-content">
      <header className="dashboard-header">
        <div>
          <p className="admin-kicker">Senyalita Admin</p>
          <h1>Dashboard</h1>
          <p className="panel-note">
            {isAdmin
              ? `Signed in as ${user?.email ?? "admin"} — Supabase-backed admin access`
              : "Admin access requires a Supabase account with <code>app_metadata.role = \"admin\"</code>."}
          </p>
        </div>
        <div className="dashboard-status">
          <span className={`status ${isAdmin ? "status-hand-1" : "status-no-hand"}`}>
            {isAdmin ? "Authenticated" : "Locked"}
          </span>
          <a className="button button-secondary" href="/admin/logout">
            Logout
          </a>
        </div>
      </header>

      <section className="dashboard-status-grid" aria-label="System status">
        {STATUS_ITEMS.map((item) => (
          <article key={item.label} className="dashboard-stat-card">
            <span className="dashboard-stat-icon" aria-hidden="true">{item.icon}</span>
            <div>
              <dt className="dashboard-stat-label">{item.label}</dt>
              <dd className="dashboard-stat-value">{item.value}</dd>
            </div>
          </article>
        ))}
      </section>

      {TOOL_CATEGORIES.map((category) => (
        <section key={category.id} className="dashboard-category" aria-labelledby={`${category.id}-heading`}>
          <header className="dashboard-category-header">
            <span className="dashboard-category-icon" aria-hidden="true" style={{ color: category.color }}>
              {category.icon}
            </span>
            <h2 id={`${category.id}-heading`} className="dashboard-category-title">
              {category.label}
            </h2>
          </header>
          <div className="dashboard-tool-grid">
            {category.tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={`dashboard-tool-card ${!tool.implemented ? "dashboard-tool-card--disabled" : ""}`}
                aria-disabled={!tool.implemented}
                tabIndex={tool.implemented ? 0 : -1}
              >
                <h3 className="dashboard-tool-title">{tool.label}</h3>
                <p className="dashboard-tool-desc">{tool.desc}</p>
                {!tool.implemented && (
                  <span className="dashboard-tool-badge">Coming Soon</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <footer className="dashboard-footer">
        <p>
          Senyalita Admin — Thesis Demo ·{" "}
          <a href="/admin/logout">Sign out</a>
        </p>
      </footer>
    </main>
  );
}