import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, updateSupabaseSession } from "@/lib/supabase/middleware";

const isPublicAdminPath = (pathname: string) =>
  pathname === "/admin/login" ||
  pathname === "/admin/logout";

const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

const isProtectedAdminPath = (pathname: string) => isAdminPath(pathname) && !isPublicAdminPath(pathname);

export const middleware = async (request: NextRequest) => {
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
