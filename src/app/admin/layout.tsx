import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

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
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  const expectedToken = process.env.ADMIN_PASSWORD
    ? hashToken(process.env.ADMIN_PASSWORD)
    : null;

  // Login route must stay public to avoid redirect loops.
  const headersList = await headers();
  const currentPath = headersList.get("x-pathname") || "";
  const isLoginPage =
    currentPath === "/admin/login" || currentPath.startsWith("/admin/login/");

  const isAuthenticated = !!(
    sessionToken &&
    expectedToken &&
    sessionToken === expectedToken
  );

  if (!isAuthenticated && !isLoginPage) {
    if (process.env.NODE_ENV === "development") {
      const adminPasswordSet = !!process.env.ADMIN_PASSWORD;
      if (!adminPasswordSet) {
        redirect("/admin/login?setup=1");
      }
    }
    redirect("/admin/login");
  }

  const isLocalDev = process.env.NODE_ENV === "development";

  return (
    <main className="page">
      <div
        style={{
          background: "#f59e0b",
          color: "#1e293b",
          padding: "8px 16px",
          textAlign: "center",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Local developer admin only. No production authentication/backend yet.
      </div>
      <div className="admin-header">
        <h1>Admin</h1>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} className="admin-nav-link" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </main>
  );
}

function hashToken(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "admin_" + Math.abs(hash).toString(36);
}
