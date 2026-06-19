import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/queries/profiles";
import {
  listAllGesturesAdmin,
  upsertGesture,
  deleteGesture,
  updateGestureStatus
} from "@/lib/supabase/queries/gestures";
import { listRepliesForGesture } from "@/lib/supabase/queries/gestures";
import type { Gesture } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async () => {
  try {
    await requireAdmin();
    const gestures = await listAllGesturesAdmin();
    const replyLists = await Promise.all(
      gestures.map((g) => listRepliesForGesture(g.id))
    );
    const replies = replyLists.flat();
    return NextResponse.json({ gestures, replies });
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
      label: string;
      description?: string;
      video_path?: string | null;
      thumbnail_path?: string | null;
      is_active?: boolean;
      display_order?: number;
    };
    if (!body.label) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const row = await upsertGesture({
      label: body.label,
      description: body.description,
      video_path: body.video_path,
      thumbnail_path: body.thumbnail_path,
      is_active: body.is_active,
      display_order: body.display_order
    });
    return NextResponse.json({ gesture: row }, { status: 201 });
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
      label?: string;
      description?: string;
      video_path?: string | null;
      thumbnail_path?: string | null;
      is_active?: boolean;
      status?: Gesture["status"];
      display_order?: number;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    // Status-only PATCH: keep the existing label and other fields.
    if (body.status && Object.keys(body).length === 2) {
      const row = await updateGestureStatus(body.id, body.status);
      return NextResponse.json({ gesture: row });
    }
    const row = await upsertGesture({
      id: body.id,
      label: body.label ?? "",
      description: body.description,
      video_path: body.video_path,
      thumbnail_path: body.thumbnail_path,
      is_active: body.is_active,
      status: body.status,
      display_order: body.display_order
    });
    return NextResponse.json({ gesture: row });
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
    await deleteGesture(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "forbidden" },
      { status: 403 }
    );
  }
};
