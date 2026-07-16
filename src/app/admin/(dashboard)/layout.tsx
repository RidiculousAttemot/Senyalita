import AdminShell from '@/components/admin/AdminShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AdminShell
      isAuthenticated={user?.app_metadata?.role === 'admin'}
      email={user?.email ?? null}
    >
      {children}
    </AdminShell>
  );
}