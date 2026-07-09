"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type SidebarItem = {
  href?: string;
  label: string;
  description?: string;
  comingSoon?: boolean;
  matches?: string[];
};

type SidebarSection = {
  title: string;
  icon: string;
  items: SidebarItem[];
};

const SECTIONS: SidebarSection[] = [
  {
    title: "Core",
    icon: "⌂",
    items: [
      { href: "/admin", label: "Dashboard", matches: ["/admin"] },
      { href: "/admin/gesture-library", label: "Sign Asset Library", description: "Alphabet entries and sign assets" },
      { href: "/admin/gesture-library/import", label: "Import Assets", description: "Bulk import gesture assets" },
      { href: "/admin/dataset", label: "Dataset", description: "Capture sessions and samples" },
      { href: "/admin/models", label: "Models", description: "Versioning and deployment" },
      { href: "/admin/translation", label: "Translation", description: "Type-to-Sign rules" },
    ],
  },
  {
    title: "Audits",
    icon: "◌",
    items: [
      { href: "/admin/analytics", label: "Analytics", description: "Usage and recognition trends" },
      { href: "/admin/monitoring", label: "Monitoring", description: "Performance and feedback" },
      { href: "/admin/model-health", label: "Model Health", description: "Coverage and health signals" },
      { href: "/admin/recognition-analysis", label: "Recognition Analysis", description: "Confusions and errors" },
      { href: "/admin/animation-quality", label: "Animation Quality", description: "Asset timing and polish" },
    ],
  },
  {
    title: "Content",
    icon: "▣",
    items: [
      { href: "/admin/learning", label: "Learning", description: "Active learning workflows" },
      { href: "/admin/knowledge-base", label: "Knowledge Base", description: "Gesture metadata and notes" },
      { href: "/admin/research", label: "Research", description: "Experiments and findings" },
    ],
  },
  {
    title: "System",
    icon: "⚙",
    items: [
      { href: "/admin/users", label: "Users", description: "Supabase admin accounts" },
      { href: "/admin/system", label: "System Health", description: "Status cards and diagnostics" },
      { label: "Settings", description: "Planned admin preferences", comingSoon: true },
    ],
  },
  {
    title: "Account",
    icon: "↗",
    items: [{ href: "/admin/logout", label: "Logout", description: "End the admin session" }],
  },
];

const isItemActive = (pathname: string, item: SidebarItem): boolean => {
  if (item.matches?.some((match) => pathname === match || pathname.startsWith(`${match}/`))) {
    return true;
  }

  return !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initialOpen = useMemo(() => {
    const openMap: Record<string, boolean> = {};
    for (const section of SECTIONS) {
      openMap[section.title] = section.items.some((item) => item.href && isItemActive(pathname, item));
    }
    return openMap;
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  const toggleGroup = (title: string) => {
    setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
  };

  return (
    <>
      <button
        type="button"
        className="admin-sidebar-trigger"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open admin navigation"
      >
        ☰
      </button>

      <div className={`admin-sidebar-backdrop ${drawerOpen ? "is-visible" : ""}`} onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <aside className={`admin-sidebar ${drawerOpen ? "is-open" : ""}`} aria-label="Admin navigation">
        <div className="admin-sidebar-top">
          <Link href="/admin" className="admin-brand" onClick={() => setDrawerOpen(false)}>
            <span className="admin-brand-mark" aria-hidden="true">S</span>
            <span>
              <strong>Senyalita</strong>
              <small>Admin</small>
            </span>
          </Link>
          <button
            type="button"
            className="admin-sidebar-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close admin navigation"
          >
            ✕
          </button>
        </div>

        <div className="admin-sidebar-scroll">
          {SECTIONS.map((section) => {
            const expanded = openGroups[section.title] ?? false;
            return (
              <section key={section.title} className="admin-sidebar-group">
                <button
                  type="button"
                  className="admin-sidebar-group-button"
                  aria-expanded={expanded}
                  onClick={() => toggleGroup(section.title)}
                >
                  <span className="admin-sidebar-group-title">
                    <span className="admin-sidebar-group-icon" aria-hidden="true">{section.icon}</span>
                    {section.title}
                  </span>
                  <span aria-hidden="true" className="admin-sidebar-group-caret">{expanded ? "▾" : "▸"}</span>
                </button>

                {expanded && (
                  <ul className="admin-sidebar-list">
                    {section.items.map((item) => {
                      const active = item.href ? isItemActive(pathname, item) : false;
                      const content = (
                        <>
                          <span className="admin-sidebar-link-label">{item.label}</span>
                          {item.description && <span className="admin-sidebar-link-description">{item.description}</span>}
                          {item.comingSoon && <span className="admin-sidebar-coming-soon">Coming soon</span>}
                        </>
                      );

                      return (
                        <li key={item.label}>
                          {item.href && !item.comingSoon ? (
                            <Link
                              href={item.href}
                              className={`admin-sidebar-link ${active ? "is-active" : ""}`}
                              aria-current={active ? "page" : undefined}
                              onClick={() => setDrawerOpen(false)}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div className="admin-sidebar-link is-disabled" aria-disabled="true">
                              {content}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}