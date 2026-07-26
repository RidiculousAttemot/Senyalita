import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_ROOT = path.join(process.cwd(), "datasets", "raw", "user_videos");

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/** Resolves inside VIDEO_ROOT or returns null, so a crafted label/file cannot escape the dataset. */
function safeResolve(label: string, file: string): string | null {
  const candidate = path.resolve(VIDEO_ROOT, label, file);
  const root = path.resolve(VIDEO_ROOT);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  if (!CONTENT_TYPES[path.extname(candidate).toLowerCase()]) return null;
  return candidate;
}

export async function GET(
  request: Request,
  { params }: { params: { label: string; file: string } },
) {
  const filePath = safeResolve(
    decodeURIComponent(params.label),
    decodeURIComponent(params.file),
  );
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Video unavailable." }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  const range = request.headers.get("range");

  // Range support is what lets the <video> element seek, which Split View
  // needs to hold the recording on the same timestamp as the landmark frame.
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : stat.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    const clampedEnd = Math.min(end, stat.size - 1);
    const stream = fs.createReadStream(filePath, { start, end: clampedEnd });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(clampedEnd - start + 1),
        "Content-Range": `bytes ${start}-${clampedEnd}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
