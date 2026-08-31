import { SystemHealthOverviewView } from "@/components/admin/SystemHealthOverviewView";
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
    model: { status: "ready", modelType: "BiLSTM", classes: 131 },
    pendingReviewCount: health.pendingReviewCount,
    recentPredictions: health.recentPredictions,
    sourceBreakdown: health.sourceBreakdown,
    storageAvailable: health.storageAvailable,
    storageFileCount: health.storageFileCount,
    telemetryAvailable: health.telemetryAvailable,
    totalPredictions: health.totalPredictions,
  }} />;
}