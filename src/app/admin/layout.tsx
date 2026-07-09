import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/collection", label: "Collection" },
  { href: "/admin/gestures", label: "Gestures" },
  { href: "/admin/replies", label: "Suggested replies" },
  { href: "/admin/dataset", label: "Dataset" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/monitoring", label: "Monitoring" },
  { href: "/admin/model-health", label: "Model Health" },
  { href: "/admin/translation", label: "Translation" },
  { href: "/admin/animations", label: "Animations" },
  { href: "/admin/animation-quality", label: "Animation Quality" },
  { href: "/admin/gesture-library", label: "Sign Asset Library" },
  { href: "/admin/gesture-library/import", label: "Import" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/conversation-intelligence", label: "Conv. Intelligence" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/models", label: "Models" },
  { href: "/admin/knowledge-base", label: "Knowledge Base" },
  { href: "/admin/learning", label: "Learning" },
  { href: "/admin/research", label: "Research" },
  { href: "/admin/coverage", label: "Gesture Coverage" },
  { href: "/admin/coverage-translation", label: "Translation Coverage" },
  { href: "/admin/system", label: "System Health" },
  { href: "/admin/models/training", label: "Model Training" },
  { href: "/admin/recognition-analysis", label: "Recognition Analysis" },
  { href: "/admin/animation-usage", label: "Animation Usage" },
  { href: "/admin/active-learning", label: "Active Learning" },
  { href: "/admin/research-insights", label: "Research Insights" },
];

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = user?.app_metadata?.role === "admin";

  return (
    <div className="admin-root-shell">
      <header className="admin-root-header">
        <div>
          <p className="admin-kicker">Senyalita admin</p>
          <h1>Compact admin workspace</h1>
          <p className="panel-note">
            {isAuthenticated
              ? `Signed in as ${user?.email ?? "admin"} with Supabase role metadata.`
              : "Supabase admin sign-in is required to open the dashboard."}
          </p>
        </div>
        <div className="admin-root-actions">
          <span className={`status ${isAuthenticated ? "status-hand-1" : "status-no-hand"}`}>
            {isAuthenticated ? "Authenticated" : "Locked"}
          </span>
          <Link className="button button-secondary admin-compact-button" href="/admin/logout">
            Logout
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
