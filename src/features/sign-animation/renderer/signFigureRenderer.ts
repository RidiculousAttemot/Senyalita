import type { LandmarkPoint } from "../types";
import {
  FACE_OVAL, FACE_LEFT_EYE, FACE_RIGHT_EYE,
  FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW,
  FACE_LIPS_OUTER,
} from "../types";

export interface SignFigurePalette {
  body: string;
  bodyFill: string;
  ink: string;
  skin: string;
  muted: string;
}

export const WARM_FIGURE_PALETTE: SignFigurePalette = {
  body: "#E04A38",
  bodyFill: "rgba(224,74,56,0.08)",
  ink: "#7F1D1D",
  skin: "#FBEFE4",
  muted: "rgba(127,29,29,0.35)",
};

export const CONTRAST_FIGURE_PALETTE: SignFigurePalette = {
  body: "#FFFFFF",
  bodyFill: "rgba(255,255,255,0.10)",
  ink: "#FFFFFF",
  skin: "#000000",
  muted: "rgba(255,255,255,0.45)",
};

const FINGERS: { chain: number[]; color: string }[] = [
  { chain: [0, 1, 2, 3, 4], color: "#F0912D" },
  { chain: [0, 5, 6, 7, 8], color: "#2F80ED" },
  { chain: [0, 9, 10, 11, 12], color: "#27AE60" },
  { chain: [0, 13, 14, 15, 16], color: "#9B51E0" },
  { chain: [0, 17, 18, 19, 20], color: "#00B8C4" },
];

const PALM_RING = [0, 5, 9, 13, 17];

/**
 * Pose landmarks 25-32 (knees, ankles, feet) are excluded everywhere below.
 * Source clips are filmed from the waist up, so MediaPipe extrapolates those
 * points far outside the frame (measured y up to 1.74 where valid range is
 * 0-1). Including them in the bounding box collapses the real upper body into
 * a fraction of the canvas.
 */
const UPPER_BODY = {
  nose: 0,
  earL: 7, earR: 8,
  shoulderL: 11, shoulderR: 12,
  elbowL: 13, elbowR: 14,
  wristL: 15, wristR: 16,
  hipL: 23, hipR: 24,
  kneeL: 25, kneeR: 26,
} as const;

const ARM_CHAINS: [number, number][] = [
  [UPPER_BODY.shoulderL, UPPER_BODY.elbowL],
  [UPPER_BODY.elbowL, UPPER_BODY.wristL],
  [UPPER_BODY.shoulderR, UPPER_BODY.elbowR],
  [UPPER_BODY.elbowR, UPPER_BODY.wristR],
];

export interface SignFigureOptions {
  palette?: SignFigurePalette;
  debug?: boolean;
  fps?: number;
}

interface Transform {
  toX: (x: number) => number;
  toY: (y: number) => number;
  unit: number;
}

export function drawSignFigure(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[] | undefined,
  face: LandmarkPoint[] | undefined,
  leftHand: LandmarkPoint[],
  rightHand: LandmarkPoint[],
  w: number,
  h: number,
  options?: SignFigureOptions,
): void {
  const palette = options?.palette ?? WARM_FIGURE_PALETTE;

  const alignedLeft = alignHandToWrist(leftHand, pose, UPPER_BODY.wristL);
  const alignedRight = alignHandToWrist(rightHand, pose, UPPER_BODY.wristR);

  const head = headGeometry(pose, face);
  const t = computeTransform(pose, face, alignedLeft, alignedRight, head, w, h);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 0;

  if (pose && pose.length >= 25) {
    drawLegStubs(ctx, pose, t, palette);
    drawNeck(ctx, pose, head, t, palette);
    drawTorso(ctx, pose, t, palette);
    drawArms(ctx, pose, t, palette);
  }

  drawHead(ctx, face, head, t, palette);

  drawHand(ctx, alignedLeft, t);
  drawHand(ctx, alignedRight, t);

  if (options?.debug) {
    drawDebugOverlay(ctx, pose, alignedLeft, alignedRight, t, w, options.fps ?? 0);
  }
}

function alignHandToWrist(
  hand: LandmarkPoint[],
  pose: LandmarkPoint[] | undefined,
  wristIdx: number,
): LandmarkPoint[] {
  if (hand.length < 21 || !pose) return hand;
  const wrist = pose[wristIdx];
  const handRoot = hand[0];
  if (!wrist || !handRoot) return hand;
  const dx = wrist.x - handRoot.x;
  const dy = wrist.y - handRoot.y;
  if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return hand;
  return hand.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z }));
}

interface HeadGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  detailed: boolean;
}

function headGeometry(
  pose: LandmarkPoint[] | undefined,
  face: LandmarkPoint[] | undefined,
): HeadGeometry | null {
  if (face && face.length >= 468) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const i of FACE_OVAL) {
      const p = face[i];
      if (!p) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (!isFinite(minX)) return null;
    return {
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      rx: (maxX - minX) / 2, ry: (maxY - minY) / 2,
      detailed: true,
    };
  }

  const nose = pose?.[UPPER_BODY.nose];
  if (!nose) return null;
  const earL = pose?.[UPPER_BODY.earL];
  const earR = pose?.[UPPER_BODY.earR];
  const rx = earL && earR ? Math.max(Math.abs(earL.x - earR.x) / 2, 0.03) : 0.075;
  const ry = rx * 1.3;
  return { cx: nose.x, cy: nose.y - ry * 0.15, rx, ry, detailed: false };
}

