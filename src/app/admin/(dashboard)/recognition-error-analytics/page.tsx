import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { ErrorAnalyticsView } from "@/components/admin/ActiveLearning/ErrorAnalyticsView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ErrorAnalyticsPage() {
  await requireAdmin();
  return <ErrorAnalyticsView />;
}
