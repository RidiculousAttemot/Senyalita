import type { AnimationFrame, LandmarkPoint, TransitionPlan } from "../types";

export class TransitionEngine {
  private blendDuration = 250;
  private holdDuration = 50;
  private anticipateEnabled = true;

  setConfig(config: { blendDuration?: number; holdDuration?: number; anticipateEnabled?: boolean }): void {
    if (config.blendDuration !== undefined) this.blendDuration = config.blendDuration;
    if (config.holdDuration !== undefined) this.holdDuration = config.holdDuration;
    if (config.anticipateEnabled !== undefined) this.anticipateEnabled = config.anticipateEnabled;
  }

  createTransition(fromGesture: string, toGesture: string, fromFrame: AnimationFrame | null, toFrame: AnimationFrame | null): TransitionPlan {
    return {
      fromGesture,
      toGesture,
      fromFrame,
      toFrame,
      duration: this.blendDuration,
      blendMethod: "smoothstep",
      holdBefore: this.holdDuration,
      holdAfter: this.holdDuration,
    };
  }

  blendFrames(prevFrame: AnimationFrame, nextFrame: AnimationFrame, progress: number): AnimationFrame {
    const t = Math.max(0, Math.min(1, progress));
    const smoothT = t * t * (3 - 2 * t);
    const anticipateT = this.anticipateEnabled && t < 0.3
      ? smoothT + 0.15 * (1 - t / 0.3)
      : smoothT;

    return {
      timestamp: prevFrame.timestamp + (nextFrame.timestamp - prevFrame.timestamp) * t,
      landmarks: this.blendLandmarkArrays(prevFrame.landmarks, nextFrame.landmarks, anticipateT),
      poseLandmarks: this.blendLandmarkPoints(prevFrame.poseLandmarks, nextFrame.poseLandmarks, anticipateT),
      faceLandmarks: this.blendLandmarkPoints(prevFrame.faceLandmarks, nextFrame.faceLandmarks, anticipateT),
    };
  }

  private blendLandmarkArrays(
    from: AnimationFrame["landmarks"],
    to: AnimationFrame["landmarks"],
    t: number,
  ): AnimationFrame["landmarks"] {
    const maxHands = Math.max(from.length, to.length);
    const result: AnimationFrame["landmarks"] = [];
    for (let h = 0; h < maxHands; h++) {
      const a = h < from.length ? from[h].landmarks : [];
      const b = h < to.length ? to[h].landmarks : [];
      const maxLm = Math.max(a.length, b.length);
      const blended: LandmarkPoint[] = [];
      for (let i = 0; i < maxLm; i++) {
        const la = i < a.length ? a[i] : { x: 0, y: 0, z: 0 };
        const lb = i < b.length ? b[i] : { x: 0, y: 0, z: 0 };
        blended.push(this.lerpLandmark(la, lb, t));
      }
      const side = h < from.length ? from[h].side : to[h]?.side;
      result.push({ landmarks: blended, side });
    }
    return result;
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
      result.push(this.lerpLandmark(a, b, t));
    }
    return result;
  }

  private lerpLandmark(a: LandmarkPoint, b: LandmarkPoint, t: number): LandmarkPoint {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }

  getLastFrame(assetFrames: AnimationFrame[]): AnimationFrame | null {
    if (assetFrames.length === 0) return null;
    return assetFrames[assetFrames.length - 1];
  }

  getFirstFrame(assetFrames: AnimationFrame[]): AnimationFrame | null {
    if (assetFrames.length === 0) return null;
    return assetFrames[0];
  }

  reset(): void {
    this.blendDuration = 250;
    this.holdDuration = 50;
  }
}
