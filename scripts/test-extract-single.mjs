import fs from "fs";
import path from "path";
import http from "http";
import { exec } from "child_process";
import puppeteer from "puppeteer";

const FFMPEG = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe");
const TMP_DIR = path.join(process.cwd(), "tmp", "test_single");
const TV_DIR = path.join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision");
const WASM_DIR = path.join(TV_DIR, "wasm");
const PORT = 8770;

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
  ".wasm": "application/wasm", ".data": "application/octet-stream", ".task": "application/octet-stream",
  ".png": "image/png", ".tflite": "application/octet-stream",
};

const extractFrames = (videoPath, frameDir) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });
    const cmd = `"${FFMPEG}" -i "${videoPath}" -q:v 2 -vf "fps=30" "${path.join(frameDir, "frame_%04d.png")}"`;
    exec(cmd, { timeout: 60000 }, (error) => {
      if (error) return reject(error);
      const files = fs.readdirSync(frameDir).filter(f => f.endsWith(".png")).sort();
      resolve(files);
    });
  });
};

const main = async () => {
  const videoPath = path.join(process.cwd(), "datasets", "raw", "fsl_105", "clips", "0", "0.MOV");
  const frameDir = path.join(TMP_DIR, "frames");

  console.log("Extracting frames...");
  const frameFiles = await extractFrames(videoPath, frameDir);
  console.log(`Got ${frameFiles.length} frames`);

  const testFrames = frameFiles.slice(30, 45); // middle of video

  const frameData = testFrames.map(f => {
    const buf = fs.readFileSync(path.join(frameDir, f));
    return "data:image/png;base64," + buf.toString("base64");
  });

  // Serve everything locally
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<script type="module">
import { HandLandmarker, FilesetResolver } from "/vision_bundle.mjs";

const FRAMES = ${JSON.stringify(frameData)};

async function main() {
  const vision = await FilesetResolver.forVisionTasks("/wasm/");
  const hlm = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
    },
    runningMode: "IMAGE",
    numHands: 2,
    minHandDetectionConfidence: 0.3,
  });

  const results = [];
  for (let i = 0; i < FRAMES.length; i++) {
    const img = new Image();
    img.src = FRAMES[i];
    await img.decode();
    const r = hlm.detect(img);
    results.push({
      landmarks: r.landmarks || [],
      handedness: r.handedness || []
    });
    document.title = "p:" + (i+1);
  }
  window.__results = results;
  document.title = "done";
}
main().catch(e => { document.title = "err:" + e.message; console.error(e); });
</script></body></html>`;

  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const ext = path.extname(url);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } else {
      // Serve from tasks-vision dir
      let filePath = path.join(TV_DIR, url.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        res.end(fs.readFileSync(filePath));
      } else {
        res.statusCode = 404;
        res.end("404: " + url);
      }
    }
  });

  await new Promise((r) => server.listen(PORT, r));
  console.log("Server on", PORT);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  page.on("console", (msg) => console.log("PAGE:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE THROW:", err.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0", timeout: 30000 });
  console.log("Loaded, waiting...");

  try {
    await page.waitForFunction(
      () => document.title.startsWith("done") || document.title.startsWith("err"),
      { timeout: 120000 }
    );
    console.log("Title:", await page.title());

    if (await page.title() === "done") {
      const results = await page.evaluate(() => window.__results);
      for (let i = 0; i < results.length; i++) {
        console.log(`Frame ${i}: ${results[i].landmarks.length} hands`);
        if (results[i].landmarks.length > 0) {
          console.log(`  LM[0]:`, JSON.stringify(results[i].landmarks[0][0]));
        }
      }
    }
  } catch (e) {
    console.log("Timeout. Title:", await page.title());
  }

  await browser.close();
  server.close();
  fs.rmSync(frameDir, { recursive: true });
  console.log("Done");
};

main().catch(console.error);
