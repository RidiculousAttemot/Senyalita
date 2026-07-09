const fs = require('fs');
const content = \import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AdminLoginForm from './AdminLoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { setup?: string; denied?: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.app_metadata?.role === 'admin') {
    redirect('/admin');
  }

  return (
    <div className='auth-shell'>
      <header className='auth-header'>
        <a href='/' className='auth-brand' aria-label='Senyalita Home'>
          Senyalita
        </a>
      </header>
      <main className='auth-content'>
        <section className='auth-card auth-card-hero'>
          <div className='auth-icon' aria-hidden='true'>
            <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
              <path d='M9 12l2 2 4-4' />
            </svg>
          </div>
          <p className='admin-kicker'>Senyalita Admin</p>
          <h1>Sign in to Admin</h1>
          <p className='panel-note auth-desc'>
            Sign in with your Supabase admin account. The user must have
            <code> app_metadata.role = 'admin' </code> assigned.
          </p>
          {searchParams?.setup ? (
            <p className='auth-banner auth-banner-info'>
              Check your Supabase auth and role configuration, then try again.
            </p>
          ) : null}
          {searchParams?.denied ? (
            <p className='auth-banner auth-banner-warn'>
              Access denied. This account does not have admin privileges.
            </p>
          ) : null}
          <AdminLoginForm />
          <p className='auth-foot'>
            <span className='auth-foot-note'>Local development only.</span>
            Admin access is not linked from the public site.
          </p>
        </section>
      </main>
      <footer className='auth-footer'>
        <p>Senyalita &mdash; Sign Language Visualization</p>
      </footer>
    </div>
  );
}
\;
fs.writeFileSync('C:/Arwin/Thesis/SignLangVisual/src/app/admin/(auth)/login/page.tsx', content, 'utf8');
console.log('Written');