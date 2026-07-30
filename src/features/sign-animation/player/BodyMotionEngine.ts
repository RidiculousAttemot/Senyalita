import type { BodyMotionConfig, AnimationFrame, HandLandmarks, LandmarkPoint } from "../types";

export class BodyMotionEngine {
  private config: BodyMotionConfig;
  private time = 0;
  private breathPhase = 0;

  constructor(config?: Partial<BodyMotionConfig>) {
    this.config = {
      enabled: true,
      idleBreathing: true,
      headMotion: true,
      shoulderMovement: true,
      torsoSway: true,
      weightShifting: true,
      naturalRestPose: true,
      amplitude: 0.3,
      ...config,
    };
  }

  setConfig(config: Partial<BodyMotionConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): BodyMotionConfig {
    return { ...this.config };
  }

  processFrame(frame: AnimationFrame, dt: number, isIdle: boolean): AnimationFrame {
    if (!this.config.enabled) return frame;
    this.time += dt;
    this.breathPhase += dt * 0.4;

    const breathOffset = this.config.idleBreathing
      ? Math.sin(this.breathPhase) * 0.004 * this.config.amplitude
      : 0;

    const headTilt = this.config.headMotion
      ? Math.sin(this.time * 0.3) * 0.003 * this.config.amplitude
      : 0;

    const shoulderShift = this.config.shoulderMovement
      ? Math.sin(this.time * 0.2) * 0.002 * this.config.amplitude
      : 0;

    const torsoSwing = this.config.torsoSway
      ? Math.sin(this.time * 0.15) * 0.002 * this.config.amplitude
      : 0;

    const weightShift = this.config.weightShifting
      ? Math.sin(this.time * 0.25) * 0.001 * this.config.amplitude
      : 0;

    if (isIdle || true) {
      const adjustedLandmarks: HandLandmarks[] = frame.landmarks.map((hand) => ({
        landmarks: hand.landmarks.map((lm) => ({
          x: lm.x + shoulderShift + torsoSwing,
          y: lm.y + breathOffset + headTilt,
          z: lm.z + weightShift,
        })),
        side: hand.side,
      }));

      const adjustedPose = frame.poseLandmarks?.map((lm) => ({
        x: lm.x + shoulderShift + torsoSwing,
        y: lm.y + breathOffset + headTilt,
        z: lm.z + weightShift,
      }));

      const adjustedFace = frame.faceLandmarks?.map((lm) => ({
        x: lm.x + headTilt,
        y: lm.y + breathOffset,
        z: lm.z,
      }));

      return {
        timestamp: frame.timestamp,
        landmarks: adjustedLandmarks,
        poseLandmarks: adjustedPose,
        faceLandmarks: adjustedFace,
      };
    }

    return frame;
  }

  reset(): void {
    this.time = 0;
    this.breathPhase = 0;
  }
}
