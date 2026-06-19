#!/usr/bin/env node
/**
 * Extract MediaPipe Hand Landmarks from Kaggle FSL images using Puppeteer + HTTPS.
 *
 * - Serves the workspace via a self-signed HTTPS server (loopback is treated as
 *   a secure context, so the MediaPipe tasks-vision bundle and WASM can be
 *   loaded by the headless browser).
 * - For each image, base64-encodes it, sends it to the browser, runs
 *   HandLandmarker.detect() (modern tasks-vision API for IMAGE mode), and
 *   collects left/right hand landmarks.
 * - Applies the same wrist-centered max-abs normalization as
 *   `src/features/recognition/normalize.ts`, builds a 126-feature frame, then
 *   replicates it to a 120-frame sequence (Kaggle images are static handshapes).
 * - Writes per-label `samples_<l>.json` files plus `manifest.json` and
 *   `extraction_stats.json` in `datasets/processed/fsl_kaggle_landmarks/`.
 *
 * Usage: node scripts/extract-fsl-kaggle-mediapipe.mjs
 *        LIMIT=500 node scripts/extract-fsl-kaggle-mediapipe.mjs   # dry run
 */

import fs from "fs";
import path from "path";
import https from "https";
import crypto from "crypto";
import selfsigned from "selfsigned";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "datasets", "raw", "fsl_alphabet_kaggle", "Collated");
const OUTPUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_kaggle_landmarks");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEST_HTML = path.join(PUBLIC_DIR, "mp-extract.html");
const HOST = "127.0.0.1";
const PORT = 17861;
const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const MAX_IMAGE_DIM = 640;
const MIN_DETECTION_CONFIDENCE = 0.3;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const normalizeHand = (hand) => {
  if (!hand || hand.length !== 21) return null;
  const wrist = hand[0];
  if (!wrist) return null;
  const centered = hand.map(l => [l.x - wrist.x, l.y - wrist.y, l.z - wrist.z]);
  let maxAbs = 0;
  for (const p of centered) for (const c of p) maxAbs = Math.max(maxAbs, Math.abs(c));
  if (maxAbs === 0) maxAbs = 1;
  return centered.map(p => [p[0] / maxAbs, p[1] / maxAbs, p[2] / maxAbs]);
};

const buildFrame = (leftHand, rightHand) => {
  const frame = new Array(FEATURE_DIMENSION).fill(0);
  let offset = 0;
  for (const hand of [leftHand, rightHand]) {
    if (hand) {
      for (const p of hand) {
        frame[offset++] = p[0];
        frame[offset++] = p[1];
        frame[offset++] = p[2];
      }
    } else {
      offset += 63;
    }
  }
  return frame;
};

const buildSequence = (singleFrame) => {
  const sequence = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) sequence.push(singleFrame);
  return sequence;
};

