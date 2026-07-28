import type { LucideIcon } from "lucide-react";
import { Activity, Database, Film, Gauge, LayoutDashboard, Wand2 } from "lucide-react";

export type AdminNavigationItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  exact?: boolean;
  unavailable?: boolean;
};

export type AdminNavigationSection = {
  label: string;
  items: AdminNavigationItem[];
};

/**
 * Admin navigation, scoped to the animation pipeline.
 *
 * Reduced from six sections / 24 items to three / six. The Recognition,
 * AI Operations and Analytics sections are gone entirely rather than left as
 * headings with no children — every page beneath them was out of scope for
 * the two supported workflows.
 *
 * Every href here must resolve to a real route. e2e/admin-nav.spec.ts asserts
 * exactly that, because a nav entry pointing at a deleted page is invisible
 * to typecheck, lint and the build.
 */
export const ADMIN_NAVIGATION: AdminNavigationSection[] = [
  {
    label: "Dashboard",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Animations",
    items: [
      { label: "Animation Studio", href: "/admin/animation-studio", icon: Wand2 },
      { label: "Animation Dataset", href: "/admin/animation-dataset", icon: Database },
      { label: "Animation Library", href: "/admin/animation-library", icon: Film },
      { label: "Animation Inspector", href: "/admin/animation-inspector", icon: Activity },
    ],
  },
  {
    label: "System",
    items: [{ label: "System Health", href: "/admin/system", icon: Gauge }],
  },
];

export const isAdminNavigationItemActive = (
  pathname: string,
  item: AdminNavigationItem
): boolean => {
  if (!item.href) return false;
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
};
