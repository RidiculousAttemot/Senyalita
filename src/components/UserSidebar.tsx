"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/translate", label: "Translate", icon: "📷" },
  { href: "/conversation", label: "Conversation", icon: "💬" },
  { href: "/learn", label: "Learn FSL", icon: "📚" },
  { href: "/history", label: "History", icon: "📋" },
];

export const UserSidebar = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname ? (pathname === href || pathname.startsWith(href + "/")) : false;

  return (
    <div className="sidebar-layout">
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/translate" className="sidebar-brand">
            {collapsed ? "SNY" : "Senyalita"}
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive(item.href) ? "sidebar-link-active" : ""}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link href="/" className="sidebar-link">
            <span className="sidebar-icon">🏠</span>
            {!collapsed && <span className="sidebar-label">Home</span>}
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <main className="sidebar-content">
        <button
          className="sidebar-mobile-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          ☰
        </button>
        {children}
      </main>

      <nav className="sidebar-bottom-nav">
        {NAV_ITEMS.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-link ${isActive(item.href) ? "bottom-nav-active" : ""}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
