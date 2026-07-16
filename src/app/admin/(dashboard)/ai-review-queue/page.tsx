import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { AiReviewQueueView } from "@/components/admin/ActiveLearning/AiReviewQueueView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AiReviewQueuePage() {
  await requireAdmin();
  return <AiReviewQueueView />;
}
