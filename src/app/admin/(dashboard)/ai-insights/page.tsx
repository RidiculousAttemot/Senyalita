import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { AiInsightsView } from "@/components/admin/ActiveLearning/AiInsightsView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AiInsightsPage() {
  await requireAdmin();
  return <AiInsightsView />;
}
