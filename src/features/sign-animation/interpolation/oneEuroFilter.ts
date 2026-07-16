import type { AnimationFrame, LandmarkPoint } from "../types";

export interface OneEuroConfig {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

const DEFAULT_CONFIG: OneEuroConfig = {
  minCutoff: 1.0,
  beta: 0.007,
  dCutoff: 1.0,
};

class LowPassFilter {
  private prevValue: number | null = null;
  private prevRaw: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.prevValue === null) {
      this.prevValue = value;
      this.prevRaw = value;
      return value;
    }
    this.prevRaw = value;
    this.prevValue = this.prevValue + alpha * (value - this.prevValue);
    return this.prevValue;
  }

  reset(): void {
    this.prevValue = null;
    this.prevRaw = null;
  }
}

function smoothingFactor(cutoff: number, dt: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

export class OneEuroFilter {
  private x = new LowPassFilter();
  private dx = new LowPassFilter();
  private config: OneEuroConfig;
  private lastTime: number | null = null;

  constructor(config?: Partial<OneEuroConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  filter(value: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      this.x.filter(value, 1);
      return value;
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000, 0.0001);
    this.lastTime = timestamp;

    const dValue = (value - (this.x as any).prevRaw) / dt;
    const edValue = this.dx.filter(dValue, smoothingFactor(this.config.dCutoff, dt));
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edValue);
    const alpha = smoothingFactor(cutoff, dt);
    return this.x.filter(value, alpha);
  }

  reset(): void {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

export function smoothLandmarkSequence(
  frames: AnimationFrame[],
  config?: Partial<OneEuroConfig>,
): AnimationFrame[] {
  if (frames.length < 2) return frames;

  const cfg = { ...DEFAULT_CONFIG, ...config };

  const landmarkGroups = extractLandmarkGroups(frames);
  const smoothedGroups = applyOneEuroToGroups(landmarkGroups, cfg, frames);
  return rebuildFrames(frames, smoothedGroups);
}

type LandmarkKey = `pose_${number}` | `face_${number}` | `hand_left_${number}` | `hand_right_${number}`;

function extractLandmarkGroups(frames: AnimationFrame[]): Map<LandmarkKey, Array<{ value: number; time: number }>> {
  const groups = new Map<LandmarkKey, Array<{ value: number; time: number }>>();

  for (const frame of frames) {
    const time = frame.timestamp;

    if (frame.poseLandmarks) {
      for (let i = 0; i < frame.poseLandmarks.length; i++) {
        const key = `pose_${i}` as LandmarkKey;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ value: frame.poseLandmarks[i].x, time });
        groups.get(`${key}_y` as LandmarkKey)?.push({ value: frame.poseLandmarks[i].y, time });
        groups.get(`${key}_z` as LandmarkKey)?.push({ value: frame.poseLandmarks[i].z, time });
        const yKey = (`pose_${i}_y`) as LandmarkKey;
        const zKey = (`pose_${i}_z`) as LandmarkKey;
        if (!groups.has(yKey)) groups.set(yKey, []);
        if (!groups.has(zKey)) groups.set(zKey, []);
        groups.get(yKey)!.push({ value: frame.poseLandmarks[i].y, time });
        groups.get(zKey)!.push({ value: frame.poseLandmarks[i].z, time });
      }
    }

    if (frame.faceLandmarks) {
      for (let i = 0; i < frame.faceLandmarks.length; i++) {
        const xKey = `face_${i}` as LandmarkKey;
        const yKey = `face_${i}_y` as LandmarkKey;
        const zKey = `face_${i}_z` as LandmarkKey;
        if (!groups.has(xKey)) groups.set(xKey, []);
        if (!groups.has(yKey)) groups.set(yKey, []);
        if (!groups.has(zKey)) groups.set(zKey, []);
        groups.get(xKey)!.push({ value: frame.faceLandmarks[i].x, time });
        groups.get(yKey)!.push({ value: frame.faceLandmarks[i].y, time });
        groups.get(zKey)!.push({ value: frame.faceLandmarks[i].z, time });
      }
    }

    for (let h = 0; h < frame.landmarks.length; h++) {
      const side = frame.landmarks[h].side ?? (h === 0 ? "left" : "right");
      const prefix = side === "left" ? "hand_left" : "hand_right";
      for (let i = 0; i < frame.landmarks[h].landmarks.length; i++) {
        const xKey = `${prefix}_${i}` as LandmarkKey;
        const yKey = `${prefix}_${i}_y` as LandmarkKey;
        const zKey = `${prefix}_${i}_z` as LandmarkKey;
        if (!groups.has(xKey)) groups.set(xKey, []);
        if (!groups.has(yKey)) groups.set(yKey, []);
        if (!groups.has(zKey)) groups.set(zKey, []);
        groups.get(xKey)!.push({ value: frame.landmarks[h].landmarks[i].x, time });
        groups.get(yKey)!.push({ value: frame.landmarks[h].landmarks[i].y, time });
        groups.get(zKey)!.push({ value: frame.landmarks[h].landmarks[i].z, time });
      }
    }
  }

  return groups;
}

