import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { ModelComparisonView } from "@/components/admin/ActiveLearning/ModelComparisonView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ModelComparisonPage() {
  await requireAdmin();
  return <ModelComparisonView />;
}
