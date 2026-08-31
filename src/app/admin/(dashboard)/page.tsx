import { Suspense } from 'react';
import AdminDashboardOverview from '@/components/admin/AdminDashboardOverview';
import { AdminDashboardSkeleton } from '@/components/admin/AdminDashboardSkeleton';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';
import { requireAdmin } from '@/lib/supabase/queries/profiles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminDashboardPage() {
  await requireAdmin();
  return (
    <AdminErrorBoundary>
      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboardOverview />
      </Suspense>
    </AdminErrorBoundary>
  );
}