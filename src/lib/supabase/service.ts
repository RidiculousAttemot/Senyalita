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
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next's App Router patches global fetch and caches it. That silently
      // memoised storage.createSignedUrl(), so a warm function kept handing out
      // one token long after its `exp` passed: production returned 400
      // InvalidJWT ("exp claim timestamp check failed") on a request Vercel
      // reported as X-Vercel-Cache: MISS, Age: 0 — a genuinely fresh request
      // replaying a 34-minute-old signature.
      //
      // Nothing this client does should ever be served from a cache: signatures
      // are time-bound and every read is meant to reflect the database now.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
};
