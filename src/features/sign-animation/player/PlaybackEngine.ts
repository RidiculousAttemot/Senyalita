import type {
  AnimationClip,
  AnimationFrame,
  PlaybackState,
  PlaybackEventCallback,
  GestureAnimationAsset,
  HandLandmarks,
} from "../types";

export interface BlendConfig {
  enabled: boolean;
  duration: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function blendLandmarks(
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
    const blended: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < maxLm; i++) {
      const la = i < a.length ? a[i] : { x: 0, y: 0, z: 0 };
      const lb = i < b.length ? b[i] : { x: 0, y: 0, z: 0 };
      blended.push(lerpPoint(la, lb, t));
    }
    result.push({ landmarks: blended });
  }
  return result;
}

function blendPoseOrFace(
  from: { x: number; y: number; z: number }[] | undefined,
  to: { x: number; y: number; z: number }[] | undefined,
  t: number,
): { x: number; y: number; z: number }[] | undefined {
  if (!from && !to) return undefined;
  if (!from) return to;
  if (!to) return from;
  const max = Math.max(from.length, to.length);
  const result: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < max; i++) {
    const a = i < from.length ? from[i] : { x: 0, y: 0, z: 0 };
    const b = i < to.length ? to[i] : { x: 0, y: 0, z: 0 };
    result.push(lerpPoint(a, b, t));
  }
  return result;
}

export class PlaybackEngine {
  private queue: AnimationClip[] = [];
  private currentClip: AnimationClip | null = null;
  private currentTime = 0;
  private currentFrameIndex = 0;
  private isPlaying = false;
  private isPaused = false;
  private speed = 1;
  private loop = false;
  private animationId: number | null = null;
  private lastTimestamp = 0;
  private callbacks: PlaybackEventCallback = {};
  private blendConfig: BlendConfig = { enabled: true, duration: 0.25 };
  private blending = false;
  private blendTime = 0;
  private previousFrame: AnimationFrame | null = null;

  private durationMs(): number {
    return this.currentClip?.asset.duration ?? 0;
  }

  private durationSec(): number {
    return this.durationMs() / 1000;
  }

  getState(): PlaybackState {
    const asset = this.currentClip?.asset;
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: this.currentTime,
      duration: this.durationSec(),
      currentGesture: this.currentClip?.gesture ?? null,
      currentIndex: this.currentFrameIndex,
      queueLength: this.queue.length + (this.currentClip ? 1 : 0),
      speed: this.speed,
      loop: this.loop,
    };
  }

  setCallbacks(cbs: PlaybackEventCallback): void {
    this.callbacks = cbs;
  }

  setSpeed(s: number): void {
    this.speed = Math.max(0.1, Math.min(10, s));
  }

  setLoop(l: boolean): void {
    this.loop = l;
  }

  setBlend(config: Partial<BlendConfig>): void {
    if (config.enabled !== undefined) this.blendConfig.enabled = config.enabled;
    if (config.duration !== undefined) this.blendConfig.duration = config.duration;
  }

  loadClip(clip: AnimationClip): void {
    if (this.isPlaying) {
      this.queueClip(clip);
      return;
    }
    this.currentClip = clip;
    this.currentTime = 0;
    this.currentFrameIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.blending = false;
    this.lastTimestamp = performance.now();
    const total = this.queue.length + 1;
    this.callbacks.onGestureChange?.(clip.gesture, 0, total);
    this.startLoop();
  }

  queueClip(clip: AnimationClip): void {
    this.queue = [...this.queue, clip];
  }

  queueClips(clips: AnimationClip[]): void {
    this.queue = [...this.queue, ...clips];
  }

  clearQueue(): void {
    this.queue = [];
  }

  play(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    } else if (!this.isPlaying && this.currentClip) {
      this.isPlaying = true;
      this.currentTime = 0;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  pause(): void {
    this.isPaused = true;
    this.stopLoop();
  }

  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTime = 0;
    this.currentFrameIndex = 0;
    this.currentClip = null;
    this.queue = [];
    this.blending = false;
    this.previousFrame = null;
    this.stopLoop();
  }

  replay(): void {
    if (this.currentClip) {
      this.currentTime = 0;
      this.currentFrameIndex = 0;
      this.isPlaying = true;
      this.isPaused = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  private startLoop(): void {
    if (this.animationId !== null) return;
    const loop = (timestamp: number) => {
      if (!this.isPlaying || this.isPaused) {
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

  private getFrameAtTime(asset: GestureAnimationAsset, time: number): AnimationFrame {
    const { frames } = asset;
    if (!frames || frames.length === 0) {
      return { timestamp: 0, landmarks: [] };
    }
    if (frames.length === 1) return frames[0];

    const durationSec = asset.duration / 1000;
    const clampedTime = Math.max(0, Math.min(time, durationSec));
    const progress = durationSec > 0 ? clampedTime / durationSec : 0;
    const totalFrames = frames.length;

    const exactIndex = progress * (totalFrames - 1);
    const indexA = Math.floor(exactIndex);
    const indexB = Math.min(indexA + 1, totalFrames - 1);
    const t = exactIndex - indexA;

    const frameA = frames[indexA];
    const frameB = frames[indexB];

    if (indexA === indexB || t === 0) return frameA;

    return {
      timestamp: clampedTime,
      landmarks: blendLandmarks(frameA.landmarks, frameB.landmarks, t),
      poseLandmarks: blendPoseOrFace(frameA.poseLandmarks, frameB.poseLandmarks, t),
      faceLandmarks: blendPoseOrFace(frameA.faceLandmarks, frameB.faceLandmarks, t),
    };
  }

  private tick(delta: number): void {
    if (!this.currentClip) {
      this.processNext();
      return;
    }

    const effectiveDelta = delta * this.speed;
    this.currentTime += effectiveDelta;

    const asset = this.currentClip.asset;
    const durSec = this.durationSec();

    if (durSec > 0 && this.currentTime >= durSec && !this.loop) {
      this.callbacks.onComplete?.(this.currentClip);
      if (this.queue.length > 0) {
        this.currentTime -= durSec;
        this.processNext();
        return;
      }
      this.isPlaying = false;
      this.stopLoop();
      this.callbacks.onQueueComplete?.();
      return;
    }

    if (durSec > 0 && this.currentTime >= durSec && this.loop) {
      this.currentTime = this.currentTime % durSec;
    }

    let frame = this.getFrameAtTime(asset, this.currentTime);

    if (this.blending && this.previousFrame && this.blendConfig.enabled) {
      this.blendTime += effectiveDelta;
      const bt = Math.min(1, this.blendTime / this.blendConfig.duration);
      const eased = bt * bt * (3 - 2 * bt);
      const blendedLandmarks = blendLandmarks(
        this.previousFrame.landmarks,
        frame.landmarks,
        eased,
      );
      frame = {
        timestamp: frame.timestamp,
        landmarks: blendedLandmarks,
        poseLandmarks: blendPoseOrFace(this.previousFrame.poseLandmarks, frame.poseLandmarks, eased),
        faceLandmarks: blendPoseOrFace(this.previousFrame.faceLandmarks, frame.faceLandmarks, eased),
      };
      if (bt >= 1) {
        this.blending = false;
        this.previousFrame = null;
      }
    }

    const frameDelta = durSec > 0 ? durSec / asset.frames.length : 1 / 30;
    this.currentFrameIndex = Math.min(
      Math.floor(this.currentTime / frameDelta),
      asset.frames.length - 1,
    );

    this.callbacks.onFrame?.(frame, this.currentTime, this.currentClip);
  }

  private processNext(): void {
    if (this.queue.length > 0) {
      const prevClip = this.currentClip;
      const next = this.queue[0];
      this.queue = this.queue.slice(1);
      const total = this.queue.length + 1;

      if (prevClip && this.blendConfig.enabled) {
        this.blending = true;
        this.blendTime = 0;
        this.previousFrame = this.getFrameAtTime(
          prevClip.asset,
          prevClip.asset.duration / 1000,
        );
      } else {
        this.blending = false;
        this.previousFrame = null;
      }

      this.currentClip = next;
      this.currentTime = 0;
      this.currentFrameIndex = 0;
      this.isPlaying = true;
      this.callbacks.onGestureChange?.(next.gesture, 0, total);
    } else {
      this.isPlaying = false;
      this.stopLoop();
      this.currentClip = null;
      this.callbacks.onQueueComplete?.();
    }
  }

  dispose(): void {
    this.stopLoop();
    this.currentClip = null;
    this.queue = [];
    this.callbacks = {};
    this.previousFrame = null;
  }
}