function computeTransform(
  pose: LandmarkPoint[] | undefined,
  face: LandmarkPoint[] | undefined,
  leftHand: LandmarkPoint[],
  rightHand: LandmarkPoint[],
  head: HeadGeometry | null,
  w: number,
  h: number,
): Transform {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const add = (p: LandmarkPoint | undefined) => {
    if (!p) return;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };

  if (pose) {
    for (let i = 0; i <= UPPER_BODY.hipR; i++) add(pose[i]);
  }
  if (face) {
    for (const i of FACE_OVAL) add(face[i]);
  }
  for (const p of leftHand) add(p);
  for (const p of rightHand) add(p);
  // The drawn head reaches past the nose landmark, so frame its full extent
  // or the crown gets clipped off the top of the stage.
  if (head) {
    add({ x: head.cx - head.rx, y: head.cy - head.ry, z: 0 });
    add({ x: head.cx + head.rx, y: head.cy + head.ry, z: 0 });
  }

  if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

  const pad = 0.08;
  const boxW = Math.max(maxX - minX, 0.01);
  const boxH = Math.max(maxY - minY, 0.01);
  const scale = Math.min((1 - 2 * pad) / boxW, (1 - 2 * pad) / boxH, 2.6);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    toX: (x: number) => ((x - cx) * scale + 0.5) * w,
    toY: (y: number) => ((y - cy) * scale + 0.5) * h,
    unit: scale * Math.min(w, h),
  };
}

