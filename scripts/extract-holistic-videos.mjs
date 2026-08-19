#!/usr/bin/env node
import fs from "fs";
import path from "path";
import http from "http";
import { exec } from "child_process";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const FFMPEG = path.join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const TV_DIR = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision");
const INPUT_ROOT = path.join(ROOT, "datasets", "raw", "user_videos");
const OUTPUT_DIR = path.join(ROOT, "datasets", "processed", "user_holistic_assets");
const TMP_DIR = path.join(ROOT, "tmp", "holistic_extract");
/**
 * The frame server binds an EPHEMERAL port (0) and reports back what it got.
 *
 * It used to be fixed at 8771. A stale extractor still holding that port made a
 * fresh run die with EADDRINUSE on its SECOND video -- after the first had
 * already logged normally, so the log read as slow progress for 46 minutes
 * rather than as a crash. An ephemeral port cannot collide, which removes the
 * failure rather than adding a pre-flight check someone has to remember.
 */
const TARGET_FPS = 30;
const MAX_FRAMES = 300;

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".wasm": "application/wasm", ".data": "application/octet-stream", ".task": "application/octet-stream",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".tflite": "application/octet-stream",
};

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const extractFrames = (videoPath, frameDir) => {
  return new Promise((resolve, reject) => {
    ensureDir(frameDir);
    const cmd = `"${FFMPEG}" -i "${videoPath}" -q:v 2 -vf "fps=${TARGET_FPS}" "${path.join(frameDir, "frame_%04d.png")}"`;
    exec(cmd, { timeout: 120000 }, (error, _stdout, stderr) => {
      if (error) { try { fs.rmSync(frameDir, { recursive: true }); } catch {} return reject(error); }
      const files = fs.readdirSync(frameDir).filter(f => f.endsWith(".png")).sort();
      // Landmarks come back normalised; the source dimensions are what let
      // playback restore true pixel-space proportions later.
      // ffmpeg reports the *coded* size here. A phone recording is stored
      // landscape with a rotation flag, and ffmpeg auto-rotates when it
      // decodes the frames above — so the landmarks below are normalised
      // against the rotated frame while this line still reads the raw one.
      // Taking it at face value transposed the dimensions for every portrait
      // capture, which stretched the figure horizontally on playback and made
      // its fitted box look 2.2:1 instead of 0.7:1.
      const dims = /Video:.*?,\s*(\d{2,5})x(\d{2,5})/.exec(stderr ?? "");
      let imageWidth = dims ? Number(dims[1]) : null;
      let imageHeight = dims ? Number(dims[2]) : null;
      const rotation = /displaymatrix:\s*rotation of\s*(-?[\d.]+)\s*degrees/i.exec(stderr ?? "");
      if (rotation && imageWidth && imageHeight) {
        const deg = Math.abs(Math.round(Number(rotation[1]))) % 180;
        if (deg === 90) [imageWidth, imageHeight] = [imageHeight, imageWidth];
      }
      resolve({
        files,
        imageWidth,
        imageHeight,
      });
    });
  });
};

/**
 * `--only "GOOD MORNING"` restricts the run to one label (repeatable).
 *
 * Without it this walks every directory under INPUT_ROOT, which is now 130 --
 * i.e. the entire batch. That is the right default for the batch itself and the
 * wrong one for verifying a single sign, where extracting 129 others is both a
 * long wait and a large accidental state change.
 */
/** Re-extract even when the output already exists. See the skip below. */
const FORCE = process.argv.includes("--force");

const ONLY = process.argv.reduce((acc, arg, i) => {
  if (arg === "--only" && process.argv[i + 1]) acc.push(process.argv[i + 1].toLowerCase());
  return acc;
}, []);

const collectVideos = () => {
  const videos = [];
  const entries = fs.readdirSync(INPUT_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const label = entry.name;
    if (ONLY.length > 0 && !ONLY.includes(label.toLowerCase())) continue;
    const labelDir = path.join(INPUT_ROOT, label);
    const files = fs.readdirSync(labelDir).filter(f => /\.(mp4|mov|webm|avi|MP4|MOV)$/i.test(f));
    for (const file of files) {
      videos.push({ label, file, videoPath: path.join(labelDir, file) });
    }
  }
  return videos;
};

const buildExtractHtml = (frameCount) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<script type="module">
import { HolisticLandmarker, FilesetResolver } from "/vision_bundle.mjs";
const BASE = location.origin;
const TOTAL = ${frameCount};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function safe(lm) {
  if (!lm || !lm[0] || !Array.isArray(lm[0])) return [];
  return lm[0].map(p => ({ x: p.x, y: p.y, z: p.z }));
}

