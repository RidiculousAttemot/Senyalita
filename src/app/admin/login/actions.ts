"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginWithPassword(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const password = formData.get("password") as string;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    return { error: "ADMIN_PASSWORD is not set in .env.local" };
  }

  if (password !== expectedPassword) {
    return { error: "Wrong password" };
  }

  const cookieStore = await cookies();
  const token = hashToken(expectedPassword);
  cookieStore.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  redirect("/admin");
}

function hashToken(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "admin_" + Math.abs(hash).toString(36);
}
