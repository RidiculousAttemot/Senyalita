// Admin authentication helpers.
// Relies on auth.users.app_metadata for role assignment instead of the
// now-removed profiles table. Admins must have { role: "admin" } in their
// auth user metadata (set via Supabase dashboard or API).

import "server-only";
import { createSupabaseServerClient } from "../server";
import { ForbiddenError, UnauthenticatedError } from "@/server/http/errors";

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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new UnauthenticatedError();
  if (user.app_metadata?.role !== "admin") throw new ForbiddenError();
  return { id: user.id, email: user.email };
};
