import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { updateReplyVideoPath } from "@/lib/supabase/queries/gestures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "gesture-videos";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const extFor = (mime: string): string => {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return "bin";
};

export const POST = async (req: NextRequest) => {
  try {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    const replyId = form.get("replyId");
    const gestureId = form.get("gestureId");
    if (
      !(file instanceof Blob) ||
      typeof replyId !== "string" ||
      typeof gestureId !== "string"
    ) {
      return NextResponse.json(
        { error: "file, replyId and gestureId are required" },
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

    const path = `gestures/${gestureId}/replies/${replyId}/response.${extFor(file.type)}`;

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
    const updated = await updateReplyVideoPath(replyId, path);
    return NextResponse.json({ ok: true, path, reply: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};
