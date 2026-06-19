// Browser-side Supabase client. Use inside React components / client code.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export const createSupabaseBrowserClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "See docs/supabase-setup.md."
    );
  }
  return createBrowserClient<Database>(url, anonKey);
};
