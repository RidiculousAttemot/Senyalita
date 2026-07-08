import type { LandmarkPoint, HandLandmarks, AnimationFrame, InterpolationMethod } from "../types";

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function cubicInterpolate(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (-0.5 * a + 1.5 * b - 1.5 * c + 0.5 * d) * t3 +
    (a - 2.5 * b + 2 * c - 0.5 * d) * t2 +
    (-0.5 * a + 0.5 * c) * t +
    b
  );
}

export function catmullRom(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  );
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpLandmark(a: LandmarkPoint, b: LandmarkPoint, t: number): LandmarkPoint {
  const s = smoothstep(t);
  return {
    x: lerp(a.x, b.x, s),
    y: lerp(a.y, b.y, s),
    z: lerp(a.z, b.z, s),
  };
}

export function interpolateLandmark(
  before: LandmarkPoint,
  a: LandmarkPoint,
  b: LandmarkPoint,
  after: LandmarkPoint,
  t: number,
  method: InterpolationMethod = "catmull-rom",
): LandmarkPoint {
  if (method === "linear") {
    return lerpLandmark(a, b, t);
  }
  if (method === "cubic") {
    return {
      x: cubicInterpolate(before.x, a.x, b.x, after.x, t),
      y: cubicInterpolate(before.y, a.y, b.y, after.y, t),
      z: cubicInterpolate(before.z, a.z, b.z, after.z, t),
    };
  }
  if (method === "catmull-rom") {
    return {
      x: catmullRom(before.x, a.x, b.x, after.x, t),
      y: catmullRom(before.y, a.y, b.y, after.y, t),
      z: catmullRom(before.z, a.z, b.z, after.z, t),
    };
  }
  return lerpLandmark(a, b, t);
}

export function interpolateHandsSmooth(
  frames: AnimationFrame[],
  time: number,
  method: InterpolationMethod = "catmull-rom",
): HandLandmarks[] {
  const totalFrames = frames.length;
  if (totalFrames === 0) return [];
  if (totalFrames === 1) return frames[0].landmarks;

  const duration = frames[totalFrames - 1].timestamp;
  const progress = Math.max(0, Math.min(1, time / duration));
  const floatIndex = progress * (totalFrames - 1);
  const indexA = Math.floor(floatIndex);
  const indexB = Math.min(indexA + 1, totalFrames - 1);
  const localT = floatIndex - indexA;

  const indexBefore = Math.max(0, indexA - 1);
  const indexAfter = Math.min(totalFrames - 1, indexB + 1);

  const frameBefore = frames[indexBefore];
  const frameA = frames[indexA];
  const frameB = frames[indexB];
  const frameAfter = frames[indexAfter];

  const maxHands = Math.max(frameA.landmarks.length, frameB.landmarks.length);
  const result: HandLandmarks[] = [];

  for (let h = 0; h < maxHands; h++) {
    const getHand = (frame: AnimationFrame, handIdx: number): LandmarkPoint[] => {
      return handIdx < frame.landmarks.length
        ? frame.landmarks[handIdx].landmarks
        : [];
    };

    const lmsBefore = getHand(frameBefore, h);
    const lmsA = getHand(frameA, h);
    const lmsB = getHand(frameB, h);
    const lmsAfter = getHand(frameAfter, h);

    const maxLm = Math.max(lmsA.length, lmsB.length);
    const blended: LandmarkPoint[] = [];

    for (let i = 0; i < maxLm; i++) {
      const zero = { x: 0, y: 0, z: 0 };
      const lmBefore = i < lmsBefore.length ? lmsBefore[i] : zero;
      const lm0 = i < lmsA.length ? lmsA[i] : zero;
      const lm1 = i < lmsB.length ? lmsB[i] : zero;
      const lmAfter = i < lmsAfter.length ? lmsAfter[i] : zero;

      blended.push(interpolateLandmark(lmBefore, lm0, lm1, lmAfter, localT, method));
    }
    result.push({ landmarks: blended });
  }

  return result;
}

export function velocitySmooth(
  current: number,
  previous: number,
  velocity: number,
  damping: number,
  dt: number,
): { value: number; velocity: number } {
  const error = current - previous;
  const accel = error * damping - velocity * 2;
  const newVelocity = velocity + accel * dt;
  const newValue = previous + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}

export function dampenMotion(
  value: number,
  target: number,
  damping: number,
  dt: number,
): number {
  return lerp(value, target, 1 - Math.exp(-damping * dt));
}

export function removeJitter(
  values: number[],
  threshold: number,
): number[] {
  if (values.length < 2) return values;
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const delta = Math.abs(values[i] - result[i - 1]);
    if (delta > threshold) {
      result.push(result[i - 1] + Math.sign(values[i] - result[i - 1]) * threshold);
    } else {
      result.push(values[i]);
    }
  }
  return result;
}

export function applyMotionDamping(
  landmarks: LandmarkPoint[],
  prevLandmarks: LandmarkPoint[],
  damping: number,
  dt: number,
): LandmarkPoint[] {
  return landmarks.map((lm, i) => {
    if (i < prevLandmarks.length) {
      return {
        x: dampenMotion(lm.x, prevLandmarks[i].x, damping, dt),
        y: dampenMotion(lm.y, prevLandmarks[i].y, damping, dt),
        z: dampenMotion(lm.z, prevLandmarks[i].z, damping, dt),
      };
    }
    return lm;
  });
}
