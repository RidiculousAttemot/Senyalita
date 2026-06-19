// Service-role client. BYPASSES RLS — server-only, never expose to the browser.
// Use for admin tasks that need to read/write across users (analytics, admin
// gesture uploads, promote_user/demote_user wrappers).

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const createSupabaseServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Service-role operations must run on the server."
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};
