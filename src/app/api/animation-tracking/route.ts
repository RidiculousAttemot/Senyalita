import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { gestureLabel, eventType, duration, avatarStyle, playbackSpeed } = body;

    if (!gestureLabel || !eventType) {
      return NextResponse.json({ error: "Missing required fields: gestureLabel, eventType" }, { status: 400 });
    }

    const validTypes = ["play", "replay", "interrupt", "complete"];
    if (!validTypes.includes(eventType)) {
      return NextResponse.json({ error: `Invalid event type: ${eventType}` }, { status: 400 });
    }

    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "data", "animation-tracking");
    const filePath = path.join(dir, "events.jsonl");

    await fs.mkdir(dir, { recursive: true });

    const event = {
      gestureLabel,
      eventType,
      duration: duration ?? 0,
      avatarStyle: avatarStyle ?? "minimal",
      playbackSpeed: playbackSpeed ?? 1,
      timestamp: new Date().toISOString(),
    };

    await fs.appendFile(filePath, JSON.stringify(event) + "\n", "utf-8");

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
