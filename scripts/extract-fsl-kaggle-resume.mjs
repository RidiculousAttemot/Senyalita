#!/usr/bin/env node
/**
 * Re-extract MediaPipe landmarks for specific labels only (Y, Z), with a
 * freshly launched browser, then merge into the existing per-label sample
 * files.
 *
 * Usage: node scripts/extract-fsl-kaggle-resume.mjs
 */

import fs from "fs";
import path from "path";
import https from "https";
import selfsigned from "selfsigned";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "datasets", "raw", "fsl_alphabet_kaggle", "Collated");
const OUTPUT_DIR = path.join(ROOT, "datasets", "processed", "fsl_kaggle_landmarks");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEST_HTML = path.join(PUBLIC_DIR, "mp-extract.html");
const HOST = "127.0.0.1";
const PORT = 17861;
const TARGET_LABELS = (process.env.LABELS || "y,z").split(",");
const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const MAX_IMAGE_DIM = 640;
const MIN_DETECTION_CONFIDENCE = 0.3;
const LABELS = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];

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
        frame[offset++] = p[0]; frame[offset++] = p[1]; frame[offset++] = p[2];
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

const collectInputs = (label) => {
  const labelId = LABELS.indexOf(label);
  const labelDir = path.join(INPUT_DIR, label.toUpperCase());
  if (!fs.existsSync(labelDir)) return [];
  const files = fs.readdirSync(labelDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  return files.map(file => ({ label, labelId, sourceFile: file, imagePath: path.join(labelDir, file) }));
};

const writeExtractHtml = (baseUrl) => {
  ensureDir(PUBLIC_DIR);
  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body>
<script type="module">
import { HandLandmarker, FilesetResolver } from "${baseUrl}/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
const fileset = await FilesetResolver.forVisionTasks("${baseUrl}/node_modules/@mediapipe/tasks-vision/wasm");
const landmarker = await HandLandmarker.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: "${baseUrl}/models/mediapipe/hand_landmarker.task", delegate: "CPU" },
  numHands: 2, runningMode: "IMAGE", minHandDetectionConfidence: ${MIN_DETECTION_CONFIDENCE}
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
    width: img.naturalWidth, height: img.naturalHeight,
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

const extractLabel = async (label) => {
  console.log(`\n=== Re-extracting label: ${label.toUpperCase()} ===`);
  const inputs = collectInputs(label);
  console.log(`  ${inputs.length} images`);

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
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
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
  writeExtractHtml(baseUrl);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors"]
  });

  const samples = [];
  let success = 0, noHands = 0, failed = 0;
  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.log("  [page error]", err.message));
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (url.includes("/models/mediapipe/hand_landmarker.task")) return;
      console.log("  [request fail]", url, req.failure()?.errorText);
    });

    const t0 = Date.now();
    const response = await page.goto(`${baseUrl}/public/mp-extract.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`  HTTP ${response.status()}, init ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await page.waitForFunction("window.__ready === true", { timeout: 180000 });

    const procStart = Date.now();
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i];
      const b64 = fs.readFileSync(inp.imagePath).toString("base64");
      let detectResult;
      try {
        detectResult = await page.evaluate((b) => window.__detect(b), b64);
      } catch (e) {
        failed++;
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

      if (!left && !right) { noHands++; continue; }

      const frame = buildFrame(left, right);
      const sequence = buildSequence(frame);
      samples.push({
        sequence, label: inp.label, labelId: inp.labelId,
        originalFrameCount: 1, source: "kaggle", sourceFile: inp.sourceFile,
        imagePath: path.relative(ROOT, inp.imagePath),
        extractedAt: new Date().toISOString(),
        handCount: (left ? 1 : 0) + (right ? 1 : 0)
      });
      success++;

      if ((i + 1) % 50 === 0 || i === inputs.length - 1) {
        const elapsed = (Date.now() - procStart) / 1000;
        const rate = (i + 1) / elapsed;
        const remaining = (inputs.length - i - 1) / rate;
        console.log(`  ${i + 1}/${inputs.length} (${rate.toFixed(1)} img/s, ETA ${remaining.toFixed(0)}s) — success ${success} / no-hands ${noHands} / failed ${failed}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
    try { fs.unlinkSync(TEST_HTML); } catch {}
  }

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
  console.log(`  Saved ${samples.length} samples to ${outPath} (success=${success}, no-hands=${noHands}, failed=${failed})`);

  return { label, success, noHands, failed, kept: samples.length };
};

const main = async () => {
  const results = [];
  for (const label of TARGET_LABELS) {
    results.push(await extractLabel(label));
  }
  console.log("\n=== Re-extraction summary ===");
  for (const r of results) console.log(`  ${r.label}: kept ${r.kept} (success=${r.success}, no-hands=${r.noHands}, failed=${r.failed})`);
};

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
