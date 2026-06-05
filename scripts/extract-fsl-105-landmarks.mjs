// Run directly: node scripts/extract-fsl-105-landmarks.mjs
// Test mode:  node scripts/extract-fsl-105-landmarks.mjs --test

import fs from "fs";
import path from "path";
import http from "http";
import { exec } from "child_process";
import puppeteer from "puppeteer";

const RAW_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_105");
const OUTPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_105");
const TMP_DIR = path.join(process.cwd(), "tmp", "fsl_105_frames");
const TV_DIR = path.join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision");
const FFMPEG = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe");

const SEQUENCE_LENGTH = 120;
const FEATURE_DIMENSION = 126;
const FPS = 30;
const PORT = 8772;
const MAX_FRAMES_PER_VIDEO = 300;
const CKPT_INTERVAL = 50; // save checkpoint every N videos
const RESTART_EVERY = 200; // restart browser page every N videos to prevent memory leak
const CKPT_DIR = path.join(OUTPUT_DIR, ".checkpoints");
const PROGRESS_DIR = path.join(OUTPUT_DIR, ".progress");

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".wasm": "application/wasm", ".data": "application/octet-stream", ".task": "application/octet-stream",
  ".png": "image/png",
};

const readCsv = (filePath) => {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || "").trim(); });
    return row;
  });
};

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const extractFrames = (videoPath, frameDir) => {
  return new Promise((resolve, reject) => {
    ensureDir(frameDir);
    const cmd = `"${FFMPEG}" -i "${videoPath}" -q:v 2 -vf "fps=${FPS}" "${path.join(frameDir, "f_%04d.png")}"`;
    exec(cmd, { timeout: 120000 }, (error) => {
      if (error && !fs.existsSync(path.join(frameDir, "f_0001.png"))) return reject(error);
      const files = fs.readdirSync(frameDir).filter(f => f.endsWith(".png")).sort();
      resolve(files);
    });
  });
};

const normalizeHand = (landmarks) => {
  if (!landmarks || landmarks.length !== 21) return null;
  const wrist = landmarks[0];
  const centered = landmarks.map((p) => ({
    x: p.x - wrist.x, y: p.y - wrist.y, z: p.z - wrist.z,
  }));
  let maxAbs = 0;
  for (const p of centered) maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  if (maxAbs === 0) return centered;
  return centered.map((p) => ({ x: p.x / maxAbs, y: p.y / maxAbs, z: p.z / maxAbs }));
};

const buildFrameFeatures = (frameResult) => {
  const handSlots = [null, null];
  if (frameResult.handedness && frameResult.handedness.length > 0) {
    for (let i = 0; i < frameResult.handedness.length; i++) {
      const label = frameResult.handedness[i][0]?.categoryName || "Right";
      const normalized = normalizeHand(frameResult.landmarks[i]);
      if (!normalized) continue;
      const slot = label.toLowerCase().includes("left") ? 0 : 1;
      if (handSlots[slot] === null) { handSlots[slot] = normalized; continue; }
      const firstEmpty = handSlots.indexOf(null);
      if (firstEmpty !== -1) handSlots[firstEmpty] = normalized;
    }
  }
  const features = [];
  for (const slot of handSlots) {
    if (!slot) { for (let i = 0; i < 21; i++) features.push(0, 0, 0); }
    else { for (const p of slot) features.push(p.x, p.y, p.z); }
  }
  return features.length === FEATURE_DIMENSION ? features : null;
};

const hasAnyLandmarks = (features) => {
  if (!features) return false;
  return features.some(v => v !== 0);
};

const temporalSample = (sequence) => {
  if (sequence.length === 0) return [];
  if (sequence.length >= SEQUENCE_LENGTH) return sequence.slice(0, SEQUENCE_LENGTH);
  const sampled = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    const idx = Math.round(i * (sequence.length - 1) / (SEQUENCE_LENGTH - 1));
    sampled.push(sequence[Math.min(idx, sequence.length - 1)]);
  }
  return sampled;
};

const progressPath = (splitName) => path.join(PROGRESS_DIR, `${splitName}_progress.json`);
const samplesPath = (splitName) => path.join(CKPT_DIR, `${splitName}_samples.json`);

const loadCheckpoint = (splitName) => {
  const pp = progressPath(splitName);
  const sp = samplesPath(splitName);
  // If no progress file, nothing to resume
  if (!fs.existsSync(pp)) return null;
  const progress = JSON.parse(fs.readFileSync(pp, "utf8"));
  // If we have progress but no samples checkpoint, cannot resume
  if (!fs.existsSync(sp)) {
    fs.unlinkSync(pp);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(sp, "utf8"));
  console.log(`  Resumed from checkpoint: ${data.samples.length} samples, last index ${progress.lastIndex}`);
  return data;
};

const saveProgress = (splitName, lastIndex) => {
  ensureDir(PROGRESS_DIR);
  fs.writeFileSync(progressPath(splitName), JSON.stringify({ lastIndex }));
};

const saveSamplesCheckpoint = (splitName, samples, lastIndex) => {
  ensureDir(CKPT_DIR);
  fs.writeFileSync(samplesPath(splitName), JSON.stringify({ samples, lastIndex }));
};

const clearCheckpoint = (splitName) => {
  const pp = progressPath(splitName);
  const sp = samplesPath(splitName);
  if (fs.existsSync(pp)) fs.unlinkSync(pp);
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
};

const writeSplitJson = (filePath, samples) => {
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  stream.write(`{\n  "sequenceLength": ${SEQUENCE_LENGTH},\n  "featureDimension": ${FEATURE_DIMENSION},\n  "samples": [\n`);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    stream.write(JSON.stringify({
      label: s.label, labelId: s.labelId, originalFrameCount: s.originalFrameCount,
      signerId: s.signerId, sessionId: s.sessionId, deviceType: s.deviceType,
      lighting: s.lighting, handedness: s.handedness,
      augmentationPreset: s.augmentationPreset, originalFile: s.originalFile,
      sequence: s.sequence,
    }));
    if (i < samples.length - 1) stream.write(",\n");
  }
  stream.write("\n  ]\n}\n");
  stream.end();
};

const main = async () => {
  console.log("Reading CSVs...");
  const labels = readCsv(path.join(RAW_DIR, "labels.csv"));
  const labelMap = Object.fromEntries(labels.map((r) => [Number(r.id), r.label]));
  const allLabels = labels.map((r) => r.label);

  const splits = {
    train: readCsv(path.join(RAW_DIR, "train.csv")),
    test: readCsv(path.join(RAW_DIR, "test.csv")),
  };

  ensureDir(OUTPUT_DIR);
  ensureDir(TMP_DIR);
  // Clean stale temp dirs from previous runs
  for (const entry of fs.readdirSync(TMP_DIR)) {
    const p = path.join(TMP_DIR, entry);
    try { if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }

  // Start local server for MediaPipe files
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const ext = path.extname(url);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(`<!DOCTYPE html><html><body>
<script type="module">
import { HandLandmarker, FilesetResolver } from "/vision_bundle.mjs";
async function init() {
  const vision = await FilesetResolver.forVisionTasks("/wasm/");
  window.__hlm = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
    },
    runningMode: "IMAGE", numHands: 2, minHandDetectionConfidence: 0.1,
  });
  window.__processFrames = async (frames) => {
    const results = [];
    for (let i = 0; i < frames.length; i++) {
      const img = new Image(); img.src = frames[i]; await img.decode();
      const r = window.__hlm.detect(img);
      results.push({ landmarks: r.landmarks || [], handedness: r.handedness || [] });
    }
    return results;
  };
  document.title = "ready";
}
init().catch(e => { document.title = "err:" + (e.message || "unknown"); });
</script></body></html>`);
    } else {
      let filePath = path.join(TV_DIR, url.replace(/^\//, ""));
      if (fs.existsSync(filePath)) { res.end(fs.readFileSync(filePath)); return; }
      res.statusCode = 404; res.end();
    }
  });
  await new Promise((r) => server.listen(PORT, r));
  console.log("Server on", PORT);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--js-flags=--max_old_space_size=4096"],
    protocolTimeout: 300000, // 5 min protocol timeout for page.evaluate
  });

  const initPage = async () => {
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("PAGE CONSOLE ERROR:", msg.text());
    });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => document.title === "ready", { timeout: 120000 });
    return page;
  };

  let page = await initPage();
  console.log("HandLandmarker initialized");

  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const [splitName, rows] of Object.entries(splits)) {
    let samples = [];
    let startIdx = 0;

    // Try to resume from checkpoint
    const ckpt = loadCheckpoint(splitName);
    if (ckpt) {
      samples = ckpt.samples;
      startIdx = ckpt.lastIndex + 1;
      console.log(`\n${splitName}: ${rows.length} videos (resuming from index ${startIdx})`);
    } else {
      console.log(`\n${splitName}: ${rows.length} videos`);
    }

    const limit = process.argv.includes("--test") ? (splitName === "train" ? 10 : 5) : rows.length;
    const rowsToProcess = rows.slice(0, limit);

    for (let i = startIdx; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const videoRelPath = row.vid_path.replace(/\\/g, "/");
      const videoPath = path.join(RAW_DIR, videoRelPath);
      const labelId = Number(row.id_label);
      const label = labelMap[labelId];
      const logMarker = `[${i + 1}/${rowsToProcess.length}] ${label}`;

      if (!fs.existsSync(videoPath)) {
        console.warn(`  ${logMarker} MISSING`);
        totalSkipped++; continue;
      }

      const frameDir = path.join(TMP_DIR, `${splitName}_${i}`);

      try {
        if (fs.existsSync(frameDir)) fs.rmSync(frameDir, { recursive: true });

        let frameFiles;
        try {
          frameFiles = await extractFrames(videoPath, frameDir);
        } catch {
          console.warn(`  ${logMarker} ffmpeg fail`);
          totalSkipped++; continue;
        }

        if (frameFiles.length < 5) {
          console.warn(`  ${logMarker} ${frameFiles.length} frames`);
          totalSkipped++; continue;
        }

        // Convert frames to base64
        const toProcess = frameFiles.slice(0, MAX_FRAMES_PER_VIDEO);
        const frameData = toProcess.map(f =>
          "data:image/png;base64," + fs.readFileSync(path.join(frameDir, f)).toString("base64")
        );

        // Process in browser
        const results = await page.evaluate(async (frames) => {
          return await window.__processFrames(frames);
        }, frameData);

        // Convert to features
        const rawSequence = [];
        for (const r of results) {
          const features = buildFrameFeatures(r);
          if (hasAnyLandmarks(features)) rawSequence.push(features);
        }

        if (rawSequence.length < 5) {
          console.warn(`  ${logMarker} ${rawSequence.length} valid`);
          totalSkipped++; continue;
        }

        const sequence = temporalSample(rawSequence);

        samples.push({
          label, labelId, sequence,
          originalFrameCount: rawSequence.length,
          signerId: `S${String(labelId).padStart(2, "0")}`,
          sessionId: `fsl105-${splitName}-${i}`,
          deviceType: "mobile", lighting: "studio",
          handedness: "right", augmentationPreset: null,
          originalFile: videoRelPath,
        });

        totalProcessed++;
        console.log(`  ${logMarker} OK (${rawSequence.length} frames → ${sequence.length} steps)`);

        // Lightweight progress after every video
        saveProgress(splitName, i);
        // Full samples checkpoint periodically
        if ((i + 1) % CKPT_INTERVAL === 0) {
          saveSamplesCheckpoint(splitName, samples, i);
          console.log(`  --- checkpoint saved at index ${i} ---`);
        }
        // Restart page periodically to prevent memory leak
        if ((i + 1) % RESTART_EVERY === 0 && (i + 1) < rowsToProcess.length) {
          console.log(`  --- restarting browser page ---`);
          await page.close();
          page = await initPage();
        }
      } catch (err) {
        console.error(`  ${logMarker} ERROR: ${err.message}`);
        totalSkipped++;
      } finally {
        if (fs.existsSync(frameDir)) try { fs.rmSync(frameDir, { recursive: true }); } catch {}
      }
    }

    console.log(`Writing ${splitName}.json (${samples.length} samples)...`);
    writeSplitJson(path.join(OUTPUT_DIR, `${splitName}.json`), samples);
    clearCheckpoint(splitName);
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "labels.json"),
    JSON.stringify({ labels: allLabels, total: allLabels.length }, null, 2)
  );

  await browser.close();
  server.close();
  console.log(`\nDone! Processed: ${totalProcessed}, Skipped: ${totalSkipped}`);
  process.exit(0);
};

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nInterrupted. Checkpoint saved. Resume with same command.");
  process.exit(1);
});

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
