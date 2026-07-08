// Middleware helper: keep the Supabase session cookie fresh on every request.
// Called from src/middleware.ts (Next.js middleware) for protected routes.
//
// Admin routes are NOT listed here — the admin layout (`src/app/admin/layout.tsx`)
// handles auth via the `admin_session` cookie / ADMIN_PASSWORD, which is a
// different auth mechanism from Supabase.  Including `/admin` here would cause
// a redirect loop because the middleware would redirect `/admin/login` to itself.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

// Protected routes that require a Supabase session (not admin routes).
const PROTECTED_PREFIXES: string[] = [];

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const updateSupabaseSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Without env we cannot refresh; pass through.
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options as CookieOptions);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  return { response, user };
};
