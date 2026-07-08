import type { HandLandmarks, LandmarkPoint } from "../types";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpLandmark(
  a: LandmarkPoint,
  b: LandmarkPoint,
  t: number,
): LandmarkPoint {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function interpolateHands(
  from: HandLandmarks[],
  to: HandLandmarks[],
  t: number,
): HandLandmarks[] {
  const maxHands = Math.max(from.length, to.length);
  const result: HandLandmarks[] = [];
  for (let h = 0; h < maxHands; h++) {
    const a = h < from.length ? from[h].landmarks : to[h]?.landmarks ?? [];
    const b = h < to.length ? to[h].landmarks : from[h]?.landmarks ?? [];
    const maxLm = Math.max(a.length, b.length);
    const blended: LandmarkPoint[] = [];
    for (let i = 0; i < maxLm; i++) {
      const la = i < a.length ? a[i] : { x: 0, y: 0, z: 0 };
      const lb = i < b.length ? b[i] : { x: 0, y: 0, z: 0 };
      blended.push(lerpLandmark(la, lb, t));
    }
    result.push({ landmarks: blended });
  }
  return result;
}
