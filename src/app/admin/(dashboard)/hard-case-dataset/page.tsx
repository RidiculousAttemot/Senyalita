import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { HardCaseDatasetView } from "@/components/admin/ActiveLearning/HardCaseDatasetView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HardCaseDatasetPage() {
  await requireAdmin();
  return <HardCaseDatasetView />;
}
