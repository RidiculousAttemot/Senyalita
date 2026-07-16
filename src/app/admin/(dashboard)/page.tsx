import AdminDashboardOverview from '@/components/admin/AdminDashboardOverview';
import { requireAdmin } from '@/lib/supabase/queries/profiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminDashboardPage() {
  await requireAdmin();
  return <AdminDashboardOverview />;
}