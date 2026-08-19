// Seed the animation asset pipeline from already-extracted local landmarks.
//
// The admin Animation Studio (upload -> extract -> preview -> publish) writes
// into public.animation_assets / animation_asset_versions and the
// `animation-landmarks` / `animation-source-videos` storage buckets. This
// script performs the same steps in bulk for the glosses that were already
// extracted locally into datasets/processed/user_holistic_assets, so the 37
// existing signs do not have to be re-uploaded one at a time through the UI.
//
// Two transformations are applied on the way up:
//
//   1. One take per gloss. Each gloss has ~5 recorded takes on disk, but the
//      read path only ever serves one, so only the first is uploaded.
//   2. Coordinates are quantised to 4 decimal places. Landmarks are normalised
//      to 0..1, so 4dp is well under one pixel at any realistic canvas size,
//      while roughly halving the payload (6.0 MB -> 2.9 MB per gloss).
//
// Usage:
//   node scripts/seed-animation-assets.mjs            # dry run, writes nothing
//   node scripts/seed-animation-assets.mjs --apply    # perform the upload
//   node scripts/seed-animation-assets.mjs --apply --only a,b,5
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local if not already in the environment). Idempotent: a gloss that
// already has a published version is skipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { validateAnimationAsset } from "../src/lib/animationValidationRules.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = path.join(ROOT, "datasets", "processed", "user_holistic_assets");
const VIDEO_DIR = path.join(ROOT, "datasets", "raw", "user_videos");
const LANDMARK_BUCKET = "animation-landmarks";
const VIDEO_BUCKET = "animation-source-videos";
const PRECISION = 4;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim().toLowerCase()) : null;

// Landmark JSON only. Playback needs nothing else -- source video feeds
// Human/Split/Overlay, and those modes are the still-open blank-pane bug.
//
// Not cosmetic: animation-source-videos already holds 490 MB of the 612 MB in
// use against a 1 GB cap, and this batch carries 1.07 GB of video. Uploading it
// would fail around sign 35 of 91 and leave the library half-populated. The
// local copies under datasets/raw/user_videos are the archive.
const SKIP_VIDEO = args.includes("--skip-video");

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      if (!process.env[key]) process.env[key] = line.slice(i + 1).trim();
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  return { url, key };
}

const q = (n) => Math.round(n * 10 ** PRECISION) / 10 ** PRECISION;
const roundPoint = (p) => ({ x: q(p.x), y: q(p.y), z: q(p.z) });

/** Quantises every coordinate; structure and frame count are untouched. */
function optimiseAsset(asset) {
  return {
    ...asset,
    frames: asset.frames.map((frame) => ({
      timestamp: Math.round(frame.timestamp * 100) / 100,
      landmarks: frame.landmarks.map((hand) => ({
        ...hand,
        landmarks: hand.landmarks.map(roundPoint),
      })),
      ...(frame.poseLandmarks ? { poseLandmarks: frame.poseLandmarks.map(roundPoint) } : {}),
      ...(frame.faceLandmarks ? { faceLandmarks: frame.faceLandmarks.map(roundPoint) } : {}),
    })),
  };
}

function findSourceVideo(gloss, sourceFile) {
  if (!sourceFile) return null;
  const direct = path.join(VIDEO_DIR, gloss, sourceFile);
  return fs.existsSync(direct) ? direct : null;
}

function collectGlosses() {
  return fs
    .readdirSync(ASSET_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => (ONLY ? ONLY.includes(name.toLowerCase()) : true))
    .sort();
}

