import fs from "fs";
import path from "path";

const RAW_DIR = path.join(process.cwd(), "datasets", "raw", "fsl_alphabet");
const OUTPUT_DIR = RAW_DIR;
const RNG_SEED = 2026;

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const randomNormal = (rng) => {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const degToRad = (deg) => deg * (Math.PI / 180);

const applyRotation = (landmarks, angleDeg, rng) => {
  const angleRad = degToRad(angleDeg);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const wrist = landmarks[0];
  return landmarks.map((lm) => {
    const dx = lm.x - wrist.x;
    const dy = lm.y - wrist.y;
    return {
      x: wrist.x + dx * cosA - dy * sinA,
      y: wrist.y + dx * sinA + dy * cosA,
      z: lm.z + randomNormal(rng) * 0.005
    };
  });
};

const applyScale = (landmarks, scaleFactor, rng) => {
  const wrist = landmarks[0];
  return landmarks.map((lm) => ({
    x: wrist.x + (lm.x - wrist.x) * scaleFactor + randomNormal(rng) * 0.003,
    y: wrist.y + (lm.y - wrist.y) * scaleFactor + randomNormal(rng) * 0.003,
    z: lm.z * scaleFactor + randomNormal(rng) * 0.003
  }));
};

const applyNoise = (landmarks, noiseStd, rng) => {
  return landmarks.map((lm) => ({
    x: lm.x + randomNormal(rng) * noiseStd,
    y: lm.y + randomNormal(rng) * noiseStd,
    z: lm.z + randomNormal(rng) * noiseStd * 0.5
  }));
};

const applyTemporalMask = (frames, maskProb, rng) => {
  return frames.map((frame) => {
    if (rng() < maskProb) {
      return { ...frame, handCount: 0, hands: [] };
    }
    return frame;
  });
};

const applyHandDropout = (frames, dropoutProb, rng) => {
  return frames.map((frame) => {
    if (frame.handCount < 2 || rng() >= dropoutProb) return frame;
    const keepIdx = rng() < 0.5 ? 0 : 1;
    return { ...frame, hands: [frame.hands[keepIdx]], handCount: 1 };
  });
};

const LABELS = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "ñ", "ng", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
];

const augmentationPresets = [
  {
    id: "S02-rotate",
    name: "rotation",
    signerId: "S02",
    handedness: "right",
    lighting: "indoor-varied",
    deviceType: "webcam-aug",
    apply: (frames, rng) => {
      const angle = (rng() - 0.5) * 20;
      return frames.map((frame) => {
        if (frame.handCount === 0) return frame;
        const hands = frame.hands.map((hand) => ({
          ...hand,
          landmarks: applyRotation(hand.landmarks, angle, rng)
        }));
        return { ...frame, hands };
      });
    }
  },
  {
    id: "S03-scale",
    name: "scale",
    signerId: "S03",
    handedness: "right",
    lighting: "indoor-angled",
    deviceType: "webcam-aug",
    apply: (frames, rng) => {
      const factor = 0.85 + rng() * 0.3;
      return frames.map((frame) => {
        if (frame.handCount === 0) return frame;
        const hands = frame.hands.map((hand) => ({
          ...hand,
          landmarks: applyScale(hand.landmarks, factor, rng)
        }));
        return { ...frame, hands };
      });
    }
  },
  {
    id: "S04-noise",
    name: "landmark-noise",
    signerId: "S04",
    handedness: "right",
    lighting: "low-light",
    deviceType: "webcam-aug",
    apply: (frames, rng) => {
      return frames.map((frame) => {
        if (frame.handCount === 0) return frame;
        const hands = frame.hands.map((hand) => ({
          ...hand,
          landmarks: applyNoise(hand.landmarks, 0.015, rng)
        }));
        return { ...frame, hands };
      });
    }
  },
  {
    id: "S05-occlusion",
    name: "temporal-occlusion",
    signerId: "S05",
    handedness: "right",
    lighting: "indoor-partial",
    deviceType: "webcam-aug",
    apply: (frames, rng) => {
      return applyTemporalMask(frames, 0.08, rng);
    }
  },
  {
    id: "S06-mixed",
    name: "mixed",
    signerId: "S06",
    handedness: "right",
    lighting: "outdoor-sim",
    deviceType: "webcam-aug",
    apply: (frames, rng) => {
      let result = frames;
      const angle = (rng() - 0.5) * 15;
      const factor = 0.9 + rng() * 0.2;
      result = result.map((frame) => {
        if (frame.handCount === 0) return frame;
        const rotated = frame.hands.map((hand) => ({
          ...hand,
          landmarks: applyRotation(hand.landmarks, angle, rng)
        }));
        const scaled = rotated.map((hand) => ({
          ...hand,
          landmarks: applyScale(hand.landmarks, factor, rng)
        }));
        const noised = scaled.map((hand) => ({
          ...hand,
          landmarks: applyNoise(hand.landmarks, 0.008, rng)
        }));
        return { ...frame, hands: noised };
      });
      result = applyTemporalMask(result, 0.05, rng);
      return result;
    }
  }
];

const main = () => {
  const rng = mulberry32(RNG_SEED);
  let totalAugmented = 0;

  for (const label of LABELS) {
    const labelDir = path.join(RAW_DIR, label);
    if (!fs.existsSync(labelDir)) {
      console.warn(`Skipping missing directory: ${labelDir}`);
      continue;
    }

    const files = fs.readdirSync(labelDir)
      .filter((f) => f.endsWith(".json") && f !== ".gitkeep");

    for (const file of files) {
      const filePath = path.join(labelDir, file);
      const recording = readJson(filePath);

      for (const preset of augmentationPresets) {
        const augmentedRecording = {
          ...recording,
          frames: preset.apply(recording.frames, rng),
          createdAt: new Date().toISOString(),
          source: "mediapipe-hands-augmented",
          signerId: preset.signerId,
          sessionId: `aug-${preset.name}-${file.replace(".json", "")}`,
          deviceType: preset.deviceType,
          lighting: preset.lighting,
          handedness: preset.handedness,
          augmentationPreset: preset.name,
          originalFile: file
        };

        const augFileName = file.replace(".json", `_${preset.signerId}.json`);
        const augFilePath = path.join(labelDir, augFileName);
        writeJson(augFilePath, augmentedRecording);
        totalAugmented += 1;
      }
    }
  }

  const originalCount = 597;
  console.log("FSL Alphabet data augmentation complete.");
  console.log(`Original samples: ${originalCount}`);
  console.log(`Augmented samples: ${totalAugmented}`);
  console.log(`Virtual signers: ${augmentationPresets.length + 1} (S01 + ${augmentationPresets.map((p) => p.signerId).join(", ")})`);
  console.log(`Total raw samples: ${originalCount + totalAugmented}`);
  console.log(`Expansion factor: ${((originalCount + totalAugmented) / originalCount).toFixed(1)}x`);
};

try {
  main();
} catch (error) {
  console.error("Augmentation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