function stroke(
  ctx: CanvasRenderingContext2D,
  a: LandmarkPoint, b: LandmarkPoint,
  t: Transform, width: number, color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(t.toX(a.x), t.toY(a.y));
  ctx.lineTo(t.toX(b.x), t.toY(b.y));
  ctx.stroke();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  pts: LandmarkPoint[],
  t: Transform,
): void {
  ctx.beginPath();
  ctx.moveTo(t.toX(pts[0].x), t.toY(pts[0].y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(t.toX(pts[i].x), t.toY(pts[i].y));
  ctx.closePath();
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[],
  t: Transform,
  palette: SignFigurePalette,
): void {
  const sl = pose[UPPER_BODY.shoulderL];
  const sr = pose[UPPER_BODY.shoulderR];
  const hl = pose[UPPER_BODY.hipL];
  const hr = pose[UPPER_BODY.hipR];
  if (!sl || !sr || !hl || !hr) return;

  polygon(ctx, [sl, sr, hr, hl], t);
  ctx.fillStyle = palette.bodyFill;
  ctx.fill();
  ctx.strokeStyle = palette.body;
  ctx.lineWidth = t.unit * 0.018;
  ctx.stroke();
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[],
  t: Transform,
  palette: SignFigurePalette,
): void {
  for (const [i, j] of ARM_CHAINS) {
    const a = pose[i], b = pose[j];
    if (a && b) stroke(ctx, a, b, t, t.unit * 0.018, palette.body);
  }
}

/**
 * Hips-to-knees only, fading to transparent: the knee estimate is already
 * unreliable for waist-up capture, and anything below it is pure extrapolation.
 */
function drawLegStubs(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[],
  t: Transform,
  palette: SignFigurePalette,
): void {
  const pairs: [number, number][] = [
    [UPPER_BODY.hipL, UPPER_BODY.kneeL],
    [UPPER_BODY.hipR, UPPER_BODY.kneeR],
  ];
  for (const [hipIdx, kneeIdx] of pairs) {
    const hip = pose[hipIdx];
    const knee = pose[kneeIdx];
    if (!hip || !knee) continue;
    const x1 = t.toX(hip.x), y1 = t.toY(hip.y);
    const x2 = t.toX(knee.x), y2 = t.toY(knee.y);
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, palette.body);
    grad.addColorStop(1, "rgba(224,74,56,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = t.unit * 0.016;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

/**
 * MediaPipe gives no neck landmark, so head and shoulders otherwise render as
 * two disconnected pieces. Drawn before the torso so the shoulder line covers
 * its base.
 */
function drawNeck(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[],
  head: HeadGeometry | null,
  t: Transform,
  palette: SignFigurePalette,
): void {
  const sl = pose[UPPER_BODY.shoulderL];
  const sr = pose[UPPER_BODY.shoulderR];
  if (!sl || !sr || !head) return;

  stroke(
    ctx,
    { x: (sl.x + sr.x) / 2, y: (sl.y + sr.y) / 2, z: 0 },
    { x: head.cx, y: head.cy + head.ry * 0.75, z: 0 },
    t,
    Math.min(t.unit * 0.045, head.rx * t.unit * 0.75),
    palette.body,
  );
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  face: LandmarkPoint[] | undefined,
  head: HeadGeometry | null,
  t: Transform,
  palette: SignFigurePalette,
): void {
  if (!head) return;
  if (head.detailed && face) {
    drawDetailedFace(ctx, face, t, palette);
    return;
  }
  drawSyntheticHead(ctx, head, t, palette);
}

function drawDetailedFace(
  ctx: CanvasRenderingContext2D,
  face: LandmarkPoint[],
  t: Transform,
  palette: SignFigurePalette,
): void {
  const oval = collect(face, FACE_OVAL);
  if (oval.length > 2) {
    polygon(ctx, oval, t);
    ctx.fillStyle = palette.skin;
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = t.unit * 0.011;
    ctx.stroke();
  }

  ctx.fillStyle = palette.ink;
  // Brow index lists interleave the upper and lower edge, so the raw order
  // self-intersects; the hull recovers a clean filled shape.
  for (const brow of [FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW]) {
    const pts = convexHull(collect(face, brow));
    if (pts.length > 2) { polygon(ctx, pts, t); ctx.fill(); }
  }

  for (const eye of [FACE_LEFT_EYE, FACE_RIGHT_EYE]) {
    const pts = collect(face, eye);
    if (pts.length > 2) { polygon(ctx, pts, t); ctx.fill(); }
  }

  const lips = collect(face, FACE_LIPS_OUTER);
  if (lips.length > 2) { polygon(ctx, lips, t); ctx.fill(); }
}

function drawSyntheticHead(
  ctx: CanvasRenderingContext2D,
  head: HeadGeometry,
  t: Transform,
  palette: SignFigurePalette,
): void {
  const cx = t.toX(head.cx);
  const cy = t.toY(head.cy);
  const rx = head.rx * t.unit;
  const ry = head.ry * t.unit;

  ctx.fillStyle = palette.skin;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = t.unit * 0.011;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const eyeDx = rx * 0.42;
  const eyeY = cy - ry * 0.12;
  ctx.fillStyle = palette.ink;
  for (const sx of [-eyeDx, eyeDx]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx, eyeY, rx * 0.15, ry * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = t.unit * 0.013;
  ctx.strokeStyle = palette.ink;
  for (const sx of [-eyeDx, eyeDx]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx - rx * 0.2, eyeY - ry * 0.26);
    ctx.lineTo(cx + sx + rx * 0.2, eyeY - ry * 0.3);
    ctx.stroke();
  }

  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.45, rx * 0.24, ry * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  lm: LandmarkPoint[],
  t: Transform,
): void {
  if (lm.length < 21) return;

  const palm = collect(lm, PALM_RING);
  if (palm.length > 2) {
    polygon(ctx, palm, t);
    ctx.fillStyle = "rgba(127,29,29,0.10)";
    ctx.fill();
  }

  for (const { chain, color } of FINGERS) {
    ctx.strokeStyle = color;
    for (let i = 1; i < chain.length; i++) {
      const a = lm[chain[i - 1]], b = lm[chain[i]];
      if (!a || !b) continue;
      ctx.lineWidth = t.unit * (0.013 - (i - 1) * 0.0018);
      ctx.beginPath();
      ctx.moveTo(t.toX(a.x), t.toY(a.y));
      ctx.lineTo(t.toX(b.x), t.toY(b.y));
      ctx.stroke();
    }
    const tip = lm[chain[chain.length - 1]];
    if (tip) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.toX(tip.x), t.toY(tip.y), t.unit * 0.007, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function collect(source: LandmarkPoint[], indices: number[]): LandmarkPoint[] {
  const out: LandmarkPoint[] = [];
  for (const i of indices) {
    const p = source[i];
    if (p) out.push(p);
  }
  return out;
}

function convexHull(pts: LandmarkPoint[]): LandmarkPoint[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const cross = (o: LandmarkPoint, a: LandmarkPoint, b: LandmarkPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const build = (source: LandmarkPoint[]): LandmarkPoint[] => {
    const chain: LandmarkPoint[] = [];
    for (const p of source) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) {
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };

  return [...build(sorted), ...build([...sorted].reverse())];
}

function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[] | undefined,
  leftHand: LandmarkPoint[],
  rightHand: LandmarkPoint[],
  t: Transform,
  w: number,
  fps: number,
): void {
  ctx.save();
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  const lines = [
    `unit: ${t.unit.toFixed(1)}`,
    `pose: ${pose?.length ?? 0}`,
    `hands: L${leftHand.length} R${rightHand.length}`,
    `fps: ${fps.toFixed(1)}`,
  ];
  lines.forEach((txt, i) => {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(4, 4 + i * 16, ctx.measureText(txt).width + 8, 14);
    ctx.fillStyle = "#4ade80";
    ctx.fillText(txt, 8, 15 + i * 16);
  });

  if (pose) {
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(34,197,94,0.75)";
    for (let i = 0; i <= UPPER_BODY.hipR; i++) {
      const p = pose[i];
      if (!p) continue;
      ctx.fillText(`${i}`, t.toX(p.x), t.toY(p.y) - 5);
    }
  }
  ctx.restore();
}
