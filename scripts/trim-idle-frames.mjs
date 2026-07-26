#!/usr/bin/env node
/**
 * Trims the lead-in and trail-off from extracted holistic assets so a clip
 * starts on the sign itself rather than on the signer getting ready.
 *
 * Idle detection is velocity based: per frame we measure how far the signing
 * landmarks (both hands, plus wrists and elbows) travelled since the previous
 * frame. Preparation and relaxation register as near-zero motion; the sign
 * itself is an obvious plateau above it.
 *
 * Works from the already-extracted landmarks, so it never re-runs MediaPipe.
 * Writes a `trim` record and skips assets that already carry one, so it is
 * safe to re-run.
 *
 * Usage:
 *   node scripts/trim-idle-frames.mjs --dry      # report only
 *   node scripts/trim-idle-frames.mjs            # apply
 *   node scripts/trim-idle-frames.mjs --force    # re-trim already-trimmed
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, "datasets", "processed", "user_holistic_assets");
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

/** Wrists and elbows — the pose joints that actually move while signing. */
const ARM_POSE_INDICES = [13, 14, 15, 16];
const SMOOTH_WINDOW = 5;
/** Fraction of the clip's own peak motion that still counts as signing. */
const RELATIVE_THRESHOLD = 0.12;
/** Absolute floor in normalised units, guards against an all-idle clip. */
const ABSOLUTE_FLOOR = 0.0015;
/** Frames of lead-in/out kept so the sign does not start mid-gesture. */
const PAD_FRAMES = 4;
const MIN_KEPT_FRAMES = 12;
/** Tracking dropouts up to this long are treated as part of the sign. */
const GAP_TOLERANCE = 6;

function meanDisplacement(prev, curr) {
  if (!prev || !curr) return 0;
  const n = Math.min(prev.length, curr.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = prev[i];
    const b = curr[i];
    if (!a || !b) continue;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum / n;
}

function handBySide(frame, side) {
  return frame.landmarks?.find((h) => h.side === side)?.landmarks ?? null;
}

function armPoints(frame) {
  const pose = frame.poseLandmarks;
  if (!pose) return null;
  return ARM_POSE_INDICES.map((i) => pose[i]).filter(Boolean);
}

function motionSeries(frames) {
  const raw = [0];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    // Hands dominate: a sign is defined by handshape and hand travel.
    const left = meanDisplacement(handBySide(prev, "left"), handBySide(curr, "left"));
    const right = meanDisplacement(handBySide(prev, "right"), handBySide(curr, "right"));
    const arms = meanDisplacement(armPoints(prev), armPoints(curr));
    raw.push(left * 2 + right * 2 + arms);
  }

  const smoothed = new Array(raw.length).fill(0);
  const half = Math.floor(SMOOTH_WINDOW / 2);
  for (let i = 0; i < raw.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(raw.length - 1, i + half); j++) {
      sum += raw[j];
      count++;
    }
    smoothed[i] = sum / count;
  }
  return smoothed;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

/**
 * A frame counts as signing when a hand is actually tracked and held up in
 * signing space. Hand presence is the decisive signal: while the signer is
 * preparing or relaxing, the hands drop and MediaPipe stops returning them.
 * Velocity alone cannot separate those phases, because raising the arms to
 * begin is itself fast movement.
 */
function activeFrames(frames) {
  return frames.map((frame) => {
    const hands = (frame.landmarks ?? []).filter((h) => h.landmarks?.length >= 21);
    if (hands.length === 0) return false;
    const pose = frame.poseLandmarks;
    const hipY = pose?.[23] && pose?.[24] ? (pose[23].y + pose[24].y) / 2 : null;
    if (hipY === null) return true;
    // y grows downward, so "above the hips" is a smaller value.
    return hands.some((h) => h.landmarks[0].y < hipY);
  });
}

/** Bridges brief tracking dropouts so one lost frame does not split a sign. */
function fillGaps(active, maxGap) {
  const out = [...active];
  let i = 0;
  while (i < out.length) {
    if (out[i]) { i++; continue; }
    let j = i;
    while (j < out.length && !out[j]) j++;
    const gap = j - i;
    if (i > 0 && j < out.length && gap <= maxGap) {
      for (let k = i; k < j; k++) out[k] = true;
    }
    i = j;
  }
  return out;
}

