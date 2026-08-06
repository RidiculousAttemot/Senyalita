import { describe, expect, it } from "vitest";
import {
  ADMIN_ENABLED_ENV,
  isAdminApiPath,
  isAdminEnabled,
  isAdminPath,
  isAdminSurfacePath,
} from "../admin/availability";

/**
 * The flag decides whether an elevated surface exists, so the thing worth
 * pinning is that it fails CLOSED. Every accident -- a typo, a missing
 * variable, a value copied from a different provider's conventions -- must
 * land on "admin is gone" rather than "admin is open".
 */

describe("isAdminEnabled", () => {
  it("is off when the variable is absent", () => {
    expect(isAdminEnabled({})).toBe(false);
  });

  it("is on only for an explicit true or 1", () => {
    expect(isAdminEnabled({ [ADMIN_ENABLED_ENV]: "true" })).toBe(true);
    expect(isAdminEnabled({ [ADMIN_ENABLED_ENV]: "1" })).toBe(true);
  });

  it("fails closed on everything else", () => {
    // "yes"/"on"/"TRUE" are the values someone reaches for from another
    // provider's conventions. Each must be off, not quietly on.
    for (const value of ["", "false", "0", "yes", "on", "TRUE", "True", "enabled", " true", "undefined"]) {
      expect(isAdminEnabled({ [ADMIN_ENABLED_ENV]: value }), `${JSON.stringify(value)} must be off`).toBe(false);
    }
  });

  it("does not read NODE_ENV", () => {
    // The whole point of an explicit flag: a development build with no flag is
    // still gated, and a production build with the flag is still open. Neither
    // is inferred.
    expect(isAdminEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isAdminEnabled({ NODE_ENV: "production", [ADMIN_ENABLED_ENV]: "true" })).toBe(true);
  });
});

describe("path matching", () => {
  it("covers the admin pages", () => {
    for (const p of ["/admin", "/admin/", "/admin/login", "/admin/animation-studio", "/admin/a/b/c"]) {
      expect(isAdminPath(p), p).toBe(true);
    }
  });

  it("covers the privileged API routes", () => {
    for (const p of ["/api/admin", "/api/admin/health", "/api/admin/animation-assets/x/action"]) {
      expect(isAdminApiPath(p), p).toBe(true);
    }
  });

  it("does not swallow unrelated paths that merely start with the same letters", () => {
    // /administrators would be gated by a naive startsWith("/admin").
    for (const p of ["/administrators", "/adminish", "/api/administrators", "/translate", "/api/animations", "/"]) {
      expect(isAdminSurfacePath(p), p).toBe(false);
    }
  });

  it("treats the public API and the admin API differently", () => {
    // /api/animations is what the deployed site depends on. Gating it would
    // break Text-to-Sign everywhere.
    expect(isAdminSurfacePath("/api/animations")).toBe(false);
    expect(isAdminSurfacePath("/api/animations/HELLO")).toBe(false);
    expect(isAdminSurfacePath("/api/admin/animation-assets")).toBe(true);
  });
});
