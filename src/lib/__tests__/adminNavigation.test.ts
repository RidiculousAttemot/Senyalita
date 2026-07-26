import { describe, expect, it } from "vitest";
import { ADMIN_NAVIGATION, isAdminNavigationItemActive } from "@/lib/admin/navigation";

describe("admin navigation", () => {
  it("exposes the required control-center sections", () => {
    // The flat 12-entry menu was consolidated into six grouped sections; the
    // former top-level entries are now items nested inside these.
    expect(ADMIN_NAVIGATION.map((section) => section.label)).toEqual([
      "Dashboard",
      "Recognition",
      "Type-to-Sign",
      "AI Operations",
      "Analytics",
      "System",
    ]);
  });

  it("matches a nested route without activating unrelated routes", () => {
    const models = ADMIN_NAVIGATION.flatMap((section) => section.items).find(
      (item) => item.href === "/admin/models"
    );

    expect(models).toBeDefined();
    expect(isAdminNavigationItemActive("/admin/models/training", models!)).toBe(true);
    expect(isAdminNavigationItemActive("/admin/model-health", models!)).toBe(false);
  });

  it("routes Dataset Manager to the collection dashboard rather than the capture camera", () => {
    const datasetManager = ADMIN_NAVIGATION.flatMap((section) => section.items).find(
      (item) => item.label === "Dataset Manager"
    );

    expect(datasetManager?.href).toBe("/admin/collection");
  });
});