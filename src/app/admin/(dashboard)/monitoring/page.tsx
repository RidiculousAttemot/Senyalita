import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { fetchModelMetricsDaily } from "@/lib/supabase/queries/analytics";
import { listAllFeedback } from "@/lib/supabase/queries/feedback";
import { MonitoringOverviewView } from "@/components/admin/MonitoringOverviewView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminMonitoringPage() {
  await requireAdmin();
  const [metrics, feedback] = await Promise.all([
    fetchModelMetricsDaily(30),
    listAllFeedback(50)
  ]);

  return <MonitoringOverviewView feedback={feedback} metrics={metrics} />;
}
