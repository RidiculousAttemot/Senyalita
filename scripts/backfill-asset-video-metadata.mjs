#!/usr/bin/env node
/**
 * Adds `video`, `imageWidth` and `imageHeight` to already-extracted holistic
 * assets so playback can replay landmarks in the source video's pixel space
 * and offer the original recording side by side.
 *
 * Re-running extract-holistic-videos.mjs would recompute every landmark
 * (hours of MediaPipe work) to add three fields that are readable straight
 * from the source file, so this patches in place instead.
 *
 * Usage: node scripts/backfill-asset-video-metadata.mjs [--dry]
 */
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const FFMPEG = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const ASSET_ROOT = path.join(ROOT, "datasets", "processed", "user_holistic_assets");
const VIDEO_ROOT = path.join(ROOT, "datasets", "raw", "user_videos");
const DRY = process.argv.includes("--dry");

async function probeDimensions(videoPath) {
  // ffmpeg reports stream info on stderr and exits non-zero without an
  // output target, so read the rejection rather than treating it as failure.
  let output = "";
  try {
    const { stderr } = await execFileAsync(FFMPEG, ["-i", videoPath], { timeout: 30000 });
    output = stderr;
  } catch (err) {
    output = err.stderr ?? "";
  }
  const match = output.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})/);
  if (!match) return null;
  let width = Number(match[1]);
  let height = Number(match[2]);

  // Phone recordings carry a display matrix. ffmpeg auto-rotates when it
  // decodes frames, so the landmarks were normalised against the *rotated*
  // frame — the raw stream dimensions would be transposed for a quarter turn.
  const rotation = output.match(/displaymatrix:\s*rotation of\s*(-?[\d.]+)\s*degrees/i);
  if (rotation) {
    const deg = Math.abs(Math.round(Number(rotation[1]))) % 180;
    if (deg === 90) [width, height] = [height, width];
  }
  return { width, height, rotated: Boolean(rotation) };
}

async function main() {
  if (!fs.existsSync(FFMPEG)) {
    console.error(`ffmpeg not found at ${FFMPEG}`);
    process.exit(1);
  }

  const labels = fs.readdirSync(ASSET_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const dimensionCounts = new Map();
  let patched = 0;
  let skipped = 0;
  let missingVideo = 0;

  for (const label of labels) {
    const labelDir = path.join(ASSET_ROOT, label);
    const assetFiles = fs.readdirSync(labelDir).filter((f) => f.endsWith("_asset.json"));

    for (const assetFile of assetFiles) {
      const assetPath = path.join(labelDir, assetFile);
      let asset;
      try {
        asset = JSON.parse(fs.readFileSync(assetPath, "utf-8"));
      } catch (e) {
        console.log(`  SKIP unreadable ${label}/${assetFile}: ${e.message}`);
        skipped++;
        continue;
      }

      const sourceFile = asset.metadata?.sourceFile;
      if (!sourceFile) {
        console.log(`  SKIP no sourceFile: ${label}/${assetFile}`);
        skipped++;
        continue;
      }

      const videoPath = path.join(VIDEO_ROOT, label, sourceFile);
      if (!fs.existsSync(videoPath)) {
        console.log(`  MISSING video: ${label}/${sourceFile}`);
        missingVideo++;
        continue;
      }

      const dims = await probeDimensions(videoPath);
      if (!dims) {
        console.log(`  SKIP unprobeable: ${label}/${sourceFile}`);
        skipped++;
        continue;
      }

      const key = `${dims.width}x${dims.height}`;
      dimensionCounts.set(key, (dimensionCounts.get(key) ?? 0) + 1);

      asset.imageWidth = dims.width;
      asset.imageHeight = dims.height;
      asset.video = `/api/videos/${encodeURIComponent(label)}/${encodeURIComponent(sourceFile)}`;

      // Compact: these files run to tens of MB and are machine-read only.
      if (!DRY) fs.writeFileSync(assetPath, JSON.stringify(asset));
      patched++;
    }
  }

  console.log(`\n${DRY ? "[dry run] would patch" : "patched"}: ${patched}`);
  console.log(`skipped: ${skipped}, missing video: ${missingVideo}`);
  console.log("source dimensions:");
  for (const [dim, count] of [...dimensionCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${dim}: ${count}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
