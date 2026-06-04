export type LandmarkPoint = { x: number; y: number; z: number };

const FRAME_DIMENSION = 126;
const LANDMARKS_PER_HAND = 21;

export const normalizeLandmarks = (
  leftHand: LandmarkPoint[] | null,
  rightHand: LandmarkPoint[] | null
): Float32Array => {
  const features = new Float32Array(FRAME_DIMENSION);
  let offset = 0;

  for (const hand of [leftHand, rightHand]) {
    if (!hand || hand.length !== LANDMARKS_PER_HAND) {
      offset += LANDMARKS_PER_HAND * 3;
      continue;
    }

    const wrist = hand[0];
    const centered: Array<{ x: number; y: number; z: number }> = [];

    let maxAbs = 0;
    for (let i = 0; i < LANDMARKS_PER_HAND; i += 1) {
      const px = hand[i].x - wrist.x;
      const py = hand[i].y - wrist.y;
      const pz = hand[i].z - wrist.z;
      centered.push({ x: px, y: py, z: pz });
      maxAbs = Math.max(maxAbs, Math.abs(px), Math.abs(py), Math.abs(pz));
    }

    if (maxAbs > 0) {
      for (let i = 0; i < LANDMARKS_PER_HAND; i += 1) {
        features[offset + i * 3] = centered[i].x / maxAbs;
        features[offset + i * 3 + 1] = centered[i].y / maxAbs;
        features[offset + i * 3 + 2] = centered[i].z / maxAbs;
      }
    }

    offset += LANDMARKS_PER_HAND * 3;
  }

  return features;
};
