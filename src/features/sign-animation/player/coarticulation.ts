import type { AnimationFrame, HandLandmarks, LandmarkPoint, CoarticulationConfig } from "../types";

export class CoarticulationEngine {
  private config: CoarticulationConfig;
  private previousFrames: Map<string, AnimationFrame> = new Map();
  private transitionFrame: AnimationFrame | null = null;
  private transitionProgress = 0;

  constructor(config?: Partial<CoarticulationConfig>) {
    this.config = {
      enabled: true,
      blendDuration: 200,
      wristContinuity: true,
      bodyContinuity: true,
      trajectoryOptimization: true,
      ...config,
    };
  }

  setConfig(config: Partial<CoarticulationConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): CoarticulationConfig {
    return { ...this.config };
  }

  processFrame(
    frame: AnimationFrame,
    gestureLabel: string,
    dt: number,
  ): AnimationFrame {
    if (!this.config.enabled) return frame;

    const prevFrame = this.previousFrames.get(gestureLabel);
    this.previousFrames.set(gestureLabel, frame);

    if (!this.transitionFrame || !prevFrame) {
      this.transitionFrame = this.cloneFrame(frame);
      return frame;
    }

    this.transitionProgress += dt / this.config.blendDuration;
    if (this.transitionProgress >= 1) {
      this.transitionProgress = 0;
      this.transitionFrame = null;
      return frame;
    }

    const t = this.transitionProgress;
    const smoothT = t * t * (3 - 2 * t);

    const blendedLandmarks: HandLandmarks[] = [];

    const maxHands = Math.max(frame.landmarks.length, this.transitionFrame.landmarks.length);
    for (let h = 0; h < maxHands; h++) {
      const currentLms = h < frame.landmarks.length
        ? frame.landmarks[h].landmarks
        : [];
      const transLms = h < this.transitionFrame.landmarks.length
        ? this.transitionFrame.landmarks[h].landmarks
        : [];

      const maxLm = Math.max(currentLms.length, transLms.length);
      const blended: LandmarkPoint[] = [];

      for (let i = 0; i < maxLm; i++) {
        const cur = i < currentLms.length ? currentLms[i] : { x: 0, y: 0, z: 0 };
        const trans = i < transLms.length ? transLms[i] : { x: 0, y: 0, z: 0 };

        if (this.config.wristContinuity && (i === 0 || i === 5 || i === 9 || i === 13 || i === 17)) {
          blended.push({
            x: cur.x * smoothT + trans.x * (1 - smoothT),
            y: cur.y * smoothT + trans.y * (1 - smoothT),
            z: cur.z * smoothT + trans.z * (1 - smoothT),
          });
        } else if (this.config.trajectoryOptimization && (i >= 5 && i <= 8)) {
          const anticipation = 0.15;
          blended.push({
            x: cur.x * (smoothT + anticipation) + trans.x * (1 - smoothT - anticipation),
            y: cur.y * (smoothT + anticipation) + trans.y * (1 - smoothT - anticipation),
            z: cur.z * (smoothT + anticipation) + trans.z * (1 - smoothT - anticipation),
          });
        } else {
          blended.push({
            x: cur.x * smoothT + trans.x * (1 - smoothT),
            y: cur.y * smoothT + trans.y * (1 - smoothT),
            z: cur.z * smoothT + trans.z * (1 - smoothT),
          });
        }
      }
      blendedLandmarks.push({ landmarks: blended });
    }

    return {
      timestamp: frame.timestamp,
      landmarks: blendedLandmarks,
    };
  }

  startTransition(previousGesture: string, nextGesture: string): void {
    const prev = this.previousFrames.get(previousGesture);
    const next = this.previousFrames.get(nextGesture);
    if (prev && next) {
      this.transitionFrame = this.cloneFrame(prev);
      this.transitionProgress = 0;
    }
  }

  private cloneFrame(frame: AnimationFrame): AnimationFrame {
    return {
      timestamp: frame.timestamp,
      landmarks: frame.landmarks.map((h) => ({
        landmarks: h.landmarks.map((lm) => ({ ...lm })),
      })),
    };
  }

  clearGesture(gestureLabel: string): void {
    this.previousFrames.delete(gestureLabel);
  }

  reset(): void {
    this.previousFrames.clear();
    this.transitionFrame = null;
    this.transitionProgress = 0;
  }

  getPreviousFrame(gestureLabel: string): AnimationFrame | undefined {
    return this.previousFrames.get(gestureLabel);
  }
}
