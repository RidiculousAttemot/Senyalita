import AdminLoginForm from "./AdminLoginForm";
import Link from "next/link";
import { SenyalitaMark } from "@/components/landing/SenyalitaMark";

export const dynamic = "force-dynamic";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { setup?: string; denied?: string };
}) {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href="/" className="auth-brand" aria-label="Senyalita Home">
          <SenyalitaMark className="auth-brand-icon" iconClassName="h-5 w-5" />
          <span>Senyalita</span>
        </Link>
      </header>
      <main className="auth-content">
        <section className="auth-card">
          <div className="auth-icon" aria-hidden="true">
            <SenyalitaMark className="h-7 w-7" iconClassName="h-7 w-7 stroke-[2.25]" />
          </div>
          <p className="admin-kicker">SENYALITA ADMIN</p>
          <h1>Sign in to Admin</h1>
          <p className="panel-note auth-desc">
            Use your authorized administrator account to manage Senyalita.
            Access is restricted to approved administrators.
          </p>
          {searchParams?.setup ? (
            <p className="auth-banner auth-banner-info">
              Check your Supabase auth and role configuration, then try again.
            </p>
          ) : null}
          {searchParams?.denied ? (
            <p className="auth-banner auth-banner-warn">
              Access denied. This account does not have admin privileges.
            </p>
          ) : null}
          <AdminLoginForm />
          <p className="auth-foot">
            <span className="auth-foot-note">Local development only.</span>
            This area is separate from the public site.
          </p>
        </section>
      </main>
      <footer className="auth-footer">
        <p>Senyalita &mdash; Sign Language Visualization</p>
      </footer>
    </div>
  );
}