import { describe, expect, it } from "vitest";
import { ADMIN_NAVIGATION, isAdminNavigationItemActive } from "@/lib/admin/navigation";

describe("admin navigation", () => {
  it("exposes the sections that survived the scope reduction", () => {
    // Six sections became three. Recognition, AI Operations and Analytics were
    // removed outright rather than left as headings with no children.
    expect(ADMIN_NAVIGATION.map((section) => section.label)).toEqual([
      "Dashboard",
      "Animations",
      "System",
    ]);
  });

  it("matches a nested route without activating unrelated routes", () => {
    // Repointed from /admin/models, which was deleted. animation-studio is a
    // non-exact entry, so it exercises the same prefix-matching behaviour
    // against a route that actually exists.
    const studio = ADMIN_NAVIGATION.flatMap((section) => section.items).find(
      (item) => item.href === "/admin/animation-studio"
    );

    expect(studio).toBeDefined();
    expect(isAdminNavigationItemActive("/admin/animation-studio/anything", studio!)).toBe(true);
    expect(isAdminNavigationItemActive("/admin/animation-dataset", studio!)).toBe(false);
  });

  it("treats the dashboard overview as an exact match only", () => {
    const overview = ADMIN_NAVIGATION.flatMap((section) => section.items).find(
      (item) => item.href === "/admin"
    );

    expect(overview?.exact).toBe(true);
    expect(isAdminNavigationItemActive("/admin", overview!)).toBe(true);
    // Without `exact`, every admin route would light up the Overview entry.
    expect(isAdminNavigationItemActive("/admin/system", overview!)).toBe(false);
  });

  it("has no item without a destination", () => {
    // The old menu carried a "Settings" entry with no href, marked
    // unavailable — a permanently dead control. Nothing like it remains.
    for (const item of ADMIN_NAVIGATION.flatMap((section) => section.items)) {
      expect(item.href, `"${item.label}" has no href`).toBeTruthy();
      expect(item.unavailable ?? false).toBe(false);
    }
  });
});