async function main() {
  const vision = await FilesetResolver.forVisionTasks(BASE + "/wasm/");
  const HLM = await HolisticLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task", delegate: "CPU" },
    runningMode: "IMAGE",
    minHandDetectionConfidence: 0.3,
    minPoseDetectionConfidence: 0.3,
  });

  const results = [];
  for (let i = 0; i < TOTAL; i++) {
    const padded = String(i + 1).padStart(4, "0");
    const img = await loadImage(BASE + "/frames/frame_" + padded + ".png");
    const r = HLM.detect(img);
    results.push({
      poseLandmarks: safe(r.poseLandmarks),
      faceLandmarks: safe(r.faceLandmarks),
      leftHandLandmarks: safe(r.leftHandLandmarks),
      rightHandLandmarks: safe(r.rightHandLandmarks),
    });
    document.title = "p:" + (i + 1) + "/" + TOTAL;
  }
  window.__results = results;
  document.title = "done";
}
main().catch(e => { document.title = "err:" + e.message; console.error(e); });
</script></body></html>`;

class VideoServer {
  constructor(frameDir, frameCount) {
    this.server = http.createServer((req, res) => {
      const url = req.url.split("?")[0];
      const ext = path.extname(url);
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (url === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(buildExtractHtml(frameCount));
      } else if (url.startsWith("/frames/")) {
        const fileName = path.basename(url);
        const filePath = path.join(frameDir, fileName);
        if (fs.existsSync(filePath)) {
          res.end(fs.readFileSync(filePath));
        } else {
          res.statusCode = 404;
          res.end("not found");
        }
      } else if (url.startsWith("/wasm/") || url.endsWith(".wasm") || url.endsWith(".js") || url.endsWith(".mjs")) {
        const filePath = path.join(TV_DIR, url.replace(/^\//, ""));
        if (fs.existsSync(filePath)) {
          res.end(fs.readFileSync(filePath));
        } else {
          res.statusCode = 404;
          res.end("404");
        }
      } else {
        res.statusCode = 404;
        res.end("404");
      }
    });
  }

  async start() {
    await new Promise((resolve) => this.server.listen(0, resolve));
    this.port = this.server.address().port;
    return this.port;
  }

  stop() {
    this.server.close();
  }
}

const main = async () => {
  console.log("=== Holistic Video Extraction ===");
  ensureDir(OUTPUT_DIR);
  ensureDir(TMP_DIR);

  const videos = collectVideos();
  console.log(`Found ${videos.length} videos`);
  if (videos.length === 0) return;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const stats = { total: videos.length, ok: 0, fail: 0 };
  const startTime = Date.now();

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const frameDir = path.join(TMP_DIR, `v_${String(i).padStart(4, "0")}`);
    // Timestamped, because a dead run and a slow run look identical in a log that
    // only prints on completion: a crashed extractor once read as normal progress
    // for 46 minutes before anyone checked.
    const videoStart = Date.now();
    console.log(`
