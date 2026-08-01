#!/usr/bin/env node
/**
 * Builds Y4M fixtures for Chromium's fake camera
 * (--use-file-for-fake-video-capture), so e2e tests can drive the real capture
 * loop without a physical camera.
 *
 * Y4M is uncompressed — a 3s 640x480 clip is ~40MB — so these are generated
 * into e2e/fixtures/ and gitignored rather than committed.
 *
 *   npm run e2e:fixtures
 *
 * Sources are real capture footage already in the repo:
 *   THANK YOU -> datasets/raw/fsl_105/clips/7   (labels.csv id 7)
 *   letter b  -> datasets/raw/user_videos/b
 *
 * Chromium loops the file, which is a feature here: a sign occupying only part
 * of the clip gets replayed until the recognition buffer has a full span.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

const OUT_DIR = path.join(process.cwd(), "e2e", "fixtures");

const WIDTH = 640;
const HEIGHT = 480;
/** Matches CAPTURE_TARGET_FPS — the rate training clips were extracted at. */
const FPS = 30;
const SECONDS = 3;

const firstFileIn = (dir, extensions) => {
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((f) => extensions.some((e) => f.toLowerCase().endsWith(e)))
    .map((f) => path.join(dir, f))
    .filter((f) => statSync(f).isFile())
    .sort()[0] ?? null;
};

const targets = [
  {
    name: "letter-b.y4m",
    source: firstFileIn(path.join("datasets", "raw", "user_videos", "b"), [".mp4", ".mov"]),
    describe: "letter b (user_videos/b)",
  },
  {
    name: "thank-you.y4m",
    source: firstFileIn(path.join("datasets", "raw", "fsl_105", "clips", "7"), [".mov", ".mp4"]),
    describe: "THANK YOU (fsl_105 label id 7)",
  },
];

mkdirSync(OUT_DIR, { recursive: true });

let built = 0;
for (const { name, source, describe } of targets) {
  const out = path.join(OUT_DIR, name);
  if (!source) {
    console.error(`SKIP  ${name} — no source found for ${describe}`);
    continue;
  }
  console.log(`build ${name}  <- ${describe}`);
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-i", source,
      "-t", String(SECONDS),
      "-vf", `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS}`,
      "-pix_fmt", "yuv420p",
      "-an",
      out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  console.log(`      ${(statSync(out).size / 1e6).toFixed(1)}MB`);
  built += 1;
}

if (built === 0) {
  console.error("No fixtures built — the camera e2e tests will skip.");
  process.exit(1);
}
console.log(`\n${built} fixture(s) in ${OUT_DIR}`);
