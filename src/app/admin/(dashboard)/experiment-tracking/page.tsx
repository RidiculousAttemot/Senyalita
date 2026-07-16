import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { ExperimentTrackingView } from "@/components/admin/ActiveLearning/ExperimentTrackingView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ExperimentTrackingPage() {
  await requireAdmin();
  return <ExperimentTrackingView />;
}
