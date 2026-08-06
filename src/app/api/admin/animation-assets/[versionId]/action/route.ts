import { NextRequest, NextResponse } from "next/server";
import type { GestureAnimationAsset } from "@/features/sign-animation/types";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { BadRequestError, toErrorResponse } from "@/server/http/errors";
import { validateAnimationAsset } from "@/server/services/animationValidation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LANDMARK_BUCKET = "animation-landmarks";

function isGestureAnimationAsset(value: unknown): value is GestureAnimationAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<GestureAnimationAsset>;
  return typeof asset.label === "string" && Array.isArray(asset.frames) && typeof asset.fps === "number";
}

export async function POST(request: NextRequest, { params }: { params: { versionId: string } }) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as {
      action?: "complete-processing" | "approve" | "reject" | "publish" | "unpublish" | "archive";
      asset?: unknown;
      qualityScore?: number;
      notes?: string;
      language?: string;
    };
    if (!body.action) return NextResponse.json({ error: "An asset action is required." }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { data: version, error: versionError } = await supabase
      .from("animation_asset_versions")
      .select("id, asset_id, status")
      .eq("id", params.versionId)
      .maybeSingle();
    if (versionError || !version) return NextResponse.json({ error: "Animation version not found." }, { status: 404 });

    if (body.action === "complete-processing") {
      if (!isGestureAnimationAsset(body.asset)) {
        throw new BadRequestError("A valid generated landmark animation is required.");
      }

      // Structural validation before anything is written to storage: a bad
      // extraction should fail loudly here rather than publish a gloss that
      // renders as an empty canvas.
      const validation = validateAnimationAsset(body.asset, { gloss: body.asset.label });
      if (!validation.valid) {
        throw new BadRequestError(
          `This animation cannot be published: ${validation.errors.map((e) => e.message).join(" ")}`,
        );
      }
      const landmarkPath = `${version.asset_id}/${version.id}/landmarks.json`;
      const serialized = JSON.stringify(body.asset);
      const { error: uploadError } = await supabase.storage
        .from(LANDMARK_BUCKET)
        .upload(landmarkPath, serialized, { contentType: "application/json", upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from("animation_asset_versions")
        .update({
          status: "ready",
          landmark_json_path: landmarkPath,
          fps: body.asset.fps,
          total_frames: body.asset.totalFrames,
          duration_ms: Math.round(body.asset.duration),
          quality_score: typeof body.qualityScore === "number" ? body.qualityScore : null,
          extraction_metadata: body.asset.metadata,
          // Both columns already existed and neither was ever written. The
          // studio collected a language and dropped it on submit, and
          // storage_bytes was null on all 37 published versions -- which is
          // also the number that would have shown how close this payload sits
          // to the platform's 4.5 MB request limit.
          //
          // language is NOT NULL with a default, so an absent one is omitted
          // rather than written as null.
          ...(typeof body.language === "string" && body.language ? { language: body.language } : {}),
          storage_bytes: new TextEncoder().encode(serialized).length,
        })
        .eq("id", version.id);
      if (updateError) throw new Error(updateError.message);
      await supabase.from("animation_processing_jobs").update({ status: "completed", progress: 100 }).eq("version_id", version.id);
      return NextResponse.json({ ok: true, status: "ready" });
    }

    if (body.action === "approve" || body.action === "reject") {
      if (body.action === "approve" && version.status !== "ready") {
        return NextResponse.json({ error: "Only a ready animation can be approved." }, { status: 409 });
      }
      const nextStatus = body.action === "approve" ? "approved" : "failed";
      const { error: reviewError } = await supabase.from("animation_asset_reviews").insert({
        version_id: version.id,
        reviewer_id: admin.id,
        decision: body.action === "approve" ? "approved" : "rejected",
        notes: body.notes ?? null,
      });
      if (reviewError) throw new Error(reviewError.message);
      const { error: updateError } = await supabase
        .from("animation_asset_versions")
        .update({ status: nextStatus, approved_by: body.action === "approve" ? admin.id : null, approved_at: body.action === "approve" ? new Date().toISOString() : null })
        .eq("id", version.id);
      if (updateError) throw new Error(updateError.message);
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    if (body.action === "publish") {
      if (version.status !== "approved") {
        return NextResponse.json({ error: "Only an approved animation can be published." }, { status: 409 });
      }
      const { error: archiveError } = await supabase
        .from("animation_asset_versions")
        .update({ status: "archived" })
        .eq("asset_id", version.asset_id)
        .eq("status", "published");
      if (archiveError) throw new Error(archiveError.message);
      const { error: publishError } = await supabase
        .from("animation_asset_versions")
        .update({ status: "published" })
        .eq("id", version.id);
      if (publishError) throw new Error(publishError.message);
      const { error: assetError } = await supabase
        .from("animation_assets")
        .update({ published_version_id: version.id })
        .eq("id", version.asset_id);
      if (assetError) throw new Error(assetError.message);
      return NextResponse.json({ ok: true, status: "published" });
    }

    if (body.action === "unpublish") {
      // Clearing the pointer is the part that matters. Archiving a version
      // without it leaves animation_assets.published_version_id naming a row
      // that is no longer published: the resolver still rejects it on status,
      // so playback degrades correctly, but every listing that reads the
      // pointer reports the asset as published when it is not.
      const { error: clearError } = await supabase
        .from("animation_assets")
        .update({ published_version_id: null })
        .eq("id", version.asset_id)
        .eq("published_version_id", version.id);
      if (clearError) throw new Error(clearError.message);

      const { error: unpublishError } = await supabase
        .from("animation_asset_versions")
        .update({ status: "approved" })
        .eq("id", version.id);
      if (unpublishError) throw new Error(unpublishError.message);
      return NextResponse.json({ ok: true, status: "approved" });
    }

    if (body.action === "archive") {
      const { error: archiveError } = await supabase
        .from("animation_asset_versions")
        .update({ status: "archived" })
        .eq("id", version.id);
      if (archiveError) throw new Error(archiveError.message);
      return NextResponse.json({ ok: true, status: "archived" });
    }

    return NextResponse.json({ error: "Unsupported asset action." }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error, `POST /api/admin/animation-assets/${params.versionId}/action`);
  }
}