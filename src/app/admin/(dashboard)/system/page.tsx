import { SystemHealthOverviewView } from "@/components/admin/SystemHealthOverviewView";
import { DEPLOYED_MODEL } from "@/lib/admin/deployedModel";
import { getDashboardSystemHealth } from "@/lib/admin/cachedDashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminSystemHealthPage() {
  const health = await getDashboardSystemHealth();

  return <SystemHealthOverviewView health={{
    aiAcceptanceRate: health.aiAcceptanceRate,
    aiRepliesSent: health.aiRepliesSent,
    averageLatencyMs: health.averageLatencyMs,
    captureCount: health.captureCount,
    databaseAvailable: health.databaseAvailable,
    model: {
      status: "ready",
      modelType: DEPLOYED_MODEL.architecture,
      classes: DEPLOYED_MODEL.classes,
    },
    pendingReviewCount: health.pendingReviewCount,
    recentPredictions: health.recentPredictions,
    sourceBreakdown: health.sourceBreakdown,
    storageAvailable: health.storageAvailable,
    storageFileCount: health.storageFileCount,
    telemetryAvailable: health.telemetryAvailable,
    totalPredictions: health.totalPredictions,
  }} />;
}