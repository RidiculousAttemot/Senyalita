import type { AnimationFrame, LandmarkPoint } from "../types";
import { HAND_CONNECTIONS } from "../types";

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

    const leftHand = frame.landmarks[0];
    const rightHand = frame.landmarks.length > 1 ? frame.landmarks[1] : null;

    if (leftHand && this.opts.showLeftHand) {
      this.drawHand(ctx, leftHand.landmarks, this.opts.leftColor);
    }
    if (rightHand && this.opts.showRightHand) {
      this.drawHand(ctx, rightHand.landmarks, this.opts.rightColor);
    }
  }

  private drawHand(
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[],
    color: string,
  ): void {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.strokeStyle = color;
    ctx.lineWidth = this.opts.lineWidth;
    ctx.lineCap = "round";

    for (const [i, j] of HAND_CONNECTIONS) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }
    }

    ctx.fillStyle = color;
    for (let k = 0; k < landmarks.length; k++) {
      const p = landmarks[k];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, this.opts.jointRadius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    if (this.opts.showLabels) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      for (let k = 0; k < landmarks.length; k++) {
        const p = landmarks[k];
        if (p) {
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
  }

  dispose(): void {
    this.clear();
    this.ctx = null;
  }
}
