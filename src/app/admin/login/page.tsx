import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/queries/profiles";
import AdminLoginForm from "./admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  try {
    const user = await getCurrentUser();
    if (user?.app_metadata?.role === "admin") {
      redirect("/admin");
    }
  } catch {
    // Not authenticated — show login form
  }

  return (
    <section className="auth-card">
      <AdminLoginForm />
    </section>
  );
}
