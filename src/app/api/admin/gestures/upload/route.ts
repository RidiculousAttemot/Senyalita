import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { updateGestureVideoPath } from "@/lib/supabase/queries/gestures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "gesture-videos";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const POST = async (req: NextRequest) => {
  try {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    const gestureId = form.get("gestureId");
    if (!(file instanceof Blob) || typeof gestureId !== "string") {
      return NextResponse.json(
        { error: "file and gestureId are required" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 400 }
      );
    }
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported MIME type: ${file.type}` },
        { status: 400 }
      );
    }

    const ext = file.type === "video/mp4"
      ? "mp4"
      : file.type === "video/webm"
        ? "webm"
        : file.type === "video/quicktime"
          ? "mov"
          : "bin";
    const path = `gestures/${gestureId}/reference.${ext}`;

    const supabase = createSupabaseServiceClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "video/mp4",
        upsert: true
      });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }
    await updateGestureVideoPath(gestureId, path);
    return NextResponse.json({ ok: true, path });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};
