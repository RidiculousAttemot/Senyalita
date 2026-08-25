import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, updateSupabaseSession } from "@/lib/supabase/middleware";
import { isAdminEnabled, isAdminSurfacePath } from "@/lib/admin/availability";

const isPublicAdminPath = (pathname: string) =>
  pathname === "/admin/login" ||
  pathname === "/admin/logout";

const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

const isProtectedAdminPath = (pathname: string) => isAdminPath(pathname) && !isPublicAdminPath(pathname);

/**
 * The response for a gated admin path.
 *
 * Shaped by what asked for it so nothing leaks a hint either way: an API
 * client gets the same JSON body a genuinely missing route would produce, and
 * a browser gets a plain 404 page. No "admin", no "login", no header that
 * distinguishes "disabled here" from "never existed".
 */
const notFound = (pathname: string) => {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse("<!doctype html><title>404</title><h1>404</h1><p>This page could not be found.</p>", {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

export const middleware = async (request: NextRequest) => {
  const { pathname: rawPathname } = request.nextUrl;

  // Gate before the session is touched.
  //
  // 404, not a redirect: sending /admin to a login page advertises that an
  // admin panel exists and tells anyone probing exactly where to aim. A 404
  // says nothing is there, which is also the truth in a deployed build.
  //
  // This covers /api/admin/* as well as the pages. The pages are a shell; the
  // API routes are the ones holding the service-role client, so gating only
  // the pages would leave the actual privilege reachable.
  if (isAdminSurfacePath(rawPathname) && !isAdminEnabled()) {
    return notFound(rawPathname);
  }

  const { response, user } = await updateSupabaseSession(request);
  const { pathname, search } = request.nextUrl;

  if (isAdminPath(pathname)) {
    const isAuthenticated = user?.app_metadata?.role === "admin";

    if (isProtectedAdminPath(pathname) && !isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

  

  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
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
