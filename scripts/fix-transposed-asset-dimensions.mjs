#!/usr/bin/env node
/**
 * Repairs the stored frame size on published landmark assets.
 *
 * The extractor read ffmpeg's *coded* resolution. A phone recording is stored
 * landscape with a 90-degree display matrix, and ffmpeg auto-rotates when it
 * decodes frames — so the landmarks were normalised against a rotated frame
 * while the recorded dimensions came from the raw one. Playback then multiplies
 * x by the wrong axis and stretches the signer sideways, which also inflates
 * the fitted box and leaves the stage mostly empty.
 *
 * DERIVED PER ASSET, NOT BLANKET-SWAPPED. Each asset is matched to its own
 * source video through metadata.sourceFile and probed with the rotation-aware
 * reader; only a genuine disagreement is rewritten. An asset that really is
 * landscape must survive this untouched.
 *
 * THE LANDMARKS ARE NOT REPARSED. The object is edited as text, replacing only
 * the two numbers, and the result is asserted byte-identical everywhere else.
 * Re-serialising a 3MB float array risks changing number formatting for data
 * that has nothing wrong with it.
 *
 * Reversible: the applied list is written to the report file, and re-running
 * --apply --only <gloss>… swaps those back.
 *
 * Usage:
 *   node scripts/fix-transposed-asset-dimensions.mjs --dry
 *   node scripts/fix-transposed-asset-dimensions.mjs --apply
 *   node scripts/fix-transposed-asset-dimensions.mjs --apply --only EGG --only APRIL
 */
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FFMPEG = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const VIDEO_ROOT = path.join(ROOT, "datasets", "raw", "user_videos");
const BUCKET = "animation-landmarks";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.reduce((acc, a, i) => (a === "--only" ? [...acc, process.argv[i + 1]] : acc), []);

const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const cfg = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim();
const URL_BASE = cfg("NEXT_PUBLIC_SUPABASE_URL");
const KEY = cfg("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** Coded size corrected by the display matrix, matching what ffmpeg decodes. */
async function probeDimensions(videoPath) {
  let out = "";
  try {
    const { stderr } = await execFileAsync(FFMPEG, ["-i", videoPath], { timeout: 30000 });
    out = stderr;
  } catch (err) {
    out = err.stderr ?? "";
  }
  const m = out.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})/);
  if (!m) return null;
  let width = Number(m[1]);
  let height = Number(m[2]);
  const rot = out.match(/displaymatrix:\s*rotation of\s*(-?[\d.]+)\s*degrees/i);
  if (rot) {
    const deg = Math.abs(Math.round(Number(rot[1]))) % 180;
    if (deg === 90) [width, height] = [height, width];
  }
  return { width, height, rotated: Boolean(rot) };
}

const DIMS = /"imageWidth":(\d+),"imageHeight":(\d+)/;

async function main() {
  const assets = await (await fetch(
    `${URL_BASE}/rest/v1/animation_assets?select=gloss,published_version_id&order=gloss`, { headers: H })).json();
  const versions = await (await fetch(
    `${URL_BASE}/rest/v1/animation_asset_versions?select=id,landmark_json_path,extraction_metadata&status=eq.published`, { headers: H })).json();
  const byId = new Map(versions.map((v) => [v.id, v]));

  const rows = [];
  for (const a of assets) {
    const v = byId.get(a.published_version_id);
    if (!v?.landmark_json_path) continue;
    if (ONLY.length && !ONLY.includes(a.gloss)) continue;

    // The dimensions and metadata sit at the end of the object, so the tail is
    // all the survey needs — 400 bytes rather than three megabytes.
    const tail = await (await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${v.landmark_json_path}`,
      { headers: { ...H, Range: "bytes=-400" } })).text();
    const d = DIMS.exec(tail);
    const stored = d ? { width: Number(d[1]), height: Number(d[2]) } : null;

    const sourceFile = v.extraction_metadata?.sourceFile ?? null;
    const videoPath = sourceFile ? path.join(VIDEO_ROOT, a.gloss, sourceFile) : null;
    const hasVideo = videoPath && fs.existsSync(videoPath);
    const probed = hasVideo ? await probeDimensions(videoPath) : null;

    let action = "skip: no stored dims";
    if (stored && !sourceFile) action = "skip: no sourceFile";
    else if (stored && !hasVideo) action = "skip: source video missing";
    else if (stored && !probed) action = "skip: unprobeable";
    else if (stored && probed) {
      action = stored.width === probed.width && stored.height === probed.height
        ? "ok: already correct"
        : "REWRITE";
    }
    rows.push({ gloss: a.gloss, path: v.landmark_json_path, stored, probed, sourceFile, action });
  }

  const rewrite = rows.filter((r) => r.action === "REWRITE");
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} published assets examined\n`);
  console.log("gloss              stored       probed       action");
  for (const r of rows) {
    const s = r.stored ? `${r.stored.width}x${r.stored.height}` : "-";
    const p = r.probed ? `${r.probed.width}x${r.probed.height}${r.probed.rotated ? "*" : " "}` : "-";
    console.log(`${r.gloss.padEnd(18)} ${s.padEnd(12)} ${p.padEnd(12)} ${r.action}`);
  }
  console.log(`\n* = source carries a rotation flag`);
  const counts = rows.reduce((m, r) => ({ ...m, [r.action.split(":")[0]]: (m[r.action.split(":")[0]] ?? 0) + 1 }), {});
  console.log(`summary: ${JSON.stringify(counts)}`);

  if (!APPLY) {
    console.log(`\nwould rewrite ${rewrite.length}. Re-run with --apply.`);
    return;
  }

  let done = 0;
  const changed = [];
  for (const r of rewrite) {
    const url = `${URL_BASE}/storage/v1/object/${BUCKET}/${r.path}`;
    const before = await (await fetch(url, { headers: H })).text();
    const m = DIMS.exec(before);
    if (!m) { console.log(`  SKIP ${r.gloss}: dimensions not found in full object`); continue; }

    const after = before.replace(DIMS, `"imageWidth":${r.probed.width},"imageHeight":${r.probed.height}`);

    // Everything except those two numbers must be untouched. Blanking the field
    // in both and comparing proves it without reparsing the landmarks.
    const blank = (s) => s.replace(DIMS, '"imageWidth":0,"imageHeight":0');
    if (blank(before) !== blank(after)) {
      console.log(`  ABORT ${r.gloss}: edit touched more than the dimensions`);
      continue;
    }

    const put = await fetch(url, {
      method: "PUT",
      headers: { ...H, "Content-Type": "application/json", "x-upsert": "true" },
      body: after,
    });
    if (!put.ok) { console.log(`  FAIL ${r.gloss}: HTTP ${put.status} ${(await put.text()).slice(0, 120)}`); continue; }

    changed.push(r.gloss);
    done++;
    if (done % 10 === 0) console.log(`  … ${done}/${rewrite.length}`);
  }

  const report = path.join(ROOT, "scripts", "fix-transposed-asset-dimensions.applied.json");
  fs.writeFileSync(report, JSON.stringify({ at: new Date().toISOString(), changed }, null, 2));
  console.log(`\nrewrote ${done} of ${rewrite.length}. List written to ${path.relative(ROOT, report)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
