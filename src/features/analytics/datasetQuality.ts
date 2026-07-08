export interface QualityScore {
  overall: number;
  blurScore: number;
  handPresenceScore: number;
  lightingScore: number;
  framingScore: number;
  motionBlurScore: number;
  duplicatesScore: number;
  passed: boolean;
  reasons: string[];
}

export interface VideoSample {
  id: string;
  frames: Array<{
    timestamp: number;
    landmarks?: Array<{ x: number; y: number; z: number }>;
    brightness?: number;
    motion?: number;
  }>;
  width?: number;
  height?: number;
  label?: string;
}

const QUALITY_THRESHOLD = 60;
const MIN_HANDS_VISIBLE_RATIO = 0.7;
const MIN_LANDMARKS_PER_HAND = 15;

export class DatasetQualityInspector {
  inspect(sample: VideoSample, threshold = QUALITY_THRESHOLD): QualityScore {
    const reasons: string[] = [];

    const blurScore = this.computeBlurScore(sample);
    if (blurScore < 50) reasons.push("Excessive blur detected");

    const handPresenceScore = this.computeHandPresenceScore(sample);
    if (handPresenceScore < 50) reasons.push("Hands not fully visible in many frames");

    const lightingScore = this.computeLightingScore(sample);
    if (lightingScore < 50) reasons.push("Poor lighting conditions");

    const framingScore = this.computeFramingScore(sample);
    if (framingScore < 50) reasons.push("Incorrect framing");

    const motionBlurScore = this.computeMotionBlurScore(sample);
    if (motionBlurScore < 50) reasons.push("Excessive motion blur");

    const duplicatesScore = this.computeDuplicatesScore(sample);
    if (duplicatesScore < 50) reasons.push("Appears to be a duplicate recording");

    const overall = Math.round(
      blurScore * 0.2 +
      handPresenceScore * 0.25 +
      lightingScore * 0.2 +
      framingScore * 0.15 +
      motionBlurScore * 0.1 +
      duplicatesScore * 0.1,
    );

    return {
      overall,
      blurScore,
      handPresenceScore,
      lightingScore,
      framingScore,
      motionBlurScore,
      duplicatesScore,
      passed: overall >= threshold,
      reasons,
    };
  }

  inspectBatch(samples: VideoSample[], threshold?: number): QualityScore[] {
    return samples.map((s) => this.inspect(s, threshold));
  }

  private computeBlurScore(sample: VideoSample): number {
    if (sample.frames.length === 0) return 0;
    if (!sample.frames[0].landmarks) return 50;
    let score = 100;
    for (const frame of sample.frames) {
      const lm = frame.landmarks;
      if (!lm || lm.length < 10) { score -= 5; continue; }
      const dx = lm.map((p) => p.x);
      const dy = lm.map((p) => p.y);
      const variance = computeVariance(dx) + computeVariance(dy);
      if (variance < 0.001) score -= 10;
      if (variance < 0.0005) score -= 15;
    }
    return Math.max(0, Math.min(100, score));
  }

  private computeHandPresenceScore(sample: VideoSample): number {
    if (sample.frames.length === 0) return 0;
    let framesWithHands = 0;
    for (const frame of sample.frames) {
      if (frame.landmarks && frame.landmarks.length >= MIN_LANDMARKS_PER_HAND) {
        framesWithHands++;
      }
    }
    return (framesWithHands / sample.frames.length) * 100;
  }

  private computeLightingScore(sample: VideoSample): number {
    if (sample.frames.length === 0) return 0;
    const brightnesses = sample.frames
      .map((f) => f.brightness)
      .filter((b): b is number => b !== undefined);
    if (brightnesses.length === 0) return 50;
    const avg = brightnesses.reduce((s, b) => s + b, 0) / brightnesses.length;
    if (avg < 0.2) return 20;
    if (avg < 0.4) return 50;
    if (avg > 0.9) return 60;
    return 90;
  }

  private computeFramingScore(sample: VideoSample): number {
    if (sample.frames.length === 0) return 0;
    if (!sample.width || !sample.height) return 50;
    let wellFramed = 0;
    for (const frame of sample.frames) {
      const lm = frame.landmarks;
      if (!lm || lm.length < 5) continue;
      const centerX = lm.reduce((s, p) => s + p.x, 0) / lm.length;
      const centerY = lm.reduce((s, p) => s + p.y, 0) / lm.length;
      const normalizedX = centerX / sample.width;
      const normalizedY = centerY / sample.height;
      if (normalizedX > 0.1 && normalizedX < 0.9 && normalizedY > 0.1 && normalizedY < 0.9) {
        wellFramed++;
      }
    }
    return sample.frames.length > 0 ? (wellFramed / sample.frames.length) * 100 : 0;
  }

  private computeMotionBlurScore(sample: VideoSample): number {
    if (sample.frames.length < 2) return 50;
    const motions = sample.frames
      .map((f) => f.motion)
      .filter((m): m is number => m !== undefined);
    if (motions.length === 0) return 80;
    const avgMotion = motions.reduce((s, m) => s + m, 0) / motions.length;
    if (avgMotion > 1.5) return Math.max(0, 100 - (avgMotion - 1.5) * 40);
    return 90;
  }

  private computeDuplicatesScore(sample: VideoSample): number {
    if (sample.frames.length < 5) return 50;
    let duplicateFrames = 0;
    for (let i = 1; i < sample.frames.length; i++) {
      const prev = sample.frames[i - 1].landmarks;
      const curr = sample.frames[i].landmarks;
      if (!prev || !curr || prev.length < 5 || curr.length < 5) continue;
      const diff = computeAverageDifference(prev, curr);
      if (diff < 0.001) duplicateFrames++;
    }
    if (duplicateFrames > sample.frames.length * 0.5) return 20;
    if (duplicateFrames > sample.frames.length * 0.3) return 50;
    return 90;
  }
}

function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function computeAverageDifference(a: Array<{ x: number; y: number; z: number }>, b: Array<{ x: number; y: number; z: number }>): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += Math.abs(a[i].x - b[i].x) + Math.abs(a[i].y - b[i].y) + Math.abs(a[i].z - b[i].z);
  }
  return sum / len;
}

export const globalQualityInspector = new DatasetQualityInspector();
