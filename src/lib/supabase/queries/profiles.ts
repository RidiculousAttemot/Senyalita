// Admin authentication helpers.
// Relies on auth.users.app_metadata for role assignment instead of the
// now-removed profiles table. Admins must have { role: "admin" } in their
// auth user metadata (set via Supabase dashboard or API).

import "server-only";
import { createSupabaseServerClient } from "../server";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/server/http/errors";
import { isAdminEnabled } from "@/lib/admin/availability";

export const getCurrentUser = async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
};

/**
 * Asserts an authenticated admin session, or throws.
 *
 * Throws distinct error types so callers can tell "you are not signed in"
 * (401) from "you are signed in but not an admin" (403) from a genuine
 * server fault (500). Both extend Error, so the admin server components that
 * call this without a try/catch keep their existing error-boundary behaviour.
 */
export const requireAdmin = async (): Promise<{ id: string; email?: string }> => {
  // Second layer, deliberately redundant with the middleware.
  //
  // The middleware is the gate that actually runs first, but it depends on a
  // matcher pattern -- one edit to that regex and every privileged route below
  // is reachable again with nothing to notice. This check sits in the function
  // every admin route already calls, so the gate travels with the privilege
  // rather than with a routing config.
  //
  // NotFound, not Forbidden: the answer must not differ from a missing route.
  if (!isAdminEnabled()) throw new NotFoundError("Not found");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new UnauthenticatedError();
  if (user.app_metadata?.role !== "admin") throw new ForbiddenError();
  return { id: user.id, email: user.email };
};
