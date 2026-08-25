import type { LucideIcon } from "lucide-react";
import { Activity, Database, Film, Gauge, LayoutDashboard, Wand2 } from "lucide-react";

export type AdminNavigationItem = {
  /**
   * What the sidebar prints. Inside a group this is the distinguishing word
   * only -- see the Animations section below.
   */
  label: string;
  /**
   * The name on its own, for tooltips, aria-label and anywhere the group
   * heading is not also on screen. Collapsing the sidebar hides the headings,
   * so without this a tooltip reading "Studio" would be no more identifying
   * than the icon it describes.
   */
  fullLabel?: string;
  href?: string;
  icon: LucideIcon;
  exact?: boolean;
  unavailable?: boolean;
};

/** The name to speak or show in a tooltip, which is never the shortened one. */
export const navigationItemName = (item: AdminNavigationItem): string =>
  item.fullLabel ?? item.label;

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
  /**
   * Four of the six entries used to begin "Animation", under a heading that
   * already says Animations. Scanning them meant reading to the ninth
   * character; three of the four then truncated to the same "Ani" the moment
   * the sidebar narrowed. The heading carries the shared word, so each item
   * only has to carry what makes it different.
   */
  {
    label: "Animations",
    items: [
      { label: "Studio", fullLabel: "Animation Studio", href: "/admin/animation-studio", icon: Wand2 },
      { label: "Dataset", fullLabel: "Animation Dataset", href: "/admin/animation-dataset", icon: Database },
      { label: "Library", fullLabel: "Animation Library", href: "/admin/animation-library", icon: Film },
      { label: "Inspector", fullLabel: "Animation Inspector", href: "/admin/animation-inspector", icon: Activity },
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
