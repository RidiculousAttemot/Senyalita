import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { toErrorResponse } from "@/server/http/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getReviewQueue(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("review_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return data ?? [];
}

async function getModelVersions(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("model_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return data ?? [];
}

async function getDeployments(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("deployment_history")
    .select("*, model_versions(*)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return data ?? [];
}

async function getRetrainingJobs(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("retraining_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

async function getTextToSignLogs(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("text_to_sign_logs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return data ?? [];
}

async function getTelemetryEvents(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return data ?? [];
}

async function getGestureConfusions(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("gesture_confusion_pairs")
    .select("*")
    .order("count", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

async function getTrainingSamples(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("training_samples")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return data ?? [];
}

async function getPredictionCorrections(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("prediction_corrections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return data ?? [];
}

async function getDailyMetrics(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase
    .from("model_metrics_daily")
    .select("*")
    .order("day", { ascending: false })
    .limit(90);
  if (error) return [];
  return data ?? [];
}

async function getNotifications(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("telemetry_events")
    .select("*")
    .in("event_type", [
      "low_confidence", "retraining_started", "retraining_completed",
      "translation_failed", "recognition_failure", "admin_login",
    ])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") ?? "overview";

    switch (section) {
      case "review-queue": {
        const items = await getReviewQueue(supabase);
        return NextResponse.json({ items });
      }
      case "models": {
        const models = await getModelVersions(supabase);
        return NextResponse.json({ models });
      }
      case "deployments": {
        const deployments = await getDeployments(supabase);
        return NextResponse.json({ deployments });
      }
      case "retraining": {
        const jobs = await getRetrainingJobs(supabase);
        const textToSignLogs = await getTextToSignLogs(supabase);
        const failedTranslations = textToSignLogs.filter((l) => !l.success);
        const missingGlosses = textToSignLogs.filter((l) => (l.unknown_token_count ?? 0) > 0);
        return NextResponse.json({ jobs, failedTranslations: failedTranslations.length, missingGlosses: missingGlosses.length });
      }
      case "error-analytics": {
        const confusions = await getGestureConfusions(supabase);
        const corrections = await getPredictionCorrections(supabase);
        const dailyMetrics = await getDailyMetrics(supabase);
        const telemetry = await getTelemetryEvents(supabase);
        const lowConfidence = telemetry.filter((e) => e.event_type === "low_confidence");
        const failures = telemetry.filter((e) => e.event_type === "recognition_failure" || e.event_type === "translation_failed");
        return NextResponse.json({ confusions, corrections, dailyMetrics, lowConfidenceCount: lowConfidence.length, failureCount: failures.length });
      }
      case "translation-feedback": {
        const logs = await getTextToSignLogs(supabase);
        return NextResponse.json({ logs });
      }
      case "notifications": {
        const events = await getNotifications(supabase);
        return NextResponse.json({ notifications: events });
      }
      case "samples": {
        const samples = await getTrainingSamples(supabase);
        return NextResponse.json({ samples });
      }
      default: {
        const [reviewQueue, models, deployments, jobs, textToSignLogs, telemetry, confusions, samples, corrections, dailyMetrics] = await Promise.all([
          getReviewQueue(supabase),
          getModelVersions(supabase),
          getDeployments(supabase),
          getRetrainingJobs(supabase),
          getTextToSignLogs(supabase),
          getTelemetryEvents(supabase),
          getGestureConfusions(supabase),
          getTrainingSamples(supabase),
          getPredictionCorrections(supabase),
          getDailyMetrics(supabase),
        ]);

        const activeModel = models.find((m) => m.is_active);
        const pendingReview = reviewQueue.filter((i) => i.status === "pending");
        const failedTranslations = textToSignLogs.filter((l) => !l.success);
        const lowConfidenceEvents = telemetry.filter((e) => e.event_type === "low_confidence");
        const unknownEvents = telemetry.filter((e) => e.event_type === "recognition_failure");

        return NextResponse.json({
          reviewQueue: { total: reviewQueue.length, pending: pendingReview.length },
          models: { total: models.length, active: activeModel ?? null },
          deployments: { total: deployments.length, active: deployments.filter((d) => d.status === "active").length },
          retraining: { total: jobs.length, recent: jobs.slice(0, 5) },
          translations: {
            total: textToSignLogs.length,
            failed: failedTranslations.length,
            avgConfidence: textToSignLogs.length > 0
              ? textToSignLogs.reduce((s, l) => s + (l.confidence_score ?? 0), 0) / textToSignLogs.length
              : 0,
          },
          telemetry: {
            lowConfidence: lowConfidenceEvents.length,
            unknown: unknownEvents.length,
            failureCount: failedTranslations.length + unknownEvents.length,
          },
          confusions: confusions.slice(0, 10),
          samples: { total: samples.length },
          corrections: { total: corrections.length },
          dailyMetrics: dailyMetrics.slice(0, 30),
        });
      }
    }
  } catch (err) {
    return toErrorResponse(err, "GET /api/admin/active-learning");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceClient();
    const body = await request.json();
    const { action } = body;

      if (action === "update-review-item") {
      const { id, status, correctedLabel, reviewNotes } = body;
      const { error } = await supabase
        .from("review_queue")
        .update({
          status: status ?? undefined,
          corrected_label: correctedLabel ?? undefined,
          review_notes: reviewNotes ?? undefined,
          reviewed_by: body.userId ?? "admin",
          reviewed_at: status ? new Date().toISOString() : undefined,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    if (action === "convert-to-sample") {
      const { reviewItemIds } = body;
      const { data: items } = await supabase
        .from("review_queue")
        .select("*")
        .in("id", reviewItemIds);
      if (!items) return NextResponse.json({ error: "No items found" }, { status: 404 });

      for (const item of items) {
        const label = item.corrected_label ?? item.gesture_label;
        await supabase.from("training_samples").insert({
          original_prediction: item.original_prediction,
          corrected_label: label,
          confidence: item.confidence,
          source: "review_approval",
          landmark_snapshot: item.landmarks_data,
          review_queue_id: item.id,
          approved_by: body.userId ?? "admin",
          approved_at: new Date().toISOString(),
        });
        await supabase.from("review_queue").update({ status: "approved" }).eq("id", item.id);
      }
      return NextResponse.json({ success: true, count: items.length });
    }

    if (action === "add-notification") {
      const { type, title, message, severity, link } = body;
      const { error } = await supabase.from("telemetry_events").insert({
        event_type: "low_confidence",
        event_data: { notificationType: type, title, message, severity, link },
        gesture_label: title ?? null,
        confidence: null,
        user_id: body.userId ?? null,
        session_id: null,
        session_token: null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err, "POST /api/admin/active-learning");
  }
}