function longestRun(active) {
  let best = null;
  let runStart = -1;
  for (let i = 0; i <= active.length; i++) {
    if (i < active.length && active[i]) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (!best || len > best.end - best.start + 1) best = { start: runStart, end: i - 1 };
      runStart = -1;
    }
  }
  return best;
}

function findSignRange(frames) {
  const run = longestRun(fillGaps(activeFrames(frames), GAP_TOLERANCE));
  if (!run) return null;

  // Within the tracked run, drop a static hold at the head: the hand is up but
  // not yet moving.
  const motion = motionSeries(frames);
  const window = motion.slice(run.start, run.end + 1);
  const threshold = Math.max(percentile(window, 0.9) * RELATIVE_THRESHOLD, ABSOLUTE_FLOOR);

  let start = run.start;
  while (start < run.end && motion[start] < threshold) start++;
  let end = run.end;
  while (end > start && motion[end] < threshold) end--;

  start = Math.max(0, start - PAD_FRAMES);
  end = Math.min(frames.length - 1, end + PAD_FRAMES);

  if (end - start + 1 < MIN_KEPT_FRAMES) return null;
  return { start, end, threshold };
}

function main() {
  const labels = fs.readdirSync(ASSET_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  let trimmed = 0;
  let alreadyTrimmed = 0;
  let unchanged = 0;
  let skipped = 0;
  let framesBefore = 0;
  let framesAfter = 0;

  for (const label of labels) {
    const labelDir = path.join(ASSET_ROOT, label);
    for (const file of fs.readdirSync(labelDir).filter((f) => f.endsWith("_asset.json"))) {
      const assetPath = path.join(labelDir, file);
      let asset;
      try {
        asset = JSON.parse(fs.readFileSync(assetPath, "utf-8"));
      } catch {
        skipped++;
        continue;
      }

      if (asset.trim && !FORCE) { alreadyTrimmed++; continue; }
      const frames = asset.frames ?? [];
      if (frames.length < MIN_KEPT_FRAMES) { skipped++; continue; }

      const range = findSignRange(frames);
      if (!range) { skipped++; continue; }
      if (range.start === 0 && range.end === frames.length - 1) {
        unchanged++;
        continue;
      }

      const fps = asset.fps || 30;
      const kept = frames.slice(range.start, range.end + 1);
      const offsetSeconds = range.start / fps;

      framesBefore += frames.length;
      framesAfter += kept.length;

      console.log(
        `  ${label}/${file}: ${frames.length} -> ${kept.length} frames ` +
        `(cut ${range.start} lead, ${frames.length - 1 - range.end} tail)`,
      );

      if (DRY) { trimmed++; continue; }

      // Timestamps are rebased so the trimmed clip starts at zero; the offset
      // into the original recording is kept for video playback alignment.
      asset.frames = kept.map((f, i) => ({ ...f, timestamp: Math.round(i * (1000 / fps)) }));
      asset.totalFrames = kept.length;
      asset.duration = Math.round(((kept.length - 1) / fps) * 1000);
      asset.sourceOffsetSeconds = offsetSeconds;
      asset.trim = {
        originalTotalFrames: frames.length,
        startFrame: range.start,
        endFrame: range.end,
        method: "landmark-velocity",
      };
      if (asset.metadata) asset.metadata.sequenceLength = kept.length;

      fs.writeFileSync(assetPath, JSON.stringify(asset));
      trimmed++;
    }
  }

  const pct = framesBefore > 0 ? (100 * (1 - framesAfter / framesBefore)).toFixed(1) : "0";
  console.log(`\n${DRY ? "[dry run] would trim" : "trimmed"}: ${trimmed}`);
  console.log(`already trimmed: ${alreadyTrimmed}, no idle found: ${unchanged}, skipped: ${skipped}`);
  console.log(`frames ${framesBefore} -> ${framesAfter} (${pct}% removed)`);
}

main();
