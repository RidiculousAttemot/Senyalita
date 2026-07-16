import { requireAdmin } from '@/lib/supabase/queries/profiles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TrainingCenterView } from '@/components/admin/TrainingCenterView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function TrainingPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // Get dataset stats
  const { count: totalSamples } = await supabase
    .from('gesture_captures')
    .select('*', { count: 'exact', head: true });

  return <TrainingCenterView totalSamples={totalSamples ?? 0} />;
}
