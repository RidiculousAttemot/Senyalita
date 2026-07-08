// Next.js middleware: refreshes the Supabase session on every request and
// gates protected routes that require a Supabase session.
//
// Admin routes are NOT gated here — the admin layout
// (`src/app/admin/layout.tsx`) handles auth via the `admin_session` cookie /
// ADMIN_PASSWORD, using a different auth mechanism.
//
// Auth gate: an unauthenticated visitor hitting a protected path is sent
// to /login?next=<original>.

import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, updateSupabaseSession } from "@/lib/supabase/middleware";

export const middleware = async (request: NextRequest) => {
  const { response, user } = await updateSupabaseSession(request);
  const { pathname, search } = request.nextUrl;

  // Expose the current pathname to layouts (e.g. admin layout) via a custom
  // header so they can conditionally skip their own auth checks.
  response.headers.set("x-pathname", pathname);

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return response;
};

export const config = {
  matcher: [
    // Skip Next.js internals and static files; refresh on everything else.
    "/((?!_next/static|_next/image|favicon.ico|models|public).*)"
  ]
};
