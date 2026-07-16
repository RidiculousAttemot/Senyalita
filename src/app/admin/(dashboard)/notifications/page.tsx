import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { NotificationCenterView } from "@/components/admin/ActiveLearning/NotificationCenterView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NotificationsPage() {
  await requireAdmin();
  return <NotificationCenterView />;
}
