import type { LandmarkPoint } from "../types";
import {
  FULL_POSE_CONNECTIONS, HAND_CONNECTIONS,
  FACE_OVAL, FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW,
  FACE_LEFT_EYE, FACE_RIGHT_EYE,
  FACE_NOSE_BRIDGE, FACE_NOSE_TIP,
  FACE_LIPS_OUTER, FACE_LIPS_INNER,
} from "../types";

export interface RenderStyle {
  bodyColor: string;
  jointColor: string;
  faceColor: string;
  faceFeatureColor: string;
  leftHandColor: string;
  rightHandColor: string;
  lineWidth: number;
  jointRadius: number;
}

export const DEFAULT_STYLE: RenderStyle = {
  bodyColor: "#94a3b8",
  jointColor: "#cbd5e1",
  faceColor: "rgba(251,191,36,0.08)",
  faceFeatureColor: "#fbbf24",
  leftHandColor: "#C0593A",
  rightHandColor: "#60A5FA",
  lineWidth: 2,
  jointRadius: 3,
};

function sx(x: number, w: number, pad: number): number {
  return pad + x * (w - 2 * pad);
}

function sy(y: number, h: number, pad: number): number {
  return pad + y * (h - 2 * pad);
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
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
}

export function drawFullPose(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  w: number, h: number,
  style: RenderStyle = DEFAULT_STYLE,
): void {
  if (!landmarks || landmarks.length < 33) return;
  const pad = 10;

  ctx.strokeStyle = style.bodyColor;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [i, j] of FULL_POSE_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a && b) {
      drawLine(ctx, sx(a.x, w, pad), sy(a.y, h, pad), sx(b.x, w, pad), sy(b.y, h, pad));
    }
  }

  ctx.fillStyle = style.jointColor;
  for (const lm of landmarks) {
    if (lm) {
      drawArc(ctx, sx(lm.x, w, pad), sy(lm.y, h, pad), style.jointRadius);
    }
  }
}

export function drawStylizedFace(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  w: number, h: number,
  style: RenderStyle = DEFAULT_STYLE,
): void {
  if (!landmarks || landmarks.length < 50) return;
  const pad = 10;

  const lm = (idx: number) => {
    const p = landmarks[idx];
    return p ? { x: sx(p.x, w, pad), y: sy(p.y, h, pad) } : null;
  };

  const getPoints = (indices: number[]): Array<{ x: number; y: number }> => {
    const result: Array<{ x: number; y: number }> = [];
    for (const idx of indices) {
      const p = lm(idx);
      if (p) result.push(p);
    }
    return result;
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = style.faceColor;
  const ovalPoints = getPoints(FACE_OVAL);
  if (ovalPoints.length > 2) {
    ctx.beginPath();
    ctx.moveTo(ovalPoints[0].x, ovalPoints[0].y);
    for (let i = 1; i < ovalPoints.length; i++) {
      ctx.lineTo(ovalPoints[i].x, ovalPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = style.faceFeatureColor;
  ctx.lineWidth = 1.5;

  const leftBrow = getPoints(FACE_LEFT_EYEBROW);
  drawPolygon(ctx, leftBrow, false);

  const rightBrow = getPoints(FACE_RIGHT_EYEBROW);
  drawPolygon(ctx, rightBrow, false);

  const leftEye = getPoints(FACE_LEFT_EYE);
  drawPolygon(ctx, leftEye, true);

  const rightEye = getPoints(FACE_RIGHT_EYE);
  drawPolygon(ctx, rightEye, true);

  const noseBridge = getPoints(FACE_NOSE_BRIDGE);
  drawPolygon(ctx, noseBridge, false);

  const noseTip = getPoints(FACE_NOSE_TIP);
  if (noseTip.length >= 2) {
    const mid = lm(1);
    const right = lm(98);
    const left = lm(97);
    if (mid && right && left) {
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      ctx.lineTo(right.x, right.y);
      ctx.moveTo(right.x, right.y);
      ctx.lineTo(left.x, left.y);
      ctx.stroke();
    }
  }

  ctx.lineWidth = 2;
  const lipsOuter = getPoints(FACE_LIPS_OUTER);
  drawPolygon(ctx, lipsOuter, true);

  ctx.lineWidth = 1.2;
  const lipsInner = getPoints(FACE_LIPS_INNER);
  drawPolygon(ctx, lipsInner, true);

  ctx.fillStyle = style.faceFeatureColor;
  ctx.lineWidth = 1;

  const leftPupilIdx = 468;
  const rightPupilIdx = 473;
  const leftPupil = lm(leftPupilIdx);
  const rightPupil = lm(rightPupilIdx);
  if (leftPupil) {
    drawArc(ctx, leftPupil.x, leftPupil.y, 1.5);
  } else if (leftEye.length >= 4) {
    const cx = leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length;
    const cy2 = leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length;
    drawArc(ctx, cx, cy2, 1.2);
  }
  if (rightPupil) {
    drawArc(ctx, rightPupil.x, rightPupil.y, 1.5);
  } else if (rightEye.length >= 4) {
    const cx = rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length;
    const cy2 = rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length;
    drawArc(ctx, cx, cy2, 1.2);
  }
}

export function drawFullHand(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  color: string,
  w: number, h: number,
  lineWidth: number = 2,
  jointRadius: number = 3,
): void {
  if (!landmarks || landmarks.length < 21) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [i, j] of HAND_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a && b) {
      drawLine(ctx, a.x * w, a.y * h, b.x * w, b.y * h);
    }
  }

  ctx.fillStyle = color;
  for (const lm of landmarks) {
    if (lm) {
      drawArc(ctx, lm.x * w, lm.y * h, jointRadius);
    }
  }

  const palmIndices = [0, 1, 5, 9, 13, 17];
  ctx.fillStyle = color;
  for (const i of palmIndices) {
    if (i < landmarks.length && landmarks[i]) {
      drawArc(ctx, landmarks[i].x * w, landmarks[i].y * h, jointRadius + 1.5);
    }
  }

  const tipIndices = [4, 8, 12, 16, 20];
  ctx.fillStyle = "#fde68a";
  for (const i of tipIndices) {
    if (i < landmarks.length && landmarks[i]) {
      drawArc(ctx, landmarks[i].x * w, landmarks[i].y * h, jointRadius + 0.5);
    }
  }
}

export function drawAllHands(
  ctx: CanvasRenderingContext2D,
  frameLandmarks: Array<{ landmarks: LandmarkPoint[]; side?: string }>,
  w: number, h: number,
  style: RenderStyle = DEFAULT_STYLE,
): void {
  for (const hand of frameLandmarks) {
    const color = hand.side === "left" ? style.leftHandColor : style.rightHandColor;
    drawFullHand(ctx, hand.landmarks, color, w, h, style.lineWidth, style.jointRadius);
  }
}
