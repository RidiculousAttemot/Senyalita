#!/usr/bin/env node
/**
 * Builds Y4M fixtures for Chromium's fake camera
 * (--use-file-for-fake-video-capture), so e2e tests can drive the real capture
 * loop without a physical camera.
 *
 * Y4M is uncompressed — a 3s 640x480 clip is ~40MB — so these are generated
 * rather than committed.
 *
 * They live in tmp/, not e2e/, deliberately. src/lib/__tests__/ignoredSource.test.ts
 * asserts that nothing under e2e/ is git-ignored — a guard added after an
 * unanchored ignore rule hid a directory of admin pages from every clone — and
 * it says in as many words not to add exceptions to it. Generated 40MB binaries
 * are not source, so they belong in the scratch tree that is already ignored.
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

const OUT_DIR = path.join(process.cwd(), "tmp", "camera-fixtures");

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
  {
    /**
     * Two different letters back to back, for the transition the single-letter
     * fixture cannot reach: commit one sign, then recognise a different one.
     *
     * That path is where recognition actually failed. Committing clears the
     * sequence buffer, and reading the trained indices out of a part-filled
     * window used to leave most of them zero — 19.2% accuracy against 88.5%
     * (partialWindow.test.ts), for the four seconds it took the window to
     * refill. A fixture holding one letter can never show it.
     *
     * Chromium loops the file, so the second letter always follows the first
     * with no gap.
     *
     * The pair is chosen for stability of classification, not for the letters
     * themselves. These are raw phone recordings, not processed dataset
     * samples: the "a" clip tried first reads as e/f/c and never holds one
     * label long enough to commit, which makes the test look like a pipeline
     * failure. The model itself is fine on canonical "a" — it misreads only
     * f, k and u on the v4 test split (partialWindow.test.ts).
     */
    name: "letter-pair.y4m",
    fit: "pad",
    sources: [
      firstFileIn(path.join("datasets", "raw", "user_videos", "b"), [".mp4", ".mov"]),
      firstFileIn(path.join("datasets", "raw", "user_videos", "l"), [".mp4", ".mov"]),
    ],
    describe: "letter b then letter l (user_videos/b + /l)",
  },
];

mkdirSync(OUT_DIR, { recursive: true });

/**
 * Two ways to reach 640x480, and the difference is not cosmetic.
 *
 * "crop" fills the frame by scaling up and cutting the overflow away. The
 * capture footage is portrait, so a landscape crop of it discards the top and
 * bottom — including, for some signs, part of the hand. A letter whose
 * distinguishing feature is the thumb can arrive looking like a different
 * letter, and the test then reports a model error that is really a fixture
 * error.
 *
 * "pad" scales the whole frame down to fit and letterboxes the remainder, so
 * nothing is discarded.
 */
const fitFilter = (fit) => (fit === "pad"
  ? `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,`
    + `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,fps=${FPS}`
  : `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,`
    + `crop=${WIDTH}:${HEIGHT},fps=${FPS}`);

let built = 0;
for (const { name, source, sources, describe, fit } of targets) {
  const out = path.join(OUT_DIR, name);
  const inputs = sources ?? [source];
  if (inputs.some((s) => !s)) {
    console.error(`SKIP  ${name} — no source found for ${describe}`);
    continue;
  }
  console.log(`build ${name}  <- ${describe}`);

  // One input is a straight transcode; several are trimmed to the same
  // geometry first and then concatenated, which is the only way the filter
  // graph will accept clips that differ in size or frame rate.
  const args = ["-y"];
  for (const input of inputs) args.push("-i", input);
  if (inputs.length === 1) {
    args.push("-t", String(SECONDS), "-vf", fitFilter(fit));
  } else {
    const chain = inputs
      .map((_, i) => `[${i}:v]trim=duration=${SECONDS},setpts=PTS-STARTPTS,${fitFilter(fit)}[v${i}]`)
      .join(";");
    const joined = inputs.map((_, i) => `[v${i}]`).join("");
    args.push(
      "-filter_complex",
      `${chain};${joined}concat=n=${inputs.length}:v=1:a=0[out]`,
      "-map", "[out]",
    );
  }
  args.push("-pix_fmt", "yuv420p", "-an", out);

  execFileSync(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
  console.log(`      ${(statSync(out).size / 1e6).toFixed(1)}MB`);
  built += 1;
}

if (built === 0) {
  console.error("No fixtures built — the camera e2e tests will skip.");
  process.exit(1);
}
console.log(`\n${built} fixture(s) in ${OUT_DIR}`);
