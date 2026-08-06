/**
 * Whether the admin surface exists in this environment.
 *
 * The admin is a content-authoring tool, not a runtime dependency. Published
 * assets are served from Supabase, so publishing from localhost reaches the
 * deployed site immediately -- the deployed build has no reason to carry an
 * authoring UI or the elevated routes behind it.
 *
 * DEFAULT OFF, AND DELIBERATELY NOT INFERRED. It would be shorter to key this
 * off NODE_ENV, but that reads as "development mode" rather than "the admin is
 * reachable", and the two come apart the moment someone runs a production
 * build locally or a preview deployment sets NODE_ENV=development. An explicit
 * flag that must be switched on says exactly one thing, and a missing
 * environment variable fails closed rather than open.
 *
 * Set ADMIN_ENABLED=true in .env.local for local authoring. Never set it on a
 * deployed environment.
 */
export const ADMIN_ENABLED_ENV = "ADMIN_ENABLED";

export function isAdminEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[ADMIN_ENABLED_ENV];
  return raw === "1" || raw === "true";
}

/** Matches /admin and /admin/anything, but not /administrators. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Matches the privileged API surface.
 *
 * Gating the pages while leaving these reachable would be worse than doing
 * nothing: the pages are a shell, and these routes are what actually hold the
 * service-role client.
 */
export function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

/** Every path the gate must cover. */
export function isAdminSurfacePath(pathname: string): boolean {
  return isAdminPath(pathname) || isAdminApiPath(pathname);
}
