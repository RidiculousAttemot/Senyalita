// DEAD CODE (mostly) — only referenced by logout cleanup and dead legacy components.
// Admin auth now uses Supabase Auth with app_metadata.role === "admin".
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "admin_session";

export function hashAdminToken(value: string): string {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return `admin_${Math.abs(hash).toString(36)}`;
}

export function getExpectedAdminToken(): string | null {
  return process.env.ADMIN_PASSWORD
    ? hashAdminToken(process.env.ADMIN_PASSWORD)
    : null;
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}