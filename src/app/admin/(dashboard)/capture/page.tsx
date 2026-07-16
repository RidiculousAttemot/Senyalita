import { requireAdmin } from '@/lib/supabase/queries/profiles';
import { CaptureStudioView } from '@/components/admin/CaptureStudioView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CaptureStudioPage() {
  await requireAdmin();

  return <CaptureStudioView />;
}
