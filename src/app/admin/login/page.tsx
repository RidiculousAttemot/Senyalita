import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminPasswordForm from "./admin-password-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { setup?: string };
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  const expectedToken = process.env.ADMIN_PASSWORD
    ? hashToken(process.env.ADMIN_PASSWORD)
    : null;

  if (sessionToken && expectedToken && sessionToken === expectedToken) {
    redirect("/admin");
  }

  const adminPasswordSet = !!process.env.ADMIN_PASSWORD;

  if (!adminPasswordSet) {
    return (
      <section className="auth-card">
        <h1>Admin Setup Required</h1>
        <p>
          Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code>, then
          restart the dev server.
        </p>
        <pre
          style={{
            background: "#1e293b",
            color: "#a7f3d0",
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          ADMIN_PASSWORD=your-password
        </pre>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <AdminPasswordForm error={searchParams?.setup ? "Set ADMIN_PASSWORD in .env.local first" : undefined} />
    </section>
  );
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
