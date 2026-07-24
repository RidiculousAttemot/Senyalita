import type { AnimationFrame, LandmarkPoint } from "../types";
import { HAND_CONNECTIONS } from "../types";
import { drawFullPose, drawStylizedFace, drawFullHand } from "./renderUtils";
import type { RenderStyle } from "./renderUtils";

export interface LandmarkRendererOptions {
  width: number;
  height: number;
  showLabels?: boolean;
  lineWidth?: number;
  jointRadius?: number;
  showLeftHand?: boolean;
  showRightHand?: boolean;
  backgroundColor?: string;
  leftColor?: string;
  rightColor?: string;
}

export class LandmarkCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private opts: Required<LandmarkRendererOptions>;
  private prevPoseLandmarks: LandmarkPoint[] | null = null;
  private prevFaceLandmarks: LandmarkPoint[] | null = null;
  private prevLeftHand: LandmarkPoint[] | null = null;
  private prevRightHand: LandmarkPoint[] | null = null;
  private lerpFactor: number = 0.3;

  constructor(canvas: HTMLCanvasElement, options?: Partial<LandmarkRendererOptions>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = {
      width: options?.width ?? 400,
      height: options?.height ?? 500,
      showLabels: options?.showLabels ?? false,
      lineWidth: options?.lineWidth ?? 2,
      jointRadius: options?.jointRadius ?? 3,
      showLeftHand: options?.showLeftHand ?? true,
      showRightHand: options?.showRightHand ?? true,
      backgroundColor: options?.backgroundColor ?? "#0f172a",
      leftColor: options?.leftColor ?? "#C0593A",
      rightColor: options?.rightColor ?? "#60A5FA",
    };
    this.canvas.width = this.opts.width;
    this.canvas.height = this.opts.height;
  }

  setSize(width: number, height: number): void {
    this.opts.width = width;
    this.opts.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private lerpLandmarks(current: LandmarkPoint[] | null, previous: LandmarkPoint[] | null): LandmarkPoint[] | null {
    if (!current) return previous;
    if (!previous || current.length !== previous.length) {
      this.lerpFactor = 0;
      return current;
    }
    const t = this.lerpFactor;
    return current.map((p, i) => ({
      x: previous[i].x * (1 - t) + p.x * t,
      y: previous[i].y * (1 - t) + p.y * t,
      z: (previous[i].z ?? 0) * (1 - t) + (p.z ?? 0) * t,
    }));
  }

  render(frame: AnimationFrame | null): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = this.opts.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    if (!frame || !frame.landmarks || frame.landmarks.length === 0) {
      this.drawPlaceholder(ctx, w, h);
      return;
    }

    const leftHandEntry = frame.landmarks.find((hand) => hand.side === "left") ?? frame.landmarks[0];
    const rightHandEntry = frame.landmarks.find((hand) => hand.side === "right") ?? (frame.landmarks.length > 1 ? frame.landmarks[1] : null);

    const style: RenderStyle = {
      bodyColor: "#94a3b8",
      jointColor: "#cbd5e1",
      faceColor: "rgba(251,191,36,0.08)",
      faceFeatureColor: "#fbbf24",
      leftHandColor: this.opts.leftColor,
      rightHandColor: this.opts.rightColor,
      lineWidth: this.opts.lineWidth,
      jointRadius: this.opts.jointRadius,
    };

    const wNorm = this.canvas.width;
    const hNorm = this.canvas.height;

    if (frame.poseLandmarks && frame.poseLandmarks.length > 0) {
      const smoothed = this.lerpLandmarks(frame.poseLandmarks, this.prevPoseLandmarks);
      this.prevPoseLandmarks = frame.poseLandmarks;
      drawFullPose(ctx, smoothed ?? frame.poseLandmarks, wNorm, hNorm, style);
    }

    if (frame.faceLandmarks && frame.faceLandmarks.length > 0) {
      const smoothed = this.lerpLandmarks(frame.faceLandmarks, this.prevFaceLandmarks);
      this.prevFaceLandmarks = frame.faceLandmarks;
      drawStylizedFace(ctx, smoothed ?? frame.faceLandmarks, wNorm, hNorm, style);
    }

    if (leftHandEntry && this.opts.showLeftHand) {
      const smoothed = this.lerpLandmarks(leftHandEntry.landmarks, this.prevLeftHand);
      this.prevLeftHand = leftHandEntry.landmarks;
      drawFullHand(ctx, smoothed ?? leftHandEntry.landmarks, style.leftHandColor, w, h, this.opts.lineWidth, this.opts.jointRadius);
    }

    if (rightHandEntry && this.opts.showRightHand) {
      const smoothed = this.lerpLandmarks(rightHandEntry.landmarks, this.prevRightHand);
      this.prevRightHand = rightHandEntry.landmarks;
      drawFullHand(ctx, smoothed ?? rightHandEntry.landmarks, style.rightHandColor, w, h, this.opts.lineWidth, this.opts.jointRadius);
    }

    if (this.opts.showLabels && frame.poseLandmarks) {
      for (let k = 0; k < frame.poseLandmarks.length; k++) {
        const p = frame.poseLandmarks[k];
        if (p) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = "9px monospace";
          ctx.fillText(String(k), p.x * w + 4, p.y * h - 2);
        }
      }
    }
  }

  private drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = "#334155";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No animation data", w / 2, h / 2);
  }

  clear(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.prevPoseLandmarks = null;
    this.prevFaceLandmarks = null;
    this.prevLeftHand = null;
    this.prevRightHand = null;
  }

  dispose(): void {
    this.clear();
    this.ctx = null;
  }
}
