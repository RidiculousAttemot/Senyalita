import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCE_BUCKET = "animation-source-videos";
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const rawGloss = form.get("gloss");
    const gloss = typeof rawGloss === "string" ? rawGloss.trim().toUpperCase() : "";

    if (!(file instanceof Blob) || !gloss) {
      return NextResponse.json({ error: "A source video and canonical gloss are required." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Source videos must be 100 MB or smaller." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only MP4, WebM, and MOV source videos are supported." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: asset, error: assetError } = await supabase
      .from("animation_assets")
      .upsert({ gloss }, { onConflict: "gloss" })
      .select("id")
      .single();
    if (assetError || !asset) throw new Error(assetError?.message ?? "Unable to create animation asset.");

    const { data: previousVersion, error: versionLookupError } = await supabase
      .from("animation_asset_versions")
      .select("version")
      .eq("asset_id", asset.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionLookupError) throw new Error(versionLookupError.message);

    const { data: version, error: versionError } = await supabase
      .from("animation_asset_versions")
      .insert({
        asset_id: asset.id,
        version: (previousVersion?.version ?? 0) + 1,
        status: "pending",
        created_by: admin.id,
      })
      .select("id, version")
      .single();
    if (versionError || !version) throw new Error(versionError?.message ?? "Unable to create animation version.");

    const extension = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
    const sourcePath = `${asset.id}/${version.id}/source.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(SOURCE_BUCKET)
      .upload(sourcePath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("animation_asset_versions")
      .update({ source_video_path: sourcePath, status: "processing" })
      .eq("id", version.id);
    if (updateError) throw new Error(updateError.message);

    const { error: jobError } = await supabase
      .from("animation_processing_jobs")
      .insert({ version_id: version.id, status: "processing", progress: 0 });
    if (jobError) throw new Error(jobError.message);

    return NextResponse.json({ assetId: asset.id, versionId: version.id, version: version.version });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload the private source video." },
      { status: 403 },
    );
  }
}