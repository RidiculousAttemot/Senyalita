import type { AnimationClip, AnimationState, SkeletonPose } from "./types";
import { REST_POSE } from "./types";
import { interpolatePose } from "./interpolation";
import { applyEasing } from "./easing";

export type AnimationEventCallback = {
  onFrame?: (pose: SkeletonPose, time: number, clip: AnimationClip) => void;
  onComplete?: (clip: AnimationClip) => void;
  onQueueComplete?: () => void;
  onGestureChange?: (gesture: string, index: number, total: number) => void;
};

const CROSSFADE_DURATION = 0.15;

export class AnimationEngine {
  private state: AnimationState;
  private callbacks: AnimationEventCallback = {};
  private animationId: number | null = null;
  private lastTimestamp: number = 0;
  private crossfadeProgress: number = 0;
  private crossfading: boolean = false;
  private previousPose: SkeletonPose | null = null;

  constructor() {
    this.state = {
      currentClip: null,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      playbackSpeed: 1,
      queue: [],
      currentKeyframeIndex: 0,
    };
  }

  getState(): Readonly<AnimationState> {
    return this.state;
  }

  setCallbacks(cb: AnimationEventCallback): void {
    this.callbacks = cb;
  }

  loadClip(clip: AnimationClip): void {
    if (this.state.isPlaying) {
      this.queueClip(clip);
      return;
    }
    this.state.currentClip = clip;
    this.state.currentTime = 0;
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.state.currentKeyframeIndex = 0;
    this.crossfading = false;
    this.lastTimestamp = performance.now();
    this.callbacks.onGestureChange?.(clip.gesture, 0, 1);
    this.startLoop();
  }

  queueClip(clip: AnimationClip): void {
    this.state.queue = [...this.state.queue, clip];
  }

  queueClips(clips: AnimationClip[]): void {
    this.state.queue = [...this.state.queue, ...clips];
  }

  clearQueue(): void {
    this.state.queue = [];
  }

  play(): void {
    if (this.state.isPaused) {
      this.state.isPaused = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    } else if (!this.state.isPlaying && this.state.currentClip) {
      this.state.isPlaying = true;
      this.state.currentTime = 0;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  pause(): void {
    this.state.isPaused = true;
    this.stopLoop();
  }

  resume(): void {
    if (this.state.isPaused) {
      this.state.isPaused = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  stop(): void {
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.state.currentClip = null;
    this.state.queue = [];
    this.crossfading = false;
    this.previousPose = null;
    this.stopLoop();
  }

  setSpeed(speed: number): void {
    this.state.playbackSpeed = Math.max(0.1, Math.min(5, speed));
  }

  replay(): void {
    if (this.state.currentClip) {
      this.state.currentTime = 0;
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  private startLoop(): void {
    if (this.animationId !== null) return;
    const loop = (timestamp: number) => {
      if (!this.state.isPlaying || this.state.isPaused) {
        this.stopLoop();
        return;
      }
      const delta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;
      this.tick(delta);
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private tick(delta: number): void {
    if (!this.state.currentClip) {
      this.processQueue();
      return;
    }

    const effectiveDelta = delta * this.state.playbackSpeed;
    this.state.currentTime += effectiveDelta;

    const anim = this.state.currentClip.animation;
    const duration = anim.duration;

    if (this.state.currentTime >= duration) {
      this.callbacks.onComplete?.(this.state.currentClip);
      this.state.currentClip = null;
      this.state.currentTime = 0;
      if (this.state.queue.length > 0) {
        this.processQueue();
      } else {
        this.state.isPlaying = false;
        this.stopLoop();
        this.callbacks.onQueueComplete?.();
      }
      return;
    }

    const pose = interpolatePose(anim.keyframes, this.state.currentTime);

    if (this.crossfading && this.previousPose) {
      const cfProgress = Math.min(1, this.crossfadeProgress / CROSSFADE_DURATION);
      const cfEased = applyEasing(cfProgress, "ease-out");
      const blendedJoints: Record<string, any> = {};
      for (const j of Object.keys(pose.joints)) {
        const key = j as keyof typeof pose.joints;
        blendedJoints[key] = {
          x: pose.joints[key].x * cfEased + this.previousPose.joints[key].x * (1 - cfEased),
          y: pose.joints[key].y * cfEased + this.previousPose.joints[key].y * (1 - cfEased),
          z: pose.joints[key].z * cfEased + this.previousPose.joints[key].z * (1 - cfEased),
        };
      }
      this.crossfadeProgress += effectiveDelta;
      if (this.crossfadeProgress >= CROSSFADE_DURATION) {
        this.crossfading = false;
        this.previousPose = null;
      }
      this.callbacks.onFrame?.(
        { joints: blendedJoints as any },
        this.state.currentTime,
        this.state.currentClip,
      );
    } else {
      this.callbacks.onFrame?.(pose, this.state.currentTime, this.state.currentClip);
    }
  }

  private processQueue(): void {
    if (this.state.queue.length > 0) {
      const next = this.state.queue[0];
      this.state.queue = this.state.queue.slice(1);
      this.crossfading = true;
      this.crossfadeProgress = 0;
      if (this.state.currentClip) {
        this.previousPose = interpolatePose(
          this.state.currentClip.animation.keyframes,
          this.state.currentTime,
        );
      }
      this.state.currentClip = next;
      this.state.currentTime = 0;
      this.state.isPlaying = true;
      this.callbacks.onGestureChange?.(next.gesture, 0, this.state.queue.length + 1);
    } else {
      this.state.isPlaying = false;
      this.stopLoop();
      this.callbacks.onQueueComplete?.();
    }
  }

  dispose(): void {
    this.stopLoop();
    this.state.currentClip = null;
    this.state.queue = [];
    this.callbacks = {};
  }
}
