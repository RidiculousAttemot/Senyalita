// Admin authentication helpers.
// Relies on auth.users.app_metadata for role assignment instead of the
// now-removed profiles table. Admins must have { role: "admin" } in their
// auth user metadata (set via Supabase dashboard or API).

import "server-only";
import { createSupabaseServerClient } from "../server";

export const getCurrentUser = async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
};

export const requireAdmin = async (): Promise<{ id: string; email?: string }> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  if (user.app_metadata?.role !== "admin") throw new Error("admin only");
  return { id: user.id, email: user.email };
};
