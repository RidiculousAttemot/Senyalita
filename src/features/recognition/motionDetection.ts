import type { HandData } from "./buffer";

const MOTION_THRESHOLD = 0.015;
const IDLE_THRESHOLD = 0.005;
/**
 * Still frames required before a gesture is called finished. Exported so the
 * sequence buffer can trim the same trailing stillness off the gesture span.
 */
export const IDLE_FRAMES = 15;
const START_FRAMES = 3;
const VELOCITY_WINDOW = 5;
const STABILITY_WINDOW = 8;
const STABILITY_VARIANCE_THRESHOLD = 0.003;

export type MotionState = "idle" | "gesturing";
export type GesturePhase = "none" | "start" | "hold" | "end";

export class MotionDetector {
  private prevLeft: HandData | null = null;
  private prevRight: HandData | null = null;
  private idleCount = 0;
  private activeCount = 0;
  private state: MotionState = "idle";
  private phase: GesturePhase = "none";
  private velocityHistory: number[] = [];
  private frameHistory: Array<{ motion: number; time: number }> = [];
  private phaseStableCount = 0;
  private lastFrameTime = 0;

  reset(): void {
    this.prevLeft = null;
    this.prevRight = null;
    this.idleCount = 0;
    this.activeCount = 0;
    this.state = "idle";
    this.phase = "none";
    this.velocityHistory = [];
    this.frameHistory = [];
    this.phaseStableCount = 0;
    this.lastFrameTime = 0;
  }

  getState(): MotionState {
    return this.state;
  }

  getPhase(): GesturePhase {
    return this.phase;
  }

  update(left: HandData | null, right: HandData | null): MotionState {
    const now = performance.now();
    const dt = this.lastFrameTime > 0 ? now - this.lastFrameTime : 16;
    this.lastFrameTime = now;

    const motion = this.computeMotion(left, right);

    this.prevLeft = left ? { ...left, landmarks: [...left.landmarks] } : null;
    this.prevRight = right ? { ...right, landmarks: [...right.landmarks] } : null;

    if (motion !== null) {
      this.frameHistory.push({ motion, time: now });
      if (this.frameHistory.length > VELOCITY_WINDOW) {
        this.frameHistory.shift();
      }
    }

    if (motion === null) {
      this.idleCount++;
      this.activeCount = 0;
    } else if (motion > MOTION_THRESHOLD) {
      this.activeCount++;
      this.idleCount = 0;
    } else {
      this.idleCount++;
      this.activeCount = 0;
    }

    if (this.state === "idle" && this.activeCount >= START_FRAMES) {
      this.state = "gesturing";
      this.phase = "start";
      this.phaseStableCount = 0;
    }

    if (this.state === "gesturing") {
      this.updatePhase(motion, dt);
    }

    return this.state;
  }

  private updatePhase(motion: number | null, dt: number): void {
    const velocity = motion !== null && dt > 0 ? motion / dt : 0;
    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > VELOCITY_WINDOW) {
      this.velocityHistory.shift();
    }

    const stability = this.computeStability();

    switch (this.phase) {
      case "start":
        if (stability < STABILITY_VARIANCE_THRESHOLD && this.phaseStableCount > 3) {
          this.phase = "hold";
          this.phaseStableCount = 0;
        }
        this.phaseStableCount++;
        break;

      case "hold":
        if (motion !== null && motion > MOTION_THRESHOLD && this.phaseStableCount > 5) {
          this.phase = "end";
          this.phaseStableCount = 0;
        }
        if (this.idleCount >= IDLE_FRAMES) {
          this.state = "idle";
          this.phase = "none";
        }
        this.phaseStableCount++;
        break;

      case "end":
        this.state = "idle";
        this.phase = "none";
        this.idleCount = 0;
        this.activeCount = 0;
        break;

      default:
        break;
    }
  }

  private computeStability(): number {
    if (this.velocityHistory.length < 3) return Infinity;
    const recent = this.velocityHistory.slice(-STABILITY_WINDOW);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
    return variance;
  }

  private computeMotion(
    left: HandData | null,
    right: HandData | null
  ): number | null {
    const leftMotion = this.handMotion(left, this.prevLeft);
    const rightMotion = this.handMotion(right, this.prevRight);

    if (leftMotion === null && rightMotion === null) return null;
    if (leftMotion === null) return rightMotion;
    if (rightMotion === null) return leftMotion;

    return (leftMotion + rightMotion) / 2;
  }

  private handMotion(
    current: HandData | null,
    previous: HandData | null
  ): number | null {
    if (!current || !previous) return null;
    if (current.landmarks.length !== previous.landmarks.length) return null;

    let totalDist = 0;
    const count = current.landmarks.length;

    for (let i = 0; i < count; i++) {
      const dx = current.landmarks[i].x - previous.landmarks[i].x;
      const dy = current.landmarks[i].y - previous.landmarks[i].y;
      const dz = current.landmarks[i].z - previous.landmarks[i].z;
      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return totalDist / count;
  }
}
