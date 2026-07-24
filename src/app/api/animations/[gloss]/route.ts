import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPublishedAnimationAsset } from "@/lib/supabase/queries/animationAssets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATASET_DIR = path.join(process.cwd(), "datasets", "processed", "user_holistic_assets");

async function findLocalAsset(gloss: string) {
  const normalized = gloss.toLowerCase();
  const exactDir = path.join(DATASET_DIR, normalized);
  if (fs.existsSync(exactDir)) {
    const files = fs.readdirSync(exactDir).filter(f => f.endsWith("_asset.json"));
    if (files.length > 0) {
      try {
        const content = fs.readFileSync(path.join(exactDir, files[0]), "utf-8");
        return JSON.parse(content);
      } catch { /* ignore */ }
    }
  }
  const entries = fs.readdirSync(DATASET_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.toLowerCase() === normalized) {
      const labelDir = path.join(DATASET_DIR, entry.name);
      const files = fs.readdirSync(labelDir).filter(f => f.endsWith("_asset.json"));
      if (files.length > 0) {
        try {
          const content = fs.readFileSync(path.join(labelDir, files[0]), "utf-8");
          return JSON.parse(content);
        } catch { /* ignore */ }
      }
    }
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: { gloss: string } }) {
  try {
    const key = decodeURIComponent(params.gloss);

    const published = await getPublishedAnimationAsset(key);
    if (published) {
      return NextResponse.json(published, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    }

    const local = await findLocalAsset(key);
    if (local) {
      return NextResponse.json(local, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    }

    return NextResponse.json({ error: "Animation unavailable." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Animation unavailable." }, { status: 404 });
  }
}