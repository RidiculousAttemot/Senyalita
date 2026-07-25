import type { AnimationFrame, LandmarkPoint } from "../types";
import {
  FULL_POSE_CONNECTIONS, HAND_CONNECTIONS,
  FACE_OVAL, FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW,
  FACE_LEFT_EYE, FACE_RIGHT_EYE,
  FACE_NOSE_BRIDGE, FACE_NOSE_TIP,
  FACE_LIPS_OUTER, FACE_LIPS_INNER,
} from "../types";

export interface ExactRendererOptions {
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  backgroundColor: string;
  showDebug: boolean;
}

const POSE_COLOR = "rgba(148, 163, 184, 0.6)";
const POSE_JOINT_COLOR = "rgba(203, 213, 225, 0.6)";
const POSE_LINE_WIDTH = 1.5;
const POSE_JOINT_RADIUS = 2;

const FACE_FILL = "rgba(251, 191, 36, 0.06)";
const FACE_STROKE = "rgba(251, 191, 36, 0.4)";
const FACE_LINE_WIDTH = 1;

const HAND_LINE_WIDTH = 3;
const HAND_JOINT_RADIUS = 4;
const HAND_PALM_RADIUS = 5.5;
const HAND_TIP_RADIUS = 4.5;
const LEFT_HAND_COLOR = "#C0593A";
const RIGHT_HAND_COLOR = "#60A5FA";
const HAND_TIP_COLOR = "#FDE68A";

const DEBUG_COLOR = "rgba(74, 222, 128, 0.9)";
const DEBUG_BG = "rgba(0, 0, 0, 0.55)";

function toPixel(lm: LandmarkPoint, imgW: number, imgH: number): { x: number; y: number } {
  return { x: lm.x * imgW, y: lm.y * imgH };
}

function drawLine(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

function drawArc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPolygon(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, closed: boolean): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
}

export class ExactLandmarkRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: ExactRendererOptions;
  private frameCount = 0;
  private lastFrameTime = 0;
  private measuredFps = 0;
  private driftFrames = 0;

  constructor(canvas: HTMLCanvasElement, options: ExactRendererOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.opts = options;
    this.canvas.width = options.width;
    this.canvas.height = options.height;
  }

  setSize(width: number, height: number): void {
    this.opts.width = width;
    this.opts.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  setImageDimensions(w: number, h: number): void {
    this.opts.imageWidth = w;
    this.opts.imageHeight = h;
  }

  render(frame: AnimationFrame | null, frameIndex: number, totalFrames: number): void {
    const ctx = this.ctx;
    const w = this.opts.width;
    const h = this.opts.height;
    const iw = this.opts.imageWidth;
    const ih = this.opts.imageHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.opts.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    if (!frame) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No animation data", w / 2, h / 2);
      return;
    }

    const scaleX = w / iw;
    const scaleY = h / ih;

    if (frame.poseLandmarks && frame.poseLandmarks.length >= 33) {
      this.drawPose(ctx, frame.poseLandmarks, scaleX, scaleY);
    }

    if (frame.faceLandmarks && frame.faceLandmarks.length >= 50) {
      this.drawFace(ctx, frame.faceLandmarks, scaleX, scaleY);
    }

    for (const hand of frame.landmarks) {
      if (!hand.landmarks || hand.landmarks.length < 21) continue;
      const color = hand.side === "left" ? LEFT_HAND_COLOR : RIGHT_HAND_COLOR;
      this.drawHand(ctx, hand.landmarks, color, scaleX, scaleY);
    }

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.measuredFps = this.measuredFps * 0.9 + (1000 / (now - this.lastFrameTime)) * 0.1;
    }
    this.lastFrameTime = now;
    this.frameCount = frameIndex;

    if (this.opts.showDebug) {
      this.drawDebug(ctx, w, frameIndex, totalFrames);
    }
  }

  private drawPose(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[], sx: number, sy: number): void {
    ctx.strokeStyle = POSE_COLOR;
    ctx.lineWidth = POSE_LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [i, j] of FULL_POSE_CONNECTIONS) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a && b) {
        drawLine(ctx, a.x * sx, a.y * sy, b.x * sx, b.y * sy);
      }
    }

    ctx.fillStyle = POSE_JOINT_COLOR;
    for (const lm of landmarks) {
      if (lm) drawArc(ctx, lm.x * sx, lm.y * sy, POSE_JOINT_RADIUS);
    }
  }

  private drawFace(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[], sx: number, sy: number): void {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.fillStyle = FACE_FILL;
    const oval: Array<{ x: number; y: number }> = [];
    for (const idx of FACE_OVAL) {
      const p = landmarks[idx];
      if (p) oval.push({ x: p.x * sx, y: p.y * sy });
    }
    if (oval.length > 2) {
      ctx.beginPath();
      ctx.moveTo(oval[0].x, oval[0].y);
      for (let i = 1; i < oval.length; i++) ctx.lineTo(oval[i].x, oval[i].y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = FACE_STROKE;
    ctx.lineWidth = FACE_LINE_WIDTH;

    const groups = [FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW, FACE_LEFT_EYE, FACE_RIGHT_EYE, FACE_NOSE_BRIDGE, FACE_LIPS_OUTER, FACE_LIPS_INNER];
    for (const group of groups) {
      const pts: Array<{ x: number; y: number }> = [];
      for (const idx of group) {
        const p = landmarks[idx];
        if (p) pts.push({ x: p.x * sx, y: p.y * sy });
      }
      const closed = group === FACE_LEFT_EYE || group === FACE_RIGHT_EYE || group === FACE_LIPS_OUTER || group === FACE_LIPS_INNER;
      drawPolygon(ctx, pts, closed);
    }

    for (const noseIdx of FACE_NOSE_TIP) {
      const p = landmarks[noseIdx];
      if (p) {
        ctx.fillStyle = FACE_STROKE;
        drawArc(ctx, p.x * sx, p.y * sy, 1.2);
      }
    }

    const leftPupil = landmarks[468];
    const rightPupil = landmarks[473];
    ctx.fillStyle = FACE_STROKE;
    if (leftPupil) drawArc(ctx, leftPupil.x * sx, leftPupil.y * sy, 1.5);
    if (rightPupil) drawArc(ctx, rightPupil.x * sx, rightPupil.y * sy, 1.5);
  }

  private drawHand(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[], color: string, sx: number, sy: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = HAND_LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [i, j] of HAND_CONNECTIONS) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a && b) drawLine(ctx, a.x * sx, a.y * sy, b.x * sx, b.y * sy);
    }

    ctx.fillStyle = color;
    for (const lm of landmarks) {
      if (lm) drawArc(ctx, lm.x * sx, lm.y * sy, HAND_JOINT_RADIUS);
    }

    const palmIndices = [0, 1, 5, 9, 13, 17];
    ctx.fillStyle = color;
    for (const i of palmIndices) {
      if (i < landmarks.length && landmarks[i]) {
        drawArc(ctx, landmarks[i].x * sx, landmarks[i].y * sy, HAND_PALM_RADIUS);
      }
    }

    const tipIndices = [4, 8, 12, 16, 20];
    ctx.fillStyle = HAND_TIP_COLOR;
    for (const i of tipIndices) {
      if (i < landmarks.length && landmarks[i]) {
        drawArc(ctx, landmarks[i].x * sx, landmarks[i].y * sy, HAND_TIP_RADIUS);
      }
    }
  }

  private drawDebug(ctx: CanvasRenderingContext2D, w: number, frameIndex: number, totalFrames: number): void {
    ctx.save();
    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    const lines = [
      `Frame ${frameIndex + 1} / ${totalFrames}`,
      `FPS ${this.measuredFps.toFixed(1)}`,
      `Image ${this.opts.imageWidth}x${this.opts.imageHeight}`,
      `Canvas ${this.opts.width}x${this.opts.height}`,
      `Drift ${this.driftFrames} frames`,
    ];

    lines.forEach((txt, i) => {
      const y = 4 + i * 16;
      ctx.fillStyle = DEBUG_BG;
      ctx.fillRect(4, y, ctx.measureText(txt).width + 8, 14);
      ctx.fillStyle = DEBUG_COLOR;
      ctx.fillText(txt, 8, y + 11);
    });

    ctx.restore();
  }

  setDrift(drift: number): void {
    this.driftFrames = drift;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.opts.width, this.opts.height);
  }

  dispose(): void {
    this.clear();
  }
}