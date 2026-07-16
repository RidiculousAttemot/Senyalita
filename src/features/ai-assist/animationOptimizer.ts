import type { GestureAnimationAsset, AnimationFrame, LandmarkPoint } from "@/features/sign-animation/types";

export interface OptimizationResult {
  original: GestureAnimationAsset;
  optimized: GestureAnimationAsset;
  changes: {
    framesRemoved: number;
    framesInterpolated: number;
    framesSmoothed: number;
    trimmedStart: number;
    trimmedEnd: number;
    normalized: boolean;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothFrame(
  frames: AnimationFrame[],
  index: number,
  windowSize: number,
): AnimationFrame {
  if (index === 0 || index === frames.length - 1) return frames[index];

  const frame = frames[index];
  const smoothed = JSON.parse(JSON.stringify(frame)) as AnimationFrame;

  for (let h = 0; h < frame.landmarks.length; h++) {
    const lms = frame.landmarks[h].landmarks;
    for (let j = 0; j < lms.length; j++) {
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      let count = 0;
      const start = Math.max(0, index - windowSize);
      const end = Math.min(frames.length - 1, index + windowSize);

      for (let k = start; k <= end; k++) {
        if (k < frames.length && j < (frames[k].landmarks[h]?.landmarks?.length ?? 0)) {
          sumX += frames[k].landmarks[h].landmarks[j].x;
          sumY += frames[k].landmarks[h].landmarks[j].y;
          sumZ += frames[k].landmarks[h].landmarks[j].z;
          count++;
        }
      }

      if (count > 0) {
        smoothed.landmarks[h].landmarks[j] = {
          x: sumX / count,
          y: sumY / count,
          z: sumZ / count,
        };
      }
    }
  }

  if (frame.poseLandmarks) {
    smoothed.poseLandmarks = [...frame.poseLandmarks];
  }
  if (frame.faceLandmarks) {
    smoothed.faceLandmarks = [...frame.faceLandmarks];
  }

  return smoothed;
}

function interpolateMissingFrames(frames: AnimationFrame[]): AnimationFrame[] {
  const result: AnimationFrame[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const hasLandmarks = frame.landmarks.length > 0;

    if (!hasLandmarks && i > 0 && i < frames.length - 1) {
      const prev = frames[i - 1];
      const next = frames[i + 1];
      if (prev.landmarks.length > 0 && next.landmarks.length > 0) {
        const interpolated: AnimationFrame = {
          timestamp: frame.timestamp,
          landmarks: prev.landmarks.map((ph, hi) => {
            const nl = next.landmarks[hi]?.landmarks ?? [];
            return {
              landmarks: ph.landmarks.map((pl, li) => ({
                x: lerp(pl.x, nl[li]?.x ?? pl.x, 0.5),
                y: lerp(pl.y, nl[li]?.y ?? pl.y, 0.5),
                z: lerp(pl.z, nl[li]?.z ?? pl.z, 0.5),
              })),
              side: ph.side,
            };
          }),
          poseLandmarks: prev.poseLandmarks?.map((pp, pi) => {
            const np = next.poseLandmarks?.[pi];
            return np
              ? { x: lerp(pp.x, np.x, 0.5), y: lerp(pp.y, np.y, 0.5), z: lerp(pp.z, np.z, 0.5) }
              : { ...pp };
          }),
          faceLandmarks: prev.faceLandmarks?.map((fp, fi) => {
            const nf = next.faceLandmarks?.[fi];
            return nf
              ? { x: lerp(fp.x, nf.x, 0.5), y: lerp(fp.y, nf.y, 0.5), z: lerp(fp.z, nf.z, 0.5) }
              : { ...fp };
          }),
        };
        result.push(interpolated);
        continue;
      }
    }
    result.push(frame);
  }
  return result;
}

function detectIdleFrames(frames: AnimationFrame[], threshold = 0.0005): Set<number> {
  const idleIndices = new Set<number>();
  for (let i = 1; i < frames.length - 1; i++) {
    let totalDist = 0;
    let count = 0;
    for (let h = 0; h < Math.min(frames[i - 1].landmarks.length, frames[i + 1].landmarks.length); h++) {
      const a = frames[i - 1].landmarks[h]?.landmarks?.[0];
      const b = frames[i + 1].landmarks[h]?.landmarks?.[0];
      if (a && b) {
        totalDist += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
        count++;
      }
    }
    if (count > 0 && totalDist / count < threshold) {
      idleIndices.add(i);
    }
  }
  return idleIndices;
}

export function optimizeAnimation(asset: GestureAnimationAsset): OptimizationResult {
  const original = JSON.parse(JSON.stringify(asset)) as GestureAnimationAsset;
  let frames = [...asset.frames];

  const interpolated = interpolateMissingFrames(frames);
  const interpolatedCount = interpolated.length - frames.length;

  const smoothed = interpolated.map((frame, i) => smoothFrame(interpolated, i, 1));
  const smoothedCount = smoothed.length;

  const idleIndices = detectIdleFrames(smoothed);
  const idleFrameCount = idleIndices.size;
  const nonIdle = smoothed.filter((_, i) => !idleIndices.has(i));
  const removedCount = smoothed.length - nonIdle.length;

  const finalFrames = nonIdle.length > 5 ? nonIdle : smoothed;

  const avgX = finalFrames.reduce((sum, f) => {
    for (const h of f.landmarks) {
      for (const lm of h.landmarks) sum += lm.x;
    }
    return sum;
  }, 0) / Math.max(1, finalFrames.length * 42);

  const avgY = finalFrames.reduce((sum, f) => {
    for (const h of f.landmarks) {
      for (const lm of h.landmarks) sum += lm.y;
    }
    return sum;
  }, 0) / Math.max(1, finalFrames.length * 42);

  const normalized = finalFrames.map((frame) => {
    const f = JSON.parse(JSON.stringify(frame)) as AnimationFrame;
    for (const hand of f.landmarks) {
      for (const lm of hand.landmarks) {
        lm.x -= avgX;
        lm.y -= avgY;
      }
    }
    return f;
  });

  const lastTimestamp = normalized[normalized.length - 1]?.timestamp ?? 0;
  const firstTimestamp = normalized[0]?.timestamp ?? 0;

  const optimized: GestureAnimationAsset = {
    ...asset,
    frames: normalized,
    totalFrames: normalized.length,
    duration: lastTimestamp - firstTimestamp,
  };

  return {
    original,
    optimized,
    changes: {
      framesRemoved: removedCount,
      framesInterpolated: interpolatedCount,
      framesSmoothed: smoothedCount,
      trimmedStart: 0,
      trimmedEnd: 0,
      normalized: true,
    },
  };
}
