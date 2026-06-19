import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import {
  listRepliesForGesture,
  upsertReply,
  deleteReply
} from "@/lib/supabase/queries/gestures";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (req: NextRequest) => {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const gestureId = url.searchParams.get("gestureId");
    if (!gestureId) {
      return NextResponse.json({ error: "gestureId required" }, { status: 400 });
    }
    const replies = await listRepliesForGesture(gestureId);
    return NextResponse.json({ replies });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      gesture_id: string;
      reply_text: string;
      display_order?: number;
      is_active?: boolean;
    };
    if (!body.gesture_id || !body.reply_text) {
      return NextResponse.json(
        { error: "gesture_id and reply_text are required" },
        { status: 400 }
      );
    }
    const row = await upsertReply({
      gesture_id: body.gesture_id,
      reply_text: body.reply_text,
      display_order: body.display_order,
      is_active: body.is_active
    });
    return NextResponse.json({ reply: row }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};

export const PATCH = async (req: NextRequest) => {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      id: string;
      reply_text?: string;
      display_order?: number;
      is_active?: boolean;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const row = await upsertReply({
      id: body.id,
      gesture_id: "",
      reply_text: body.reply_text ?? "",
      display_order: body.display_order,
      is_active: body.is_active
    });
    return NextResponse.json({ reply: row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};

export const DELETE = async (req: NextRequest) => {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await deleteReply(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};