[${i + 1}/${videos.length}] ${new Date().toISOString().slice(11, 19)} ${v.label}/${v.file}`);

    /**
     * Resume rather than restart.
     *
     * A 92-sign run takes hours and is unattended. Without this, any
     * interruption -- a crash, a closed laptop, a Ctrl-C to fix one bad video --
     * means re-extracting everything already done. Existence of the output is
     * the whole condition: no manifest to keep in sync, nothing to go stale, and
     * correct even if the process was killed mid-write of a LATER sign.
     *
     * --force re-extracts anyway, for when a video is replaced in place.
     */
    const existingPath = path.join(
      OUTPUT_DIR,
      v.label,
      `${path.basename(v.file, path.extname(v.file))}_asset.json`,
    );
    if (!FORCE && fs.existsSync(existingPath)) {
      console.log("    already extracted — skipping (use --force to re-extract)");
      stats.skip = (stats.skip ?? 0) + 1;
      continue;
    }

    try {
      const { files: frameFiles, imageWidth, imageHeight } = await extractFrames(v.videoPath, frameDir);
      if (frameFiles.length === 0) { console.log("    No frames"); stats.fail++; continue; }
      if (frameFiles.length > MAX_FRAMES) {
        console.log(`    ${frameFiles.length} frames (truncated to ${MAX_FRAMES})`);
      } else {
        console.log(`    ${frameFiles.length} frames`);
      }
      const useFrames = Math.min(frameFiles.length, MAX_FRAMES);

      const server = new VideoServer(frameDir, useFrames);
      const port = await server.start();

      const page = await browser.newPage();
      let results = null;
      try {
        page.on("pageerror", (err) => console.log("    [browser error]", err.message));
        // domcontentloaded, NOT networkidle0.
        //
        // The page starts fetching its N frame PNGs the moment it loads, so
        // "no connections for 500ms" is not reached until every frame has been
        // pulled. For a ~300-frame video that exceeded the 60s navigation
        // timeout and the extraction failed -- while ~170-frame videos settled
        // in time and passed. All 16 failures in a 278-video run were long
        // videos, including all 3 that hit the MAX_FRAMES cap.
        //
        // The goto never needed to wait for the frames at all: completion is
        // signalled by the document title and waited on below with its own
        // 600s budget.
        await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction(
          () => document.title.startsWith("done") || document.title.startsWith("err"),
          { timeout: 600000 }
        );
        const title = await page.title();
        if (title.startsWith("err")) throw new Error(title);
        results = await page.evaluate(() => window.__results);
      } finally {
        await page.close();
        server.stop();
      }

      if (!results || results.length === 0) {
        console.log("    No results from detection");
        stats.fail++;
        continue;
      }

      const animFrames = results.map((f, idx) => ({
        timestamp: Math.round(idx * (1000 / TARGET_FPS)),
        landmarks: [
          ...((f.leftHandLandmarks && f.leftHandLandmarks.length > 0) ? [{ landmarks: f.leftHandLandmarks, side: "left" }] : []),
          ...((f.rightHandLandmarks && f.rightHandLandmarks.length > 0) ? [{ landmarks: f.rightHandLandmarks, side: "right" }] : []),
        ],
        poseLandmarks: f.poseLandmarks || [],
        faceLandmarks: f.faceLandmarks || [],
      }));

      const outDir = path.join(OUTPUT_DIR, v.label);
      ensureDir(outDir);
      const baseName = path.basename(v.file, path.extname(v.file));
      const outPath = path.join(outDir, `${baseName}_asset.json`);

      const firstTs = animFrames[0]?.timestamp || 0;
      const lastTs = animFrames[animFrames.length - 1]?.timestamp || 0;
      const asset = {
        label: v.label,
        language: "FSL",
        fps: TARGET_FPS,
        duration: lastTs - firstTs,
        totalFrames: animFrames.length,
        frames: animFrames,
        // No `video` field. It used to hold "/api/videos/<label>/<file>", baked in
        // at extraction time -- a URL frozen into stored data, which went stale the
        // moment recordings moved to Storage and left every published asset pointing
        // at a dead path. The player resolves the recording from the gloss instead,
        // via /api/animations/[gloss]/video, so nothing reads this field any more
        // (re-confirmed 2026-08-17: zero live readers). Re-adding it would put the
        // dead path back into every asset this script produces.
        imageWidth,
        imageHeight,
        metadata: {
          sourceFile: v.file,
          source: "user-video-extraction",
          featureDimension: 3,
          sequenceLength: animFrames.length,
          version: 1,
        },
      };
      fs.writeFileSync(outPath, JSON.stringify(asset, null, 2));
      console.log(`    Saved: ${animFrames.length} frames -> ${path.relative(ROOT, outPath)} (${((Date.now() - videoStart) / 1000).toFixed(0)}s)`);
      stats.ok++;
    } catch (e) {
      console.log(`    FAILED: ${(e.message || e).slice(0, 150)}`);
      stats.fail++;
    } finally {
      try { fs.rmSync(frameDir, { recursive: true }); } catch {}
    }

    const elapsed = (Date.now() - startTime) / 1000 / 60;
    const rate = (i + 1) / elapsed;
    const eta = (videos.length - i - 1) / (rate || 1);
    console.log(`    Progress: ${stats.ok} ok, ${stats.fail} failed | ETA ${eta.toFixed(0)} min`);
  }

  await browser.close();

  const manifest = {
    extractedAt: new Date().toISOString(),
    totalVideos: videos.length,
    successful: stats.ok,
    failed: stats.fail,
    labels: [...new Set(videos.map(v => v.label))],
    fps: TARGET_FPS,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone: ${stats.ok} ok, ${stats.fail} failed in ${totalMin} min`);
};

main().catch(console.error);
