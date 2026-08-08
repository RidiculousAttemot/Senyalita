/**
 * The public navigation, as data.
 *
 * Kept free of React imports so tests can read it directly. e2e/public-shell
 * asserts every entry resolves and that the right one is marked current, which
 * means importing this list -- and importing the component instead would drag
 * next/link into the Playwright process, where it cannot load.
 */
export const PUBLIC_NAV = [
  { name: "Home", href: "/" },
  { name: "Translate", href: "/translate" },
  { name: "Learn", href: "/learn" },
  { name: "Evaluation", href: "/evaluation" },
] as const;

export type PublicNavItem = (typeof PUBLIC_NAV)[number];

/**
 * Whether a nav entry is the current page.
 *
 * "/" is special-cased: under a plain startsWith it prefixes every route, so
 * Home would render as active everywhere.
 */
export function isActiveNav(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
