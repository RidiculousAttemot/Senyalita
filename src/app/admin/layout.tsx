import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
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
  { href: "/admin/gesture-library/import", label: "Import" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/models", label: "Models" },
  { href: "/admin/knowledge-base", label: "Knowledge Base" },
  { href: "/admin/learning", label: "Learning" },
  { href: "/admin/research", label: "Research" },
  { href: "/admin/coverage", label: "Coverage" },
  { href: "/admin/system", label: "System Health" },
  { href: "/admin/models/training", label: "Model Training" },
];

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    redirect("/admin/login");
  }

  // Fetch pending review count for badge
  let pendingCount = 0;
  try {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from("review_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  } catch {}

  return (
    <main className="page">
      <div className="admin-header">
        <h1>Admin · {admin.email ?? admin.id}</h1>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} className="admin-nav-link" href={item.href}>
              {item.label}
              {item.href === "/admin/review" && pendingCount > 0 && (
                <span className="review-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </main>
  );
}
