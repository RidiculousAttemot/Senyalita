import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATASET_DIR = path.join(process.cwd(), "datasets", "processed", "user_holistic_assets");

interface AssetSummary {
  label: string;
  file: string;
  filePath: string;
  frameCount: number;
  duration: number;
}

export async function GET(req: NextRequest) {
  try {
    const label = req.nextUrl.searchParams.get("label");
    const file = req.nextUrl.searchParams.get("file");

    if (label && file) {
      const safeLabel = path.basename(label);
      const safeFile = path.basename(file);
      const filePath = path.join(DATASET_DIR, safeLabel, safeFile);

      if (!filePath.startsWith(DATASET_DIR) || !fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return NextResponse.json(content, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    if (!fs.existsSync(DATASET_DIR)) {
      return NextResponse.json({ assets: [], labels: [] });
    }

    const labels: string[] = [];
    const assets: AssetSummary[] = [];
    const entries = fs.readdirSync(DATASET_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const lbl = entry.name;
      labels.push(lbl);
      const labelDir = path.join(DATASET_DIR, lbl);
      const files = fs.readdirSync(labelDir).filter(f => f.endsWith("_asset.json"));

      for (const fl of files) {
        const fp = path.join(labelDir, fl);
        try {
          const content = JSON.parse(fs.readFileSync(fp, "utf-8"));
          assets.push({
            label: lbl,
            file: fl,
            filePath: path.relative(DATASET_DIR, fp),
            frameCount: content.totalFrames ?? content.frames?.length ?? 0,
            duration: content.duration ?? 0,
          });
        } catch {
          assets.push({ label: lbl, file: fl, filePath: path.relative(DATASET_DIR, fp), frameCount: 0, duration: 0 });
        }
      }
    }

    return NextResponse.json({ labels: labels.sort(), assets });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list assets" }, { status: 500 });
  }
}