const collectInputs = () => {
  const inputs = [];
  for (const label of LABELS) {
    const labelId = LABELS.indexOf(label);
    const labelDir = path.join(INPUT_DIR, label.toUpperCase());
    if (!fs.existsSync(labelDir)) continue;
    const files = fs.readdirSync(labelDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    for (const file of files) {
      inputs.push({ label, labelId, sourceFile: file, imagePath: path.join(labelDir, file) });
    }
  }
  return inputs;
};

const writeExtractHtml = (baseUrl) => {
  ensureDir(PUBLIC_DIR);
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>MP Extract</title></head>
<body>
<script type="module">
import { HandLandmarker, FilesetResolver } from "${baseUrl}/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
const fileset = await FilesetResolver.forVisionTasks("${baseUrl}/node_modules/@mediapipe/tasks-vision/wasm");
const landmarker = await HandLandmarker.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: "${baseUrl}/models/mediapipe/hand_landmarker.task", delegate: "CPU" },
  numHands: 2,
  runningMode: "IMAGE",
  minHandDetectionConfidence: ${MIN_DETECTION_CONFIDENCE}
});
window.__landmarker = landmarker;
window.__ready = true;
window.__detect = async (b64) => {
  const img = new Image();
  img.src = "data:image/jpeg;base64," + b64;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const ratio = Math.min(${MAX_IMAGE_DIM} / img.naturalWidth, ${MAX_IMAGE_DIM} / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const result = window.__landmarker.detect(imageData);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    hands: (result.landmarks || []).map((lm, i) => ({
      handedness: result.handednesses?.[i]?.[0]?.categoryName || "Unknown",
      landmarks: lm.map(p => ({ x: p.x, y: p.y, z: p.z }))
    }))
  };
};
</script>
</body></html>`;
  fs.writeFileSync(TEST_HTML, html);
};

const mime = (p) => {
  if (p.endsWith(".mjs") || p.endsWith(".js")) return "application/javascript";
  if (p.endsWith(".wasm")) return "application/wasm";
  if (p.endsWith(".task")) return "application/octet-stream";
  if (p.endsWith(".html")) return "text/html";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".png")) return "image/png";
  return "application/octet-stream";
};

const main = async () => {
  console.log("Extracting MediaPipe landmarks from Kaggle FSL images (Puppeteer + HTTPS)");
  ensureDir(OUTPUT_DIR);

  const pems = await selfsigned.generate(null, {
    days: 1, algorithm: "sha256", keySize: 2048,
    extensions: [{ name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] }]
  });
  const server = https.createServer(
    { key: pems.private, cert: pems.cert, minVersion: "TLSv1.2" },
    (req, res) => {
      const url = req.url.split("?")[0];
      const filePath = path.join(ROOT, url);
      if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end("forbidden"); }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.statusCode = 404; return res.end("not found: " + url);
      }
      res.setHeader("Content-Type", mime(filePath));
      res.setHeader("Access-Control-Allow-Origin", "*");
      fs.createReadStream(filePath).pipe(res);
    }
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });
  const baseUrl = `https://${HOST}:${PORT}`;
  console.log(`HTTPS server: ${baseUrl}`);

  writeExtractHtml(baseUrl);

  let inputs = collectInputs();
  if (Number.isFinite(LIMIT)) {
    console.log(`LIMIT=${LIMIT} — taking only first ${LIMIT} inputs`);
    inputs = inputs.slice(0, LIMIT);
  }
  console.log(`Found ${inputs.length} images across ${LABELS.length} labels`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors"]
  });
  const stats = {
    totalImages: inputs.length,
    successful: 0,
    noHands: 0,
    failed: 0,
    perLabel: {}
  };
  for (const l of LABELS) stats.perLabel[l] = { total: 0, success: 0, noHands: 0, failed: 0 };

  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.log("[page error]", err.message));
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (url.includes("/models/mediapipe/hand_landmarker.task")) return;
      console.log("[request fail]", url, req.failure()?.errorText);
    });

    console.log("Loading MediaPipe in headless browser...");
    const t0 = Date.now();
    const response = await page.goto(`${baseUrl}/public/mp-extract.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`  HTTP ${response.status()}`);
    await page.waitForFunction("window.__ready === true", { timeout: 180000 });
    console.log(`  MediaPipe ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const samplesByLabel = {};
    for (const l of LABELS) samplesByLabel[l] = [];

    const procStart = Date.now();
    let processed = 0;
    let totalDetectMs = 0;
    let totalEncodeMs = 0;

    for (const inp of inputs) {
      const encStart = Date.now();
      const b64 = fs.readFileSync(inp.imagePath).toString("base64");
      totalEncodeMs += Date.now() - encStart;

      let detectResult;
      try {
        const detStart = Date.now();
        detectResult = await page.evaluate((b) => window.__detect(b), b64);
        totalDetectMs += Date.now() - detStart;
      } catch (e) {
        stats.failed++;
        stats.perLabel[inp.label].failed++;
        processed++;
        continue;
      }

      const hands = detectResult.hands || [];
      let left = null, right = null;
      for (const h of hands) {
        const norm = normalizeHand(h.landmarks);
        if (!norm) continue;
        if (h.handedness === "Left") left = norm;
        else right = norm;
      }

      if (!left && !right) {
        stats.noHands++;
        stats.perLabel[inp.label].noHands++;
        processed++;
        continue;
      }

      const frame = buildFrame(left, right);
      const sequence = buildSequence(frame);
      samplesByLabel[inp.label].push({
        sequence,
        label: inp.label,
        labelId: inp.labelId,
        originalFrameCount: 1,
        source: "kaggle",
        sourceFile: inp.sourceFile,
        imagePath: path.relative(ROOT, inp.imagePath),
        extractedAt: new Date().toISOString(),
        handCount: (left ? 1 : 0) + (right ? 1 : 0)
      });

      stats.successful++;
      stats.perLabel[inp.label].success++;
      processed++;

      if (processed % 250 === 0 || processed === inputs.length) {
        const elapsed = (Date.now() - procStart) / 1000;
        const rate = processed / elapsed;
        const remaining = (inputs.length - processed) / rate;
        const avgDetect = totalDetectMs / processed;
        const avgEncode = totalEncodeMs / processed;
        console.log(`  ${processed}/${inputs.length} (${rate.toFixed(1)} img/s, ETA ${(remaining / 60).toFixed(1)} min) — avg detect ${avgDetect.toFixed(0)}ms, encode ${avgEncode.toFixed(0)}ms`);
      }
    }

    console.log(`\nProcessing done in ${((Date.now() - procStart) / 1000).toFixed(1)}s`);
    console.log("Saving per-label JSON files...");
    let totalKept = 0;
    for (const [label, samples] of Object.entries(samplesByLabel)) {
      const outPath = path.join(OUTPUT_DIR, `samples_${label}.json`);
      fs.writeFileSync(outPath, JSON.stringify({
        label,
        version: "1.1",
        sequenceLength: SEQUENCE_LENGTH,
        featureDimension: FEATURE_DIMENSION,
        source: "kaggle_fsl_dataset_mediapipe",
        extractionMethod: "mediapipe-tasks-vision-puppeteer-https",
        totalSamples: samples.length,
        samples
      }, null, 2));
      totalKept += samples.length;
    }
    console.log(`  Wrote ${LABELS.length} label files, total ${totalKept} samples`);

    const manifest = {
      version: "1.1",
      sequenceLength: SEQUENCE_LENGTH,
      featureDimension: FEATURE_DIMENSION,
      source: "kaggle_fsl_dataset_mediapipe",
      extractionMethod: "mediapipe-tasks-vision-puppeteer-https",
      extractedAt: new Date().toISOString(),
      totalSamples: totalKept,
      originalImageCount: inputs.length,
      labelCounts: {},
      labels: LABELS
    };
    for (const l of LABELS) manifest.labelCounts[l] = samplesByLabel[l].length;
    fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

    for (const l of LABELS) {
      stats.perLabel[l].total = inputs.filter(i => i.label === l).length;
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, "extraction_stats.json"), JSON.stringify(stats, null, 2));
    console.log(`\nExtraction complete: ${stats.successful} successful, ${stats.noHands} no-hands, ${stats.failed} failed`);
    console.log(`Kept ${totalKept} samples total`);
  } finally {
    await browser.close();
    server.close();
    try { fs.unlinkSync(TEST_HTML); } catch {}
  }
};

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
