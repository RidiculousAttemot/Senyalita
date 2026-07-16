'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, X } from 'lucide-react';
import { ADMIN_NAVIGATION, isAdminNavigationItemActive } from '@/lib/admin/navigation';
import styles from './AdminSidebar.module.css';

type AdminSidebarProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

export default function AdminSidebar({
  collapsed = false,
  onCollapsedChange = () => undefined,
  mobileOpen = false,
  onMobileOpenChange = () => undefined,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
      aria-label="Admin navigation"
    >
      <div className={styles.branding}>
        <Link href="/admin" className={styles.brandLink} onClick={() => onMobileOpenChange(false)}>
          <span className={styles.brandIcon} aria-hidden="true"><Sparkles size={18} strokeWidth={2.25} /></span>
          {!collapsed && <span className={styles.brandText}>Senyalita</span>}
        </Link>
        {!collapsed && <span className={styles.brandSubtext}>AI Operations</span>}
        <button
          type="button"
          className={styles.collapseButton}
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <button
          type="button"
          className={styles.mobileClose}
          onClick={() => onMobileOpenChange(false)}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.navGroups}>
        {ADMIN_NAVIGATION.map((section) => (
          <section key={section.label} className={styles.navGroup} aria-label={section.label}>
            {!collapsed && <h2 className={styles.groupLabel}>{section.label}</h2>}
            <div className={styles.groupItems}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isAdminNavigationItemActive(pathname ?? '', item);
                const content = <><Icon size={17} strokeWidth={1.9} /><span className={styles.itemLabel}>{item.label}</span></>;

                return item.href ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => onMobileOpenChange(false)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    className={`${styles.navItem} ${styles.navItemDisabled}`}
                    disabled={item.unavailable}
                    title={collapsed ? `${item.label} (coming soon)` : undefined}
                  >
                    {content}
                    {!collapsed && <span className={styles.comingSoonBadge}>Soon</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.sidebarFooter}>
        <Link href="/admin/logout" className={styles.logoutButton}>
          <LogOut size={17} />
          {!collapsed && <span>Logout</span>}
        </Link>
      </div>
    </nav>
  );
}