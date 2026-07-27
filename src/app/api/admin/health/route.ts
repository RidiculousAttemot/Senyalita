import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { toErrorResponse } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin-only backend diagnostics.
 *
 * Reports connectivity and pipeline state without exposing credentials or
 * internal driver messages: every probe is reduced to ok/degraded plus a
 * short, non-identifying reason.
 */

type ProbeState = "ok" | "degraded" | "down";

interface Probe {
  state: ProbeState;
  detail?: string;
  ms?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - started };
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceClient();

    // --- database -----------------------------------------------------------
    let database: Probe;
    let assetCounts = { total: 0, published: 0, draft: 0, failed: 0 };
    try {
      const { value, ms } = await timed(async () =>
        supabase.from("animation_asset_versions").select("status", { count: "exact" }),
      );
      if (value.error) throw new Error(value.error.message);
      const rows = value.data ?? [];
      assetCounts = {
        total: rows.length,
        published: rows.filter((r) => r.status === "published").length,
        draft: rows.filter((r) => ["pending", "processing", "ready", "approved"].includes(r.status)).length,
        failed: rows.filter((r) => r.status === "failed").length,
      };
      database = { state: "ok", ms };
    } catch {
      database = { state: "down", detail: "animation tables unreachable" };
    }

    // --- storage ------------------------------------------------------------
    let storage: Probe;
    const buckets: Array<{ name: string; public: boolean; objects: number | null }> = [];
    try {
      const { value, ms } = await timed(async () => supabase.storage.listBuckets());
      if (value.error) throw new Error(value.error.message);
      for (const b of value.data ?? []) {
        const listed = await supabase.storage.from(b.name).list("", { limit: 1000 });
        buckets.push({ name: b.name, public: b.public, objects: listed.error ? null : listed.data.length });
      }
      storage = { state: "ok", ms };
    } catch {
      storage = { state: "down", detail: "bucket listing failed" };
    }

    // --- processing jobs ----------------------------------------------------
    let jobs = { queued: 0, processing: 0, completed: 0, failed: 0 };
    try {
      const { data } = await supabase.from("animation_processing_jobs").select("status");
      for (const j of data ?? []) {
        if (j.status in jobs) jobs[j.status as keyof typeof jobs]++;
      }
    } catch { /* table absent — reported via database probe */ }

    // --- schema drift -------------------------------------------------------
    // There is no migration ledger in this project, so "migration version" is
    // inferred from which expected tables actually resolve.
    // Probed over PostgREST rather than the typed client: this asks whether a
    // relation resolves at all, and several live tables (e.g. profiles) are
    // absent from the generated types, so the typed client cannot name them.
    const expected = [
      "animation_assets", "animation_asset_versions", "animation_asset_reviews",
      "animation_processing_jobs", "telemetry_events", "profiles", "gestures",
    ];
    const present: string[] = [];
    const missing: string[] = [];
    const restUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (restUrl && serviceKey) {
      for (const t of expected) {
        try {
          const res = await fetch(`${restUrl}/rest/v1/${t}?select=*&limit=1`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
            cache: "no-store",
          });
          (res.ok ? present : missing).push(t);
        } catch {
          missing.push(t);
        }
      }
    }

    // --- RLS spot-check -----------------------------------------------------
    // Confirms anonymous callers cannot read admin-gated animation rows.
    let rls: Probe = { state: "degraded", detail: "not evaluated" };
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonUrl && anonKey) {
      try {
        const res = await fetch(`${anonUrl}/rest/v1/animation_assets?select=id&limit=1`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          cache: "no-store",
        });
        const body = (await res.json()) as unknown;
        const leaked = Array.isArray(body) && body.length > 0;
        rls = leaked
          ? { state: "down", detail: "anonymous callers can read animation_assets" }
          : { state: "ok" };
      } catch {
        rls = { state: "degraded", detail: "probe failed" };
      }
    }

    const overall: ProbeState =
      database.state === "down" || storage.state === "down" || rls.state === "down"
        ? "down"
        : missing.length > 0 || rls.state === "degraded"
          ? "degraded"
          : "ok";

    return NextResponse.json(
      {
        success: true,
        status: overall,
        checkedAt: new Date().toISOString(),
        checks: { database, storage, rls },
        animations: assetCounts,
        jobs,
        buckets,
        schema: { present: present.length, missing },
        fallback: {
          localAnimationFallback: process.env.ANIMATION_LOCAL_FALLBACK ?? "(default: on outside production)",
          nodeEnv: process.env.NODE_ENV,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/admin/health");
  }
}
