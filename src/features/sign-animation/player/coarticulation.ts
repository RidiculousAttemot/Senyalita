import type { AnimationFrame, HandLandmarks, LandmarkPoint, CoarticulationConfig } from "../types";

export class CoarticulationEngine {
  private config: CoarticulationConfig;
  private previousFrames: Map<string, AnimationFrame> = new Map();
  private transitionFrame: AnimationFrame | null = null;
  private transitionProgress = 0;
  private anticipationPhase = 0;
  private followThroughPhase = 0;

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

    if (this.anticipationPhase < 1) {
      this.anticipationPhase += dt / (this.config.blendDuration * 0.3);
      const anticipationT = Math.min(1, this.anticipationPhase);
      const antiSmooth = anticipationT * anticipationT * (3 - 2 * anticipationT);
      const antiAmount = 0.1 * (1 - antiSmooth);
      frame = this.applyAnticipation(frame, this.transitionFrame, antiAmount);
    }

    this.transitionProgress += dt / this.config.blendDuration;
    if (this.transitionProgress >= 1) {
      this.transitionProgress = 0;
      this.transitionFrame = null;
      if (this.followThroughPhase < 1) {
        this.followThroughPhase += dt / (this.config.blendDuration * 0.2);
        return this.applyFollowThrough(frame, this.followThroughPhase);
      }
      this.anticipationPhase = 0;
      this.followThroughPhase = 0;
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
          const wristSmooth = this.smoothWrist(smoothT);
          blended.push({
            x: cur.x * wristSmooth + trans.x * (1 - wristSmooth),
            y: cur.y * wristSmooth + trans.y * (1 - wristSmooth),
            z: cur.z * wristSmooth + trans.z * (1 - wristSmooth),
          });
        } else if (this.config.trajectoryOptimization && (i >= 5 && i <= 8)) {
          const anticipation = 0.15 * (1 - smoothT);
          const followThrough = 0.08 * smoothT;
          const adjustedT = Math.min(1, smoothT + anticipation - followThrough * 0.3);
          blended.push({
            x: cur.x * adjustedT + trans.x * (1 - adjustedT),
            y: cur.y * adjustedT + trans.y * (1 - adjustedT),
            z: cur.z * adjustedT + trans.z * (1 - adjustedT),
          });
        } else {
          const jointEasing = this.getJointEasing(i, smoothT);
          blended.push({
            x: cur.x * jointEasing + trans.x * (1 - jointEasing),
            y: cur.y * jointEasing + trans.y * (1 - jointEasing),
            z: cur.z * jointEasing + trans.z * (1 - jointEasing),
          });
        }
      }
      blendedLandmarks.push({
        landmarks: blended,
        side: frame.landmarks[h]?.side ?? this.transitionFrame.landmarks[h]?.side,
      });
    }

    const blendedPose = this.blendBodyPose(
      frame.poseLandmarks,
      this.transitionFrame.poseLandmarks,
      smoothT,
    );

    return {
      timestamp: frame.timestamp,
      landmarks: blendedLandmarks,
      poseLandmarks: blendedPose,
    };
  }

  private applyAnticipation(frame: AnimationFrame, target: AnimationFrame, amount: number): AnimationFrame {
    const adjusted: HandLandmarks[] = frame.landmarks.map((hand, h) => ({
      landmarks: hand.landmarks.map((lm, i) => {
        const targetLm = target.landmarks[h]?.landmarks[i];
        if (!targetLm) return lm;
        return {
          x: lm.x + (targetLm.x - lm.x) * amount,
          y: lm.y + (targetLm.y - lm.y) * amount,
          z: lm.z + (targetLm.z - lm.z) * amount,
        };
      }),
      side: hand.side,
    }));

    return {
      timestamp: frame.timestamp,
      landmarks: adjusted,
      poseLandmarks: frame.poseLandmarks,
    };
  }

  private applyFollowThrough(frame: AnimationFrame, phase: number): AnimationFrame {
    const t = phase * phase * (3 - 2 * phase);
    const decay = 1 - t * 0.15;
    return {
      timestamp: frame.timestamp,
      landmarks: frame.landmarks.map((hand) => ({
        landmarks: hand.landmarks.map((lm) => ({
          x: lm.x * decay + 0.001 * (1 - decay),
          y: lm.y * decay,
          z: lm.z * decay,
        })),
        side: hand.side,
      })),
      poseLandmarks: frame.poseLandmarks,
    };
  }

  private smoothWrist(t: number): number {
    return t < 0.5
      ? 2 * t * t
      : -1 + (4 - 2 * t) * t;
  }

  private getJointEasing(index: number, t: number): number {
    if (index <= 4) {
      return t * t * (3 - 2 * t) * 1.1;
    }
    if (index >= 5 && index <= 8) {
      return t * t * (3 - 2 * t) * 0.95;
    }
    if (index >= 9 && index <= 12) {
      return t * t * (3 - 2 * t) * 0.85;
    }
    if (index >= 13 && index <= 16) {
      return t * t * (3 - 2 * t) * 0.75;
    }
    return t * t * (3 - 2 * t) * 0.65;
  }

  private blendBodyPose(
    current: LandmarkPoint[] | undefined,
    previous: LandmarkPoint[] | undefined,
    t: number,
  ): LandmarkPoint[] | undefined {
    if (!current && !previous) return undefined;
    if (!current) return previous;
    if (!previous) return current;

    const max = Math.max(current.length, previous.length);
    const result: LandmarkPoint[] = [];
    for (let i = 0; i < max; i++) {
      const cur = i < current.length ? current[i] : { x: 0, y: 0, z: 0 };
      const prev = i < previous.length ? previous[i] : { x: 0, y: 0, z: 0 };

      const shoulderEasing = (i >= 11 && i <= 14) ? t * t * (3 - 2 * t) * 0.6 : t;
      const elbowEasing = (i >= 13 && i <= 16) ? t * t * (3 - 2 * t) * 0.7 : shoulderEasing;
      const easing = (i >= 23 && i <= 28) ? t * t * (3 - 2 * t) * 0.5 : elbowEasing;

      result.push({
        x: cur.x * easing + prev.x * (1 - easing),
        y: cur.y * easing + prev.y * (1 - easing),
        z: cur.z * easing + prev.z * (1 - easing),
      });
    }
    return result;
  }

  startTransition(previousGesture: string, nextGesture: string): void {
    const prev = this.previousFrames.get(previousGesture);
    const next = this.previousFrames.get(nextGesture);
    if (prev && next) {
      this.transitionFrame = this.cloneFrame(prev);
      this.transitionProgress = 0;
      this.anticipationPhase = 0;
      this.followThroughPhase = 0;
    }
  }

  private cloneFrame(frame: AnimationFrame): AnimationFrame {
    return {
      timestamp: frame.timestamp,
      landmarks: frame.landmarks.map((h) => ({
        landmarks: h.landmarks.map((lm) => ({ ...lm })),
      })),
      poseLandmarks: frame.poseLandmarks?.map((lm) => ({ ...lm })),
    };
  }

  clearGesture(gestureLabel: string): void {
    this.previousFrames.delete(gestureLabel);
  }

  reset(): void {
    this.previousFrames.clear();
    this.transitionFrame = null;
    this.transitionProgress = 0;
    this.anticipationPhase = 0;
    this.followThroughPhase = 0;
  }

  getPreviousFrame(gestureLabel: string): AnimationFrame | undefined {
    return this.previousFrames.get(gestureLabel);
  }
}
