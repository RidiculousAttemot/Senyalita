import type { MotionCurveConfig, LandmarkPoint, AnimationFrame, HandLandmarks } from "../types";

export class MotionCurveEngine {
  private config: MotionCurveConfig;

  constructor(config?: Partial<MotionCurveConfig>) {
    this.config = {
      interpolation: "smoothstep",
      handSpeed: 1,
      wristSpeed: 0.85,
      elbowSpeed: 0.7,
      shoulderSpeed: 0.6,
      bodySpeed: 0.5,
      ...config,
    };
  }

  setConfig(config: Partial<MotionCurveConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): MotionCurveConfig {
    return { ...this.config };
  }

  applyCurves(frame: AnimationFrame): AnimationFrame {
    return frame;
  }

  interpolate(progress: number): number {
    const t = Math.max(0, Math.min(1, progress));
    switch (this.config.interpolation) {
      case "linear": return t;
      case "smoothstep": return t * t * (3 - 2 * t);
      case "ease-in": return t * t;
      case "ease-out": return t * (2 - t);
      case "ease-in-out": return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case "bezier": return this.bezierCurve(t, this.config.bezierPoints ?? [0.25, 0.1, 0.25, 1]);
      default: return t;
    }
  }

  private bezierCurve(t: number, p: [number, number, number, number]): number {
    const [p0, p1, p2, p3] = p;
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  blendWithSpeedWeighting(
    from: AnimationFrame,
    to: AnimationFrame,
    progress: number,
    jointType: "hand" | "wrist" | "elbow" | "shoulder" | "body",
  ): AnimationFrame {
    const rawT = this.interpolate(progress);
    const speedMap: Record<string, number> = {
      hand: this.config.handSpeed ?? 1,
      finger: 1.1,
      wrist: this.config.wristSpeed ?? 0.85,
      elbow: this.config.elbowSpeed ?? 0.7,
      shoulder: this.config.shoulderSpeed ?? 0.6,
      body: this.config.bodySpeed ?? 0.5,
    };
    const adjusted = Math.min(1, rawT * (speedMap[jointType] ?? 1));

    return {
      timestamp: from.timestamp + (to.timestamp - from.timestamp) * adjusted,
      landmarks: this.blendLandmarksWithSpeed(from.landmarks, to.landmarks, adjusted, jointType),
      poseLandmarks: this.blendLandmarkPoints(from.poseLandmarks, to.poseLandmarks, adjusted),
      faceLandmarks: this.blendLandmarkPoints(from.faceLandmarks, to.faceLandmarks, adjusted),
    };
  }

  private blendLandmarksWithSpeed(
    from: HandLandmarks[],
    to: HandLandmarks[],
    t: number,
    jointType: "hand" | "wrist" | "elbow" | "shoulder" | "body",
  ): HandLandmarks[] {
    const maxHands = Math.max(from.length, to.length);
    const result: HandLandmarks[] = [];
    for (let h = 0; h < maxHands; h++) {
      const a = h < from.length ? from[h].landmarks : [];
      const b = h < to.length ? to[h].landmarks : [];
      const maxLm = Math.max(a.length, b.length);
      const blended: LandmarkPoint[] = [];
      for (let i = 0; i < maxLm; i++) {
        const la = i < a.length ? a[i] : { x: 0, y: 0, z: 0 };
        const lb = i < b.length ? b[i] : { x: 0, y: 0, z: 0 };
        const lmT = this.getLandmarkSpeed(i, jointType, t);
        blended.push(this.lerpPoint(la, lb, lmT));
      }
      result.push({ landmarks: blended });
    }
    return result;
  }

  private getLandmarkSpeed(index: number, jointType: string, baseT: number): number {
    if (jointType === "hand") {
      if (index <= 4) return Math.min(1, baseT * 1.2);
      if (index >= 5 && index <= 8) return Math.min(1, baseT * 1.1);
      if (index >= 9 && index <= 12) return Math.min(1, baseT * 1.0);
      if (index >= 13 && index <= 16) return Math.min(1, baseT * 0.9);
      return Math.min(1, baseT * 0.8);
    }
    return Math.min(1, baseT);
  }

  private blendLandmarkPoints(
    from: LandmarkPoint[] | undefined,
    to: LandmarkPoint[] | undefined,
    t: number,
  ): LandmarkPoint[] | undefined {
    if (!from && !to) return undefined;
    if (!from) return to;
    if (!to) return from;
    const max = Math.max(from.length, to.length);
    const result: LandmarkPoint[] = [];
    for (let i = 0; i < max; i++) {
      const a = i < from.length ? from[i] : { x: 0, y: 0, z: 0 };
      const b = i < to.length ? to[i] : { x: 0, y: 0, z: 0 };
      result.push(this.lerpPoint(a, b, t));
    }
    return result;
  }

  private lerpPoint(a: LandmarkPoint, b: LandmarkPoint, t: number): LandmarkPoint {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }

  reset(): void {
    this.config.interpolation = "smoothstep";
  }
}
