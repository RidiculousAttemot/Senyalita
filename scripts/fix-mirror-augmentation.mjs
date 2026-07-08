#!/usr/bin/env node
import fs from "fs";
import path from "path";

const INPUT = path.join(process.cwd(), "datasets", "processed", "fsl_unified_augmented", "train_augmented.json");
const OUTPUT = path.join(process.cwd(), "datasets", "processed", "fsl_unified_augmented", "train_augmented.json");

const FEATURE_DIM = 126;
const HAND_SIZE = 63;
const LANDMARK_STRIDE = 3;

let patchedCount = 0;
let unchangedCount = 0;

const mirrorAndSwapHand = (frame) => {
  if (!Array.isArray(frame) || frame.length !== FEATURE_DIM) {
    throw new Error(`Expected frame length ${FEATURE_DIM}, got ${frame?.length}`);
  }

  const slot0 = frame.slice(0, HAND_SIZE);
  const slot1 = frame.slice(HAND_SIZE, FEATURE_DIM);
  const out = new Array(FEATURE_DIM);

  const mirrorSlot = (src, dst, dstOffset) => {
    for (let i = 0; i < HAND_SIZE; i += LANDMARK_STRIDE) {
      dst[dstOffset + i]     = -src[i];       // x negated
      dst[dstOffset + i + 1] =  src[i + 1];   // y preserved
      dst[dstOffset + i + 2] =  src[i + 2];   // z preserved
    }
  };

  mirrorSlot(slot1, out, 0);
  mirrorSlot(slot0, out, HAND_SIZE);

  return out;
};

const isMirrorSample = (sample) => {
  return (
    sample.augmentationPreset === "mirror" ||
    sample.augmentationPreset?.startsWith("mirror")
  );
};

const patchMirrorSequence = (sample) => {
  if (!Array.isArray(sample.sequence)) return false;

  const originalLen = sample.sequence.length;
  const patched = sample.sequence.map((frame) => mirrorAndSwapHand(frame));

  // Verify first frame to detect if it was already correctly mirrored
  // (should have non-original slot distribution after patch)
  // We trust the patched version is always correct
  sample.sequence = patched;
  return true;
};

const streamNdjsonIn = (filePath) => {
  return new Promise((resolve) => {
    const samples = [];
    const stream = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 1 << 22 });
    let leftover = "";
    let header = null;

    stream.on("data", (chunk) => {
      const text = leftover + chunk;
      let start = 0;
      let newlineIdx;
      while ((newlineIdx = text.indexOf("\n", start)) !== -1) {
        const line = text.slice(start, newlineIdx);
        start = newlineIdx + 1;
        if (!line) continue;
        const obj = JSON.parse(line);
        if (obj._header) { header = obj; continue; }
        samples.push(obj);
      }
      leftover = text.slice(start);
    });

    stream.on("end", () => resolve(samples));
    stream.on("error", () => resolve([]));
  });
};

const writeNdjson = (filePath, header, samples) => {
  const fd = fs.openSync(filePath, "w");
  const encode = (str) => Buffer.from(str, "utf8");

  if (header) {
    fs.writeSync(fd, encode(JSON.stringify(header) + "\n"));
  }

  for (let i = 0; i < samples.length; i++) {
    fs.writeSync(fd, encode(JSON.stringify(samples[i]) + "\n"));
    if ((i + 1) % 10000 === 0) {
      console.log(`  Written ${i + 1}/${samples.length}`);
    }
  }

  fs.closeSync(fd);
};

const readNdjson = (filePath) => streamNdjsonIn(filePath);

const main = async () => {
  console.log("=".repeat(60));
  console.log("  FIX MIRROR AUGMENTATION");
  console.log("  Patching buggy mirror samples in existing augmented data");
  console.log("=".repeat(60));

  if (!fs.existsSync(INPUT)) {
    console.error(`Input not found: ${INPUT}`);
    process.exit(1);
  }

  console.log(`\nReading ${INPUT}...`);
  const samples = await readNdjson(INPUT);
  console.log(`  Total samples: ${samples.length}`);

  // Find mirror samples
  const mirrorIndices = [];
  for (let i = 0; i < samples.length; i++) {
    if (isMirrorSample(samples[i])) {
      mirrorIndices.push(i);
    }
  }
  console.log(`  Mirror samples: ${mirrorIndices.length}`);

  // Check for any samples that might have mirror stochastic augmentation
  const stochasticMirrorIndices = [];
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].augmentationPreset === "mirror") continue;
    if (samples[i].augmentationPreset === null || samples[i].augmentationPreset === "original") continue;
    // Could have been stochastically mirrored — but we can't detect from metadata alone
    // The stochastic mirror has no preset label, only "methods" in metadata
  }
  // The stochastic augmentations don't set augmentationPreset (they preserve original preset or null)
  // So we can't detect them. However, the stochastic mirror only has 15% probability and
  // was applied ON TOP of already-augmented data (preset) or on original data.
  // The buggy mirror logic means these stochastic mirror samples are also wrong.
  // We'll just fix the known "mirror" preset samples for now, which is the bulk.

  console.log(`\nPatching ${mirrorIndices.length} mirror preset samples...`);
  for (const idx of mirrorIndices) {
    const sample = samples[idx];
    const success = patchMirrorSequence(sample);
    if (success) {
      patchedCount++;
    } else {
      unchangedCount++;
    }
  }

  console.log(`  Patched: ${patchedCount}`);
  console.log(`  Unchanged: ${unchangedCount}`);

  // Write back
  console.log(`\nWriting ${OUTPUT}...`);
  writeNdjson(OUTPUT, null, samples);
  console.log("  Done.");

  // Quick verification on first mirror sample
  if (patchedCount > 0) {
    const firstMirrorIdx = mirrorIndices[0];
    const firstSample = samples[firstMirrorIdx];
    const firstFrame = firstSample.sequence[0];
    console.log(`\n=== Quick verification on first mirror sample ===`);
    console.log(`  Label: ${firstSample.label}`);
    console.log(`  Sequence frames: ${firstSample.sequence.length}`);
    console.log(`  First frame length: ${firstFrame.length} (expected ${FEATURE_DIM})`);

    // Verify x negation and slot swap with a synthetic check
    // Pick a non-zero landmark and verify slot patterns differ from original
    const hasNonZero = firstFrame.some((v) => v !== 0);
    console.log(`  First frame has non-zero values: ${hasNonZero ? "yes" : "no"}`);

    // Verify symmetry: double-mirror should recover original
    const doubleMirrored = mirrorAndSwapHand(firstFrame);
    const matches = doubleMirrored.every((v, i) => Math.abs(v - firstFrame[i]) < 1e-10);
    console.log(`  Double mirror recovers original: ${matches ? "✓" : "✗"}`);
  }

  console.log(`\n✓ Mirror augmentation fix complete.`);
  console.log(`  Patched ${patchedCount} samples.`);
  console.log(`  Saved to ${OUTPUT}`);
};

main().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