function applyOneEuroToGroups(
  groups: Map<LandmarkKey, Array<{ value: number; time: number }>>,
  config: OneEuroConfig,
  _frames: AnimationFrame[],
): Map<LandmarkKey, number[]> {
  const result = new Map<LandmarkKey, number[]>();

  for (const [key, values] of groups) {
    const filter = new OneEuroFilter(config);
    const smoothed: number[] = [];
    for (const v of values) {
      smoothed.push(filter.filter(v.value, v.time));
    }
    result.set(key, smoothed);
  }

  return result;
}

function rebuildFrames(
  frames: AnimationFrame[],
  smoothed: Map<LandmarkKey, number[]>,
): AnimationFrame[] {
  return frames.map((frame, frameIdx) => {
    const rebuilt: AnimationFrame = {
      timestamp: frame.timestamp,
      landmarks: [],
    };

    if (frame.poseLandmarks) {
      rebuilt.poseLandmarks = frame.poseLandmarks.map((_lm, i) => {
        const xVals = smoothed.get(`pose_${i}` as LandmarkKey);
        const yVals = smoothed.get(`pose_${i}_y` as LandmarkKey);
        const zVals = smoothed.get(`pose_${i}_z` as LandmarkKey);
        return {
          x: xVals?.[frameIdx] ?? _lm.x,
          y: yVals?.[frameIdx] ?? _lm.y,
          z: zVals?.[frameIdx] ?? _lm.z,
        };
      });
    }

    if (frame.faceLandmarks) {
      rebuilt.faceLandmarks = frame.faceLandmarks.map((_lm, i) => {
        const xVals = smoothed.get(`face_${i}` as LandmarkKey);
        const yVals = smoothed.get(`face_${i}_y` as LandmarkKey);
        const zVals = smoothed.get(`face_${i}_z` as LandmarkKey);
        return {
          x: xVals?.[frameIdx] ?? _lm.x,
          y: yVals?.[frameIdx] ?? _lm.y,
          z: zVals?.[frameIdx] ?? _lm.z,
        };
      });
    }

    for (let h = 0; h < frame.landmarks.length; h++) {
      const side = frame.landmarks[h].side ?? (h === 0 ? "left" : "right");
      const prefix = side === "left" ? "hand_left" : "hand_right";
      const smoothedLms = frame.landmarks[h].landmarks.map((_lm, i) => {
        const xVals = smoothed.get(`${prefix}_${i}` as LandmarkKey);
        const yVals = smoothed.get(`${prefix}_${i}_y` as LandmarkKey);
        const zVals = smoothed.get(`${prefix}_${i}_z` as LandmarkKey);
        return {
          x: xVals?.[frameIdx] ?? _lm.x,
          y: yVals?.[frameIdx] ?? _lm.y,
          z: zVals?.[frameIdx] ?? _lm.z,
        };
      });
      rebuilt.landmarks.push({ landmarks: smoothedLms, side: frame.landmarks[h].side });
    }

    return rebuilt;
  });
}
