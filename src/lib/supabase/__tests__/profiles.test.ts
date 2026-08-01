import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthenticatedError } from "@/server/http/errors";

const getUser = vi.fn();

// requireAdmin() is the single gate every admin page and /api/admin/* route
// relies on — this stubs the Supabase client it builds on so the role check
// itself is exercised, not a live session.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

const { requireAdmin, getCurrentUser } = await import("../queries/profiles");

describe("requireAdmin", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("throws UnauthenticatedError when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws ForbiddenError when signed in with no role set", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com", app_metadata: {} } } });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when app_metadata.role is not exactly admin", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { role: "editor" } } } });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("resolves the user id and email when app_metadata.role is admin", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "admin@senyalita.app", app_metadata: { role: "admin" } } },
    });
    await expect(requireAdmin()).resolves.toEqual({ id: "u1", email: "admin@senyalita.app" });
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns the Supabase user when a session exists", async () => {
    const user = { id: "u1", app_metadata: {} };
    getUser.mockResolvedValue({ data: { user } });
    await expect(getCurrentUser()).resolves.toBe(user);
  });
});