async function main() {
  const { url, key } = loadEnv();
  const sb = createClient(url, key);

  const glosses = collectGlosses();
  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${glosses.length} gloss(es) from ${path.relative(ROOT, ASSET_DIR)}\n`);

  let originalBytes = 0;
  let optimisedBytes = 0;
  let uploaded = 0;
  let skipped = 0;
  const failures = [];

  for (const dir of glosses) {
    const gloss = dir.toUpperCase(); // read path queries with gloss.toUpperCase()
    const files = fs.readdirSync(path.join(ASSET_DIR, dir)).filter((f) => f.endsWith("_asset.json"));
    if (files.length === 0) { console.log(`  ${gloss.padEnd(4)} no asset file, skipped`); skipped++; continue; }

    const assetPath = path.join(ASSET_DIR, dir, files[0]);
    const raw = fs.readFileSync(assetPath, "utf8");
    const parsed = JSON.parse(raw);
    const optimised = optimiseAsset(parsed);
    const payload = JSON.stringify(optimised);

    originalBytes += raw.length;
    optimisedBytes += payload.length;

    const video = SKIP_VIDEO ? null : findSourceVideo(dir, parsed.metadata?.sourceFile);
    const summary =
      `${gloss.padEnd(4)} ${(raw.length / 1048576).toFixed(1)}MB -> ${(payload.length / 1048576).toFixed(1)}MB` +
      `  frames=${parsed.totalFrames}  takes=${files.length}` +
      `  video=${video ? path.basename(video) : "NOT FOUND"}`;

    /**
     * Validate BEFORE uploading, and in the dry run too.
     *
     * The seeder had no validation at all: an asset with no frames, no fps and
     * no duration published cleanly to production and rendered nothing, while
     * the run reported "published: 1, failed: 0". The studio path had been
     * validating all along -- this is the same rule set, imported rather than
     * copied.
     *
     * Running it in the dry run is what makes the whole gate provable without
     * touching the shared production database: a malformed fixture reaches the
     * rejection and the halt with nothing written anywhere.
     */
    const signStart = Date.now();
    const verdict = validateAnimationAsset(optimised, { gloss });
    if (!verdict.valid) {
      console.error(`
  REJECTED ${gloss} — ${verdict.errors.map((e) => e.code).join(", ")}
${verdict.errors.map((e) => "    " + e.message).join(String.fromCharCode(10))}

  ${uploaded} sign(s) published before this, ${skipped} skipped.
  Nothing further was attempted. Already-published glosses are skipped on
  re-run, so fix the asset above and resume with:

    node scripts/seed-animation-assets.mjs --apply${SKIP_VIDEO ? " --skip-video" : ""}
`);
      failures.push({ gloss, error: verdict.errors.map((e) => e.code).join(",") });
      process.exitCode = 1;
      break;
    }
    for (const w of verdict.warnings) console.log(`  ${gloss.padEnd(4)} warning: ${w.code}`);

    if (!APPLY) { console.log(`  ${summary}`); continue; }

    try {
      // Reuse an existing asset row; create it if this gloss is new.
      const { data: asset, error: assetErr } = await sb
        .from("animation_assets")
        .upsert({ gloss }, { onConflict: "gloss" })
        .select("id, published_version_id")
        .single();
      if (assetErr) throw new Error(`animation_assets: ${assetErr.message}`);

      if (asset.published_version_id) {
        console.log(`  ${gloss.padEnd(4)} already published, skipped`);
        skipped++;
        continue;
      }

      const { data: prev } = await sb
        .from("animation_asset_versions")
        .select("version")
        .eq("asset_id", asset.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: version, error: versionErr } = await sb
        .from("animation_asset_versions")
        .insert({
          asset_id: asset.id,
          version: (prev?.version ?? 0) + 1,
          status: "processing",
          fps: parsed.fps,
          total_frames: parsed.totalFrames,
          duration_ms: Math.round(parsed.duration),
          extraction_metadata: { ...parsed.metadata, seededBy: "scripts/seed-animation-assets.mjs", precision: PRECISION },
        })
        .select("id")
        .single();
      if (versionErr) throw new Error(`animation_asset_versions: ${versionErr.message}`);

      const landmarkPath = `${asset.id}/${version.id}/landmarks.json`;
      const { error: upErr } = await sb.storage
        .from(LANDMARK_BUCKET)
        .upload(landmarkPath, Buffer.from(payload), { contentType: "application/json", upsert: true });
      if (upErr) throw new Error(`${LANDMARK_BUCKET}: ${upErr.message}`);

      let sourceVideoPath = null;
      if (video) {
        sourceVideoPath = `${asset.id}/${version.id}/source${path.extname(video)}`;
        const { error: vidErr } = await sb.storage
          .from(VIDEO_BUCKET)
          .upload(sourceVideoPath, fs.readFileSync(video), { contentType: "video/mp4", upsert: true });
        if (vidErr) throw new Error(`${VIDEO_BUCKET}: ${vidErr.message}`);
      }

      const { error: readyErr } = await sb
        .from("animation_asset_versions")
        .update({ status: "published", landmark_json_path: landmarkPath, source_video_path: sourceVideoPath })
        .eq("id", version.id);
      if (readyErr) throw new Error(`publish version: ${readyErr.message}`);

      const { error: pubErr } = await sb
        .from("animation_assets")
        .update({ published_version_id: version.id })
        .eq("id", asset.id);
      if (pubErr) throw new Error(`publish asset: ${pubErr.message}`);

      // Timestamped: a dead run and a slow one are indistinguishable in a log
      // that only prints on completion.
      console.log(`  ${new Date().toISOString().slice(11, 19)} ${summary}  PUBLISHED (${((Date.now() - signStart) / 1000).toFixed(0)}s)`);
      uploaded++;
    } catch (err) {
      /**
       * Halt, do not continue.
       *
       * Extraction continues past failures because one bad video should not cost
       * 91 good extractions, and nothing is published by it. Seeding is the
       * opposite: it writes to the shared production database, so continuing past
       * a failure produces exactly the half-populated library the storage
       * preflight exists to prevent -- and a half-populated library is
       * indistinguishable from a finished one.
       *
       * Cheap to recover from now that the run is resumable: already-published
       * glosses are skipped, so the resume command below picks up where this
       * stopped without redoing anything.
       */
      console.error(`
  FAILED on ${gloss} — ${err.message}

  ${uploaded} sign(s) published before this, ${skipped} skipped.
  Nothing further was attempted. Already-published glosses are skipped on
  re-run, so fix the cause above and resume with:

    node scripts/seed-animation-assets.mjs --apply${SKIP_VIDEO ? " --skip-video" : ""}
`);
      failures.push({ gloss, error: err.message });
      process.exitCode = 1;
      break;
    }
  }

  console.log("");
  console.log(`  total: ${(originalBytes / 1048576).toFixed(0)}MB -> ${(optimisedBytes / 1048576).toFixed(0)}MB` +
    ` (${(100 - (optimisedBytes / originalBytes) * 100).toFixed(0)}% smaller)`);
  if (APPLY) {
    console.log(`  published: ${uploaded}   skipped: ${skipped}   failed: ${failures.length}`);
    if (failures.length) process.exitCode = 1;
  } else {
    console.log("  dry run — nothing written. Re-run with --apply to upload.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
