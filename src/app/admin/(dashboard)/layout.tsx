"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon?: string; comingSoon?: boolean }>;
}> = [
  {
    title: "Core Management",
    items: [
      { href: "/admin/gesture-library", label: "Sign Asset Library", icon: "📚" },
      { href: "/admin/gesture-library/import", label: "Import Assets", icon: "⬆️" },
      { href: "/admin/dataset", label: "Dataset", icon: "🗂️" },
      { href: "/admin/models", label: "Models", icon: "🤖" },
      { href: "/admin/translation", label: "Translation", icon: "🔤" },
    ],
  },
  {
    title: "Evaluation",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "📊" },
      { href: "/admin/monitoring", label: "Monitoring", icon: "📈" },
      { href: "/admin/model-health", label: "Model Health", icon: "❤️" },
      { href: "/admin/recognition-analysis", label: "Recognition Analysis", icon: "🔍" },
      { href: "/admin/animation-quality", label: "Animation Quality", icon: "✨" },
    ],
  },
  {
    title: "Learning / Content",
    items: [
      { href: "/admin/learning", label: "Learning", icon: "🎓" },
      { href: "/admin/knowledge-base", label: "Knowledge Base", icon: "🧠" },
      { href: "/admin/research", label: "Research", icon: "🔬" },
      { href: "/admin/research-insights", label: "Research Insights", icon: "💡" },
      { href: "/admin/coverage", label: "Gesture Coverage", icon: "📋" },
      { href: "/admin/coverage-translation", label: "Translation Coverage", icon: "🌐" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/users", label: "Users", icon: "👥" },
      { href: "/admin/system", label: "System Health", icon: "⚙️" },
      { href: "/admin/gestures", label: "Gestures", icon: "🤲" },
      { href: "/admin/replies", label: "Suggested Replies", icon: "💬" },
      { href: "/admin/animations", label: "Animations", icon: "🎞️" },
      { href: "/admin/animation-usage", label: "Animation Usage", icon: "📊" },
      { href: "/admin/conversations", label: "Conversations", icon: "💭" },
      { href: "/admin/conversation-intelligence", label: "Conv. Intelligence", icon: "🧠" },
      { href: "/admin/review", label: "Review", icon: "✅" },
      { href: "/admin/active-learning", label: "Active Learning", icon: "🔄" },
      { href: "/admin/models/training", label: "Model Training", icon: "🏋️" },
    ],
  },
];

const SidebarLink = ({
  href,
  label,
  icon,
  comingSoon,
  isActive,
}: {
  href: string;
  label: string;
  icon?: string;
  comingSoon?: boolean;
  isActive: boolean;
}) => (
  <Link
    href={href}
    className={`sidebar-link ${isActive ? "sidebar-link-active" : ""} ${comingSoon ? "sidebar-link-disabled" : ""}`}
    aria-current={isActive ? "page" : undefined}
    aria-disabled={comingSoon}
    tabIndex={comingSoon ? -1 : undefined}
    onClick={comingSoon ? (e) => e.preventDefault() : undefined}
  >
    <span className="sidebar-icon" aria-hidden="true">{icon}</span>
    <span className="sidebar-label">{label}</span>
    {comingSoon && <span className="coming-soon-badge" aria-label="Coming soon">Soon</span>}
  </Link>
);

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="sidebar-layout">
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar-mobile-open" : ""}`}
        role="navigation"
        aria-label="Admin navigation"
      >
        <div className="sidebar-header">
          <Link href="/admin" className="sidebar-brand" aria-label="Admin Dashboard">
            <span className="sidebar-icon" aria-hidden="true">🛡️</span>
            <span className="sidebar-label">Senyalita Admin</span>
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Admin sections">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="sidebar-section">
              <span className="sidebar-section-title">{section.title}</span>
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  comingSoon={item.comingSoon}
                  isActive={!!pathname && (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/")))}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link href="/admin/logout" className="sidebar-link sidebar-link-logout">
            <span className="sidebar-icon" aria-hidden="true">🚪</span>
            <span className="sidebar-label">Logout</span>
          </Link>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <main className="sidebar-content" role="main">
        {children}
      </main>

      <nav className="sidebar-bottom-nav" aria-label="Mobile admin navigation">
        <Link href="/admin" className={`bottom-nav-link ${pathname === "/admin" ? "bottom-nav-active" : ""}`}>
          <span className="bottom-nav-icon">🏠</span>
          <span className="bottom-nav-label">Dashboard</span>
        </Link>
        <Link href="/admin/gesture-library" className={`bottom-nav-link ${pathname?.startsWith("/admin/gesture-library") ? "bottom-nav-active" : ""}`}>
          <span className="bottom-nav-icon">📚</span>
          <span className="bottom-nav-label">Library</span>
        </Link>
        <Link href="/admin/dataset" className={`bottom-nav-link ${pathname?.startsWith("/admin/dataset") ? "bottom-nav-active" : ""}`}>
          <span className="bottom-nav-icon">🗂️</span>
          <span className="bottom-nav-label">Dataset</span>
        </Link>
        <Link href="/admin/analytics" className={`bottom-nav-link ${pathname?.startsWith("/admin/analytics") ? "bottom-nav-active" : ""}`}>
          <span className="bottom-nav-icon">📊</span>
          <span className="bottom-nav-label">Analytics</span>
        </Link>
        <Link href="/admin/system" className={`bottom-nav-link ${pathname?.startsWith("/admin/system") ? "bottom-nav-active" : ""}`}>
          <span className="bottom-nav-icon">⚙️</span>
          <span className="bottom-nav-label">System</span>
        </Link>
      </nav>
    </div>
  );
}