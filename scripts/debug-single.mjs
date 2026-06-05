import fs from "fs";
import path from "path";
import http from "http";
import { execSync } from "child_process";
import puppeteer from "puppeteer";

const RAW_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_105");
const TV_DIR = path.join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision");
const FFMPEG = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe");
const PORT = 8777;

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".wasm": "application/wasm", ".data": "application/octet-stream", ".task": "application/octet-stream",
};

const PAGE_HTML = `<!DOCTYPE html><html><body>
<script type="module">
import { HandLandmarker, FilesetResolver } from "/vision_bundle.mjs";
async function init() {
  const vision = await FilesetResolver.forVisionTasks("/wasm/");
  window.__hlm = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
    },
    runningMode: "IMAGE", numHands: 2, minHandDetectionConfidence: 0.1, minTrackingConfidence: 0.1,
  });
  window.__processFrames = async (frames) => {
    const results = [];
    for (let i = 0; i < frames.length; i++) {
      try {
        const img = new Image(); img.src = frames[i]; await img.decode();
        const r = window.__hlm.detect(img);
        results.push({ landmarks: r.landmarks || [], handedness: r.handedness || [] });
      } catch(e) { results.push({ landmarks: [], handedness: [] }); }
    }
    return results;
  };
  document.title = "ready";
}
init().catch(e => { document.title = "err:" + (e.message || "unknown"); });
</script></body></html>`;

const testVideos = [
  { path: path.join(RAW_DIR, "clips", "17", "6.MOV"), label: "CORRECT (ID17,v6)" },
  { path: path.join(RAW_DIR, "clips", "17", "7.MOV"), label: "CORRECT (ID17,v7)" },
  { path: path.join(RAW_DIR, "clips", "74", "6.MOV"), label: "RED (ID74,v6)" },
];

const main = async () => {
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const ext = path.extname(url);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(PAGE_HTML);
    } else {
      const filePath = path.join(TV_DIR, url.replace(/^\//, ""));
      if (fs.existsSync(filePath)) { res.end(fs.readFileSync(filePath)); return; }
      res.statusCode = 404; res.end();
    }
  });
  await new Promise(r => server.listen(PORT, r));
  console.log("Server on", PORT);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => document.title === "ready", { timeout: 120000 });
  console.log("Model ready\n");

  for (const v of testVideos) {
    console.log(`\n=== ${v.label} ===`);
    if (!fs.existsSync(v.path)) { console.log("  NOT FOUND"); continue; }

    const frameDir = path.join(process.cwd(), "tmp", `d_${Date.now()}`);
    fs.mkdirSync(frameDir, { recursive: true });
    execSync(`"${FFMPEG}" -i "${v.path}" -q:v 2 -vf "fps=30" "${path.join(frameDir, "f_%04d.png")}"`, { timeout: 60000 });
    const files = fs.readdirSync(frameDir).filter(f => f.endsWith(".png")).sort();
    console.log(`  ${files.length} frames`);

    const frameData = files.map(f => "data:image/png;base64," + fs.readFileSync(path.join(frameDir, f)).toString("base64"));
    const results = await page.evaluate(async frames => await window.__processFrames(frames), frameData);

    const handCounts = results.map(r => r.landmarks?.length || 0);
    const withHands = handCounts.filter(c => c > 0).length;
    const firstHand = handCounts.findIndex(c => c > 0);
    const lastHand = handCounts.length - 1 - [...handCounts].reverse().findIndex(c => c > 0);
    const rightHands = results.filter(r => r.handedness?.[0]?.[0]?.categoryName === "Right").length;
    const leftHands = results.filter(r => r.handedness?.[0]?.[0]?.categoryName === "Left").length;
    console.log(`  Hands: ${withHands}/${files.length} frames (${(withHands/files.length*100).toFixed(0)}%)`);
    console.log(`  Range: ${firstHand}-${lastHand}, Right: ${rightHands}, Left: ${leftHands}`);

    // Show runs
    let prev = handCounts[0] > 0, rs = 0;
    for (let i = 1; i <= handCounts.length; i++) {
      const cur = i < handCounts.length ? handCounts[i] > 0 : false;
      if (cur !== prev) {
        if (prev) console.log(`    HAND: ${rs}-${i-1} (${i-rs})`);
        rs = i; prev = cur;
      }
    }

    fs.rmSync(frameDir, { recursive: true, force: true });
  }

  await browser.close();
  server.close();
};
main().catch(console.error);
