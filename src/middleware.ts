// Next.js middleware: refreshes the Supabase session on every request and
// gates protected routes (`/camera`, `/history`, `/profile`, `/admin`).
//
// Auth gate: an unauthenticated visitor hitting a protected path is sent
// to /login?next=<original>.

import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, updateSupabaseSession } from "@/lib/supabase/middleware";

export const middleware = async (request: NextRequest) => {
  const { response, user } = await updateSupabaseSession(request);
  const { pathname, search } = request.nextUrl;

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
