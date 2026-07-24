import type { LandmarkPoint, NonManualFeatures, AvatarTheme } from "../types";
import {
  FULL_POSE_CONNECTIONS, HAND_CONNECTIONS,
  FACE_OVAL, FACE_LEFT_EYE, FACE_RIGHT_EYE,
  FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW,
  FACE_NOSE_BRIDGE, FACE_NOSE_TIP,
  FACE_LIPS_OUTER, FACE_LIPS_INNER,
} from "../types";

export interface ReconstructedRig {
  pelvis: LandmarkPoint;
  lowerSpine: LandmarkPoint;
  chest: LandmarkPoint;
  neck: LandmarkPoint;
  headCenter: LandmarkPoint;
  headRadius: number;

  leftShoulder: LandmarkPoint;
  leftElbow: LandmarkPoint;
  leftWrist: LandmarkPoint;
  rightShoulder: LandmarkPoint;
  rightElbow: LandmarkPoint;
  rightWrist: LandmarkPoint;

  leftHip: LandmarkPoint;
  leftKnee: LandmarkPoint;
  leftAnkle: LandmarkPoint;
  leftFootTip: LandmarkPoint;
  rightHip: LandmarkPoint;
  rightKnee: LandmarkPoint;
  rightAnkle: LandmarkPoint;
  rightFootTip: LandmarkPoint;

  face: FaceState;
  leftHand: LandmarkPoint[];
  rightHand: LandmarkPoint[];
}

export interface FaceState {
  center: LandmarkPoint;
  radius: number;
  leftEye: LandmarkPoint;
  rightEye: LandmarkPoint;
  eyeOpenness: number;
  leftBrowRaise: number;
  rightBrowRaise: number;
  noseTip: LandmarkPoint;
  noseRoot: LandmarkPoint;
  mouthCenter: LandmarkPoint;
  mouthOpen: number;
  mouthWidth: number;
  jawLeft: LandmarkPoint;
  jawRight: LandmarkPoint;
  earLeft: LandmarkPoint;
  earRight: LandmarkPoint;
  yaw: number;
  pitch: number;
  roll: number;
}

export function reconstructPose(
  pose: LandmarkPoint[],
  face?: LandmarkPoint[],
  leftHand?: LandmarkPoint[],
  rightHand?: LandmarkPoint[],
): ReconstructedRig {
  const getPose = (idx: number, fb?: Partial<LandmarkPoint>): LandmarkPoint => {
    const p = pose?.[idx];
    return p ?? { x: 0.5, y: 0.5, z: 0, ...fb };
  };

  const avg2 = (a: LandmarkPoint, b: LandmarkPoint): LandmarkPoint => ({
    x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
  });
  const lerp = (a: LandmarkPoint, b: LandmarkPoint, t: number): LandmarkPoint => ({
    x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
  });

  const pelvis = avg2(getPose(23, { x: 0.45, y: 0.55 }), getPose(24, { x: 0.55, y: 0.55 }));
  const leftHip = getPose(23, { x: 0.42, y: 0.55 });
  const rightHip = getPose(24, { x: 0.58, y: 0.55 });
  const leftKnee = getPose(25, { x: 0.40, y: 0.72 });
  const rightKnee = getPose(26, { x: 0.60, y: 0.72 });
  const leftAnkle = getPose(27, { x: 0.38, y: 0.88 });
  const rightAnkle = getPose(28, { x: 0.62, y: 0.88 });
  const leftFootTip = getPose(31, { x: 0.38, y: 0.95 });
  const rightFootTip = getPose(32, { x: 0.62, y: 0.95 });

  const leftShoulder = getPose(11, { x: 0.32, y: 0.28 });
  const rightShoulder = getPose(12, { x: 0.68, y: 0.28 });
  const leftElbow = getPose(13, { x: 0.26, y: 0.45 });
  const rightElbow = getPose(14, { x: 0.74, y: 0.45 });
  const leftWrist = getPose(15, { x: 0.22, y: 0.62 });
  const rightWrist = getPose(16, { x: 0.78, y: 0.62 });

  const shoulderMid = avg2(leftShoulder, rightShoulder);
  const nose = getPose(0, { x: 0.5, y: 0.15 });
  const chest = lerp(pelvis, shoulderMid, 0.6);
  const neck = lerp(shoulderMid, nose, 0.35);
  const headCenter = avg2(nose, avg2(
    getPose(7, { x: 0.43, y: 0.14 }),
    getPose(8, { x: 0.57, y: 0.14 }),
  ));

  const headRadius = face && face.length > 10
    ? computeHeadRadius(face)
    : 0.07;

  const faceState = face && face.length > 10
    ? reconstructFace(face, headRadius)
    : defaultFaceState(headCenter, headRadius);

  return {
    pelvis, lowerSpine: lerp(pelvis, chest, 0.35), chest, neck, headCenter, headRadius,
    leftShoulder, leftElbow, leftWrist,
    rightShoulder, rightElbow, rightWrist,
    leftHip, leftKnee, leftAnkle, leftFootTip,
    rightHip, rightKnee, rightAnkle, rightFootTip,
    face: faceState,
    leftHand: leftHand ?? [],
    rightHand: rightHand ?? [],
  };
}

function computeHeadRadius(face: LandmarkPoint[]): number {
  let cx = 0, cy = 0, count = 0;
  for (const i of FACE_OVAL) {
    const p = face[i]; if (!p) continue;
    cx += p.x; cy += p.y; count++;
  }
  if (count === 0) return 0.07;
  cx /= count; cy /= count;
  let maxR = 0;
  for (const i of FACE_OVAL) {
    const p = face[i]; if (!p) continue;
    const dx = p.x - cx, dy = p.y - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > maxR) maxR = r;
  }
  return Math.max(maxR, 0.04);
}

function reconstructFace(face: LandmarkPoint[], headRadius: number): FaceState {
  const avg = (indices: number[]): LandmarkPoint => {
    let x = 0, y = 0, z = 0, c = 0;
    for (const i of indices) { const p = face[i]; if (!p) continue; x += p.x; y += p.y; z += p.z; c++; }
    return c > 0 ? { x: x / c, y: y / c, z: z / c } : { x: 0.5, y: 0.5, z: 0 };
  };

  const leftEye = avg(FACE_LEFT_EYE);
  const rightEye = avg(FACE_RIGHT_EYE);
  const leftBrow = avg(FACE_LEFT_EYEBROW);
  const rightBrow = avg(FACE_RIGHT_EYEBROW);
  const faceCenter = avg(FACE_OVAL);

  const noseTip = face[1] ?? faceCenter;
  const noseRoot = face[168] ?? faceCenter;

  const mouthUpper = face[13] ?? faceCenter;
  const mouthLower = face[14] ?? faceCenter;
  const mouthLeft = face[61] ?? faceCenter;
  const mouthRight = face[291] ?? faceCenter;

  const jawLeft = face[172] ?? face[58] ?? leftEye;
  const jawRight = face[397] ?? face[288] ?? rightEye;
  const earLeft = face[234] ?? face[127] ?? avg([7]);
  const earRight = face[454] ?? face[356] ?? avg([8]);

  const eyeOpenLeft = computeEyeOpenness(face, FACE_LEFT_EYE);
  const eyeOpenRight = computeEyeOpenness(face, FACE_RIGHT_EYE);

  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const noseOffsetX = noseTip.x - faceCenter.x;
  const noseOffsetY = noseTip.y - faceCenter.y;
  const yaw = Math.max(-1, Math.min(1, noseOffsetX / Math.max(headRadius, 0.01) * 1.5));
  const pitch = Math.max(-1, Math.min(1, -noseOffsetY / Math.max(headRadius, 0.01) * 1.5));

  return {
    center: faceCenter,
    radius: headRadius,
    leftEye, rightEye,
    eyeOpenness: Math.min(eyeOpenLeft, eyeOpenRight),
    leftBrowRaise: distance(leftBrow, leftEye) / Math.max(headRadius, 0.01),
    rightBrowRaise: distance(rightBrow, rightEye) / Math.max(headRadius, 0.01),
    noseTip, noseRoot,
    mouthCenter: avg(FACE_LIPS_INNER),
    mouthOpen: Math.min(distance(mouthUpper, mouthLower) / Math.max(headRadius, 0.01), 1.5),
    mouthWidth: distance(mouthLeft, mouthRight),
    jawLeft, jawRight, earLeft, earRight,
    yaw, pitch, roll,
  };
}

function computeEyeOpenness(face: LandmarkPoint[], eyeIndices: number[]): number {
  const vertical: number[] = [];
  for (let i = 0; i < eyeIndices.length; i++) {
    for (let j = i + 1; j < eyeIndices.length; j++) {
      const a = face[eyeIndices[i]], b = face[eyeIndices[j]];
      if (!a || !b) continue;
      if (Math.abs(a.x - b.x) / Math.max(Math.abs(a.y - b.y) + 0.001, 0.001) < 0.5) {
        vertical.push(distance(a, b));
      }
    }
  }
  if (vertical.length === 0) return 1;
  vertical.sort((a, b) => b - a);
  const ratio = vertical[0] / (vertical.length > 1 ? vertical[1] : vertical[0]);
  return Math.min(1, ratio * 1.5);
}

function distance(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function defaultFaceState(center: LandmarkPoint, radius: number): FaceState {
  return {
    center,
    radius,
    leftEye: { x: center.x - radius * 0.3, y: center.y - radius * 0.1, z: 0 },
    rightEye: { x: center.x + radius * 0.3, y: center.y - radius * 0.1, z: 0 },
    eyeOpenness: 1,
    leftBrowRaise: 0.5, rightBrowRaise: 0.5,
    noseTip: { x: center.x, y: center.y + radius * 0.2, z: 0 },
    noseRoot: { x: center.x, y: center.y - radius * 0.05, z: 0 },
    mouthCenter: { x: center.x, y: center.y + radius * 0.4, z: 0 },
    mouthOpen: 0,
    mouthWidth: radius * 0.5,
    jawLeft: { x: center.x - radius * 0.7, y: center.y + radius * 0.3, z: 0 },
    jawRight: { x: center.x + radius * 0.7, y: center.y + radius * 0.3, z: 0 },
    earLeft: { x: center.x - radius * 0.8, y: center.y, z: 0 },
    earRight: { x: center.x + radius * 0.8, y: center.y, z: 0 },
    yaw: 0, pitch: 0, roll: 0,
  };
}

export function smoothRig(
  current: ReconstructedRig,
  prev: ReconstructedRig | null,
  bodyAlpha: number = 0.12,
  armAlpha: number = 0.2,
  handAlpha: number = 0.3,
): ReconstructedRig {
  if (!prev) return current;

  const smooth = (c: LandmarkPoint, p: LandmarkPoint, a: number): LandmarkPoint => ({
    x: p.x + (c.x - p.x) * (1 - a),
    y: p.y + (c.y - p.y) * (1 - a),
    z: p.z + (c.z - p.z) * (1 - a),
  });
  const sv = (c: number, p: number, a: number): number => p + (c - p) * (1 - a);

  return {
    pelvis: smooth(current.pelvis, prev.pelvis, bodyAlpha),
    lowerSpine: smooth(current.lowerSpine, prev.lowerSpine, bodyAlpha),
    chest: smooth(current.chest, prev.chest, bodyAlpha),
    neck: smooth(current.neck, prev.neck, bodyAlpha),
    headCenter: smooth(current.headCenter, prev.headCenter, bodyAlpha),
    headRadius: sv(current.headRadius, prev.headRadius, bodyAlpha),

    leftShoulder: smooth(current.leftShoulder, prev.leftShoulder, armAlpha),
    leftElbow: smooth(current.leftElbow, prev.leftElbow, armAlpha),
    leftWrist: smooth(current.leftWrist, prev.leftWrist, armAlpha),
    rightShoulder: smooth(current.rightShoulder, prev.rightShoulder, armAlpha),
    rightElbow: smooth(current.rightElbow, prev.rightElbow, armAlpha),
    rightWrist: smooth(current.rightWrist, prev.rightWrist, armAlpha),

    leftHip: smooth(current.leftHip, prev.leftHip, bodyAlpha),
    leftKnee: smooth(current.leftKnee, prev.leftKnee, bodyAlpha),
    leftAnkle: smooth(current.leftAnkle, prev.leftAnkle, bodyAlpha),
    leftFootTip: smooth(current.leftFootTip, prev.leftFootTip, bodyAlpha),
    rightHip: smooth(current.rightHip, prev.rightHip, bodyAlpha),
    rightKnee: smooth(current.rightKnee, prev.rightKnee, bodyAlpha),
    rightAnkle: smooth(current.rightAnkle, prev.rightAnkle, bodyAlpha),
    rightFootTip: smooth(current.rightFootTip, prev.rightFootTip, bodyAlpha),

    face: {
      center: smooth(current.face.center, prev.face.center, bodyAlpha),
      radius: sv(current.face.radius, prev.face.radius, bodyAlpha),
      leftEye: smooth(current.face.leftEye, prev.face.leftEye, armAlpha),
      rightEye: smooth(current.face.rightEye, prev.face.rightEye, armAlpha),
      eyeOpenness: sv(current.face.eyeOpenness, prev.face.eyeOpenness, bodyAlpha),
      leftBrowRaise: sv(current.face.leftBrowRaise, prev.face.leftBrowRaise, armAlpha),
      rightBrowRaise: sv(current.face.rightBrowRaise, prev.face.rightBrowRaise, armAlpha),
      noseTip: smooth(current.face.noseTip, prev.face.noseTip, armAlpha),
      noseRoot: smooth(current.face.noseRoot, prev.face.noseRoot, armAlpha),
      mouthCenter: smooth(current.face.mouthCenter, prev.face.mouthCenter, armAlpha),
      mouthOpen: sv(current.face.mouthOpen, prev.face.mouthOpen, bodyAlpha),
      mouthWidth: sv(current.face.mouthWidth, prev.face.mouthWidth, bodyAlpha),
      jawLeft: smooth(current.face.jawLeft, prev.face.jawLeft, bodyAlpha),
      jawRight: smooth(current.face.jawRight, prev.face.jawRight, bodyAlpha),
      earLeft: smooth(current.face.earLeft, prev.face.earLeft, bodyAlpha),
      earRight: smooth(current.face.earRight, prev.face.earRight, bodyAlpha),
      yaw: sv(current.face.yaw, prev.face.yaw, bodyAlpha),
      pitch: sv(current.face.pitch, prev.face.pitch, bodyAlpha),
      roll: sv(current.face.roll, prev.face.roll, bodyAlpha),
    },

    leftHand: smoothHand(current.leftHand, prev.leftHand, handAlpha),
    rightHand: smoothHand(current.rightHand, prev.rightHand, handAlpha),
  };
}

function smoothHand(c: LandmarkPoint[], p: LandmarkPoint[], a: number): LandmarkPoint[] {
  if (c.length === 0 || p.length === 0) return c;
  const len = Math.min(c.length, p.length);
  const r: LandmarkPoint[] = [];
  for (let i = 0; i < len; i++)
    r.push({ x: p[i].x + (c[i].x - p[i].x) * (1 - a), y: p[i].y + (c[i].y - p[i].y) * (1 - a), z: p[i].z + (c[i].z - p[i].z) * (1 - a) });
  for (let i = len; i < c.length; i++) r.push(c[i]);
  return r;
}

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  rig: ReconstructedRig,
  w: number, h: number,
  theme: AvatarTheme,
  nonManual?: NonManualFeatures,
): void {
  const colors = getThemeColors(theme);
  const padFrac = 0.04;
  const bounds = computeBounds(rig);
  const avW = Math.max(bounds.maxX - bounds.minX, 0.01);
  const avH = Math.max(bounds.maxY - bounds.minY, 0.01);
  const avCx = (bounds.minX + bounds.maxX) / 2;
  const avCy = (bounds.minY + bounds.maxY) / 2;
  const s = Math.min((1 - 2 * padFrac) / avW, (1 - 2 * padFrac) / avH, 2);

  const toX = (x: number) => ((x - avCx) * s + 0.5) * w;
  const toY = (y: number) => ((y - avCy) * s + 0.5) * h;
  const toW = (b: number) => Math.max(0.5, b * s * Math.min(w, h));

  ctx.shadowBlur = 0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawShadow(ctx, rig, toX, toY, toW);
  drawLegs(ctx, rig, toX, toY, toW, colors);
  drawPelvis(ctx, rig, toX, toY, toW, colors);
  drawTorso(ctx, rig, toX, toY, toW, colors);
  drawArms(ctx, rig, toX, toY, toW, colors);
  drawHands(ctx, rig, toX, toY, toW, colors);
  drawNeck(ctx, rig, toX, toY, toW, colors);
  drawHead(ctx, rig, toX, toY, toW, colors, nonManual);
}

function computeBounds(rig: ReconstructedRig): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = [
    rig.pelvis, rig.lowerSpine, rig.chest, rig.neck, rig.headCenter,
    rig.leftShoulder, rig.leftElbow, rig.leftWrist,
    rig.rightShoulder, rig.rightElbow, rig.rightWrist,
    rig.leftHip, rig.leftKnee, rig.leftAnkle, rig.leftFootTip,
    rig.rightHip, rig.rightKnee, rig.rightAnkle, rig.rightFootTip,
    rig.face.leftEye, rig.face.rightEye, rig.face.noseTip, rig.face.mouthCenter,
    rig.face.jawLeft, rig.face.jawRight,
    rig.face.center,
  ];
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  for (const p of pts) {
    if (p.x < mnX) mnX = p.x;
    if (p.x > mxX) mxX = p.x;
    if (p.y < mnY) mnY = p.y;
    if (p.y > mxY) mxY = p.y;
  }
  if (!isFinite(mnX)) { mnX = 0; mxX = 1; mnY = 0; mxY = 1; }
  return { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
}

interface ThemeColors {
  body: string; arm: string; leg: string; joint: string;
  leftHand: string; rightHand: string;
  faceFill: string; faceStroke: string; glow: boolean;
}

function getThemeColors(theme: AvatarTheme): ThemeColors {
  switch (theme) {
    case "minimal":
      return { body: "#60A5FA", arm: "#60A5FA", leg: "#60A5FA", joint: "#93C5FD", leftHand: "#C0593A", rightHand: "#60A5FA", faceFill: "rgba(96,165,250,0.15)", faceStroke: "#60A5FA", glow: false };
    case "skeleton":
      return { body: "#FBBF24", arm: "#FBBF24", leg: "#FBBF24", joint: "#FDE68A", leftHand: "#C0593A", rightHand: "#60A5FA", faceFill: "rgba(251,191,36,0.12)", faceStroke: "#FBBF24", glow: true };
    case "flat":
      return { body: "#34D399", arm: "#34D399", leg: "#34D399", joint: "#6EE7B7", leftHand: "#C0593A", rightHand: "#60A5FA", faceFill: "rgba(52,211,153,0.15)", faceStroke: "#34D399", glow: false };
    case "avatar2d":
      return { body: "#F472B6", arm: "#F472B6", leg: "#F472B6", joint: "#F9A8D4", leftHand: "#C0593A", rightHand: "#60A5FA", faceFill: "rgba(244,114,182,0.18)", faceStroke: "#F472B6", glow: true };
  }
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function drawArc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function setShadows(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color; ctx.shadowBlur = blur;
}

// ─── Ground shadow ────────────────────────────────────

function drawShadow(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number,
): void {
  const footY = Math.max(toY(rig.leftFootTip.y), toY(rig.rightFootTip.y));
  const footX = (toX(rig.leftFootTip.x) + toX(rig.rightFootTip.x)) / 2;
  const shadowW = toW(0.12);
  const shadowH = toW(0.025);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(footX, footY + toW(0.01), shadowW, shadowH, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Legs ──────────────────────────────────────────────

function drawLegs(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
): void {
  const seg2 = (a: LandmarkPoint, b: LandmarkPoint, fw: number, sw: number) => {
    ctx.lineCap = "round";
    ctx.strokeStyle = c.leg + "25";
    ctx.lineWidth = fw;
    drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
    ctx.strokeStyle = c.leg;
    ctx.lineWidth = sw;
    drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
  };
  const joint = (p: LandmarkPoint, r: number) => {
    ctx.fillStyle = c.joint; drawArc(ctx, toX(p.x), toY(p.y), r);
  };

  seg2(rig.leftHip, rig.leftKnee, toW(0.032), toW(0.016));
  seg2(rig.leftKnee, rig.leftAnkle, toW(0.024), toW(0.012));
  seg2(rig.leftAnkle, rig.leftFootTip, toW(0.016), toW(0.008));
  joint(rig.leftKnee, toW(0.008));
  joint(rig.leftAnkle, toW(0.006));

  seg2(rig.rightHip, rig.rightKnee, toW(0.032), toW(0.016));
  seg2(rig.rightKnee, rig.rightAnkle, toW(0.024), toW(0.012));
  seg2(rig.rightAnkle, rig.rightFootTip, toW(0.016), toW(0.008));
  joint(rig.rightKnee, toW(0.008));
  joint(rig.rightAnkle, toW(0.006));
}

// ─── Pelvis ─────────────────────────────────────────────

function drawPelvis(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = c.body + "25";
  ctx.lineWidth = toW(0.036);
  drawLine(ctx, toX(rig.leftHip.x), toY(rig.leftHip.y), toX(rig.rightHip.x), toY(rig.rightHip.y));
  ctx.strokeStyle = c.body;
  ctx.lineWidth = toW(0.018);
  drawLine(ctx, toX(rig.leftHip.x), toY(rig.leftHip.y), toX(rig.rightHip.x), toY(rig.rightHip.y));
  ctx.fillStyle = c.joint;
  drawArc(ctx, toX(rig.pelvis.x), toY(rig.pelvis.y), toW(0.008));
}

// ─── Torso ─────────────────────────────────────────────

function drawTorso(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Torso fill polygon (shoulders → hips → back)
  ctx.fillStyle = c.body + "18";
  ctx.beginPath();
  ctx.moveTo(toX(rig.leftShoulder.x), toY(rig.leftShoulder.y));
  ctx.lineTo(toX(rig.rightShoulder.x), toY(rig.rightShoulder.y));
  ctx.lineTo(toX(rig.rightHip.x), toY(rig.rightHip.y));
  ctx.lineTo(toX(rig.leftHip.x), toY(rig.leftHip.y));
  ctx.closePath();
  ctx.fill();

  // Spine fill + stroke
  const spineSeg = (a: LandmarkPoint, b: LandmarkPoint, fw: number, sw: number) => {
    ctx.strokeStyle = c.body + "25";
    ctx.lineWidth = fw;
    drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
    ctx.strokeStyle = c.body;
    ctx.lineWidth = sw;
    drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
  };

  spineSeg(rig.pelvis, rig.lowerSpine, toW(0.04), toW(0.02));
  spineSeg(rig.lowerSpine, rig.chest, toW(0.036), toW(0.018));

  // Shoulder bar fill + stroke
  ctx.strokeStyle = c.body + "25";
  ctx.lineWidth = toW(0.03);
  drawLine(ctx, toX(rig.leftShoulder.x), toY(rig.leftShoulder.y), toX(rig.rightShoulder.x), toY(rig.rightShoulder.y));
  ctx.strokeStyle = c.body;
  ctx.lineWidth = toW(0.014);
  drawLine(ctx, toX(rig.leftShoulder.x), toY(rig.leftShoulder.y), toX(rig.rightShoulder.x), toY(rig.rightShoulder.y));

  ctx.fillStyle = c.joint;
  drawArc(ctx, toX(rig.chest.x), toY(rig.chest.y), toW(0.007));
  drawArc(ctx, toX(rig.lowerSpine.x), toY(rig.lowerSpine.y), toW(0.006));
  drawArc(ctx, toX(rig.leftShoulder.x), toY(rig.leftShoulder.y), toW(0.008));
  drawArc(ctx, toX(rig.rightShoulder.x), toY(rig.rightShoulder.y), toW(0.008));
}

// ─── Arms ──────────────────────────────────────────────

function drawArms(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
): void {
  ctx.lineCap = "round";
  const seg2 = (a: LandmarkPoint, b: LandmarkPoint, fw: number, sw: number) => {
    ctx.strokeStyle = c.arm + "25";
    ctx.lineWidth = fw;
    drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
    ctx.strokeStyle = c.arm;
    ctx.lineWidth = sw;
    drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
  };
  const arm = (s: LandmarkPoint, e: LandmarkPoint, w: LandmarkPoint) => {
    seg2(s, e, toW(0.028), toW(0.014));
    seg2(e, w, toW(0.022), toW(0.011));
    ctx.fillStyle = c.joint;
    drawArc(ctx, toX(e.x), toY(e.y), toW(0.006));
    drawArc(ctx, toX(w.x), toY(w.y), toW(0.005));
  };
  arm(rig.leftShoulder, rig.leftElbow, rig.leftWrist);
  arm(rig.rightShoulder, rig.rightElbow, rig.rightWrist);
}

// ─── Hands ─────────────────────────────────────────────

const FINGER_CHAINS: number[][] = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];

function drawHands(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
): void {
  drawOneHand(ctx, rig.leftHand, rig.leftWrist, c.leftHand, toX, toY, toW);
  drawOneHand(ctx, rig.rightHand, rig.rightWrist, c.rightHand, toX, toY, toW);
}

function drawOneHand(
  ctx: CanvasRenderingContext2D,
  lm: LandmarkPoint[], wrist: LandmarkPoint,
  color: string,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number,
): void {
  if (lm.length < 21) {
    ctx.fillStyle = color;
    drawArc(ctx, toX(wrist.x), toY(wrist.y), toW(0.007));
    return;
  }

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const palmIdx = [0, 5, 9, 13, 17];
  ctx.beginPath();
  ctx.moveTo(toX(lm[0].x), toY(lm[0].y));
  for (let i = 1; i < palmIdx.length; i++)
    ctx.lineTo(toX(lm[palmIdx[i]].x), toY(lm[palmIdx[i]].y));
  ctx.closePath();
  ctx.fillStyle = color + "40";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = toW(0.003);
  ctx.stroke();

  ctx.strokeStyle = color;
  for (const chain of FINGER_CHAINS) {
    const segW = [toW(0.007), toW(0.0055), toW(0.0045), toW(0.0035)];
    for (let i = 1; i < chain.length; i++) {
      const a = lm[chain[i - 1]]; const b = lm[chain[i]];
      if (!a || !b) continue;
      ctx.lineWidth = segW[i - 1];
      drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
    }
  }

  ctx.fillStyle = color;
  for (const chain of FINGER_CHAINS) {
    const tip = lm[chain[chain.length - 1]];
    if (tip) drawArc(ctx, toX(tip.x), toY(tip.y), toW(0.0035));
  }
}

// ─── Neck ──────────────────────────────────────────────

function drawNeck(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = c.body + "25";
  ctx.lineWidth = toW(0.02);
  drawLine(ctx, toX(rig.chest.x), toY(rig.chest.y), toX(rig.neck.x), toY(rig.neck.y));
  ctx.strokeStyle = c.body;
  ctx.lineWidth = toW(0.01);
  drawLine(ctx, toX(rig.chest.x), toY(rig.chest.y), toX(rig.neck.x), toY(rig.neck.y));
  ctx.fillStyle = c.joint;
  drawArc(ctx, toX(rig.neck.x), toY(rig.neck.y), toW(0.005));
}

// ─── Head ──────────────────────────────────────────────

function drawHead(
  ctx: CanvasRenderingContext2D, rig: ReconstructedRig,
  toX: (x: number) => number, toY: (y: number) => number,
  toW: (b: number) => number, c: ThemeColors,
  nm?: NonManualFeatures,
): void {
  const f = rig.face;
  const cx = toX(f.center.x);
  const cy = toY(f.center.y);
  const hr = Math.max(toW(f.radius * 1.8), toW(0.012));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(f.roll);

  const yawCompress = 1 - Math.abs(f.yaw) * 0.25;
  const pitchCompress = 1 - Math.abs(f.pitch) * 0.2;
  const hrX = Math.max(hr * yawCompress, toW(0.008));
  const hrY = Math.max(hr * pitchCompress, toW(0.008));

  ctx.fillStyle = c.faceFill;
  ctx.strokeStyle = c.faceStroke;
  ctx.lineWidth = toW(0.003);
  ctx.beginPath();
  ctx.ellipse(0, 0, hrX, hrY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  setShadows(ctx, "transparent", 0);

  const eyeSpX = f.radius * 0.3 * (1 + f.yaw * 0.1);
  const eyeBaseY = -f.radius * 0.05;
  const yawShift = f.yaw * f.radius * 0.08;

  const eyeOpen = nm !== undefined
    ? Math.max(0, 1 - nm.eyebrowRaise * 0.6)
    : f.eyeOpenness;

  const eyeRX = toW(0.006);
  const eyeRY = Math.max(toW(0.002), eyeRX * eyeOpen);

  ctx.fillStyle = "#1e293b";

  ctx.beginPath();
  ctx.ellipse(-toX(eyeSpX) + toX(0) + toX(yawShift), toY(eyeBaseY) - toY(0), eyeRX, eyeRY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(toX(eyeSpX) - toX(0) + toX(yawShift), toY(eyeBaseY) - toY(0), eyeRX, eyeRY, 0, 0, Math.PI * 2);
  ctx.fill();

  const browRaise = nm?.eyebrowRaise ?? ((f.leftBrowRaise + f.rightBrowRaise) / 2 * 0.8);
  ctx.strokeStyle = c.faceStroke;
  ctx.lineWidth = toW(0.003);
  const browY = -toY(f.radius * 0.1) - toW(0.006) - browRaise * toW(0.008);
  ctx.beginPath();
  ctx.moveTo(-toX(eyeSpX) - toW(0.004), browY);
  ctx.lineTo(-toX(eyeSpX) + toW(0.004), browY - browRaise * toW(0.004));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX(eyeSpX) - toW(0.004), browY - browRaise * toW(0.004));
  ctx.lineTo(toX(eyeSpX) + toW(0.004), browY);
  ctx.stroke();

  const noseLen = hr * 0.22;
  ctx.strokeStyle = c.faceStroke;
  ctx.lineWidth = toW(0.002);
  ctx.beginPath();
  ctx.moveTo(toX(f.yaw * f.radius * 0.06), -toY(f.radius * 0.02));
  ctx.lineTo(toX(f.yaw * f.radius * 0.12), toY(noseLen));
  ctx.stroke();

  const mouthOp = nm?.mouthOpen ?? f.mouthOpen;
  const mY = toY(f.radius * 0.35);
  const mW = toW(0.01) + f.mouthWidth * toW(0.08);
  const mCenterX = toX(f.yaw * f.radius * 0.05);
  ctx.strokeStyle = c.faceStroke;
  ctx.lineWidth = toW(0.003);
  if (mouthOp > 0.3) {
    ctx.fillStyle = c.faceStroke + "55";
    ctx.beginPath();
    ctx.ellipse(mCenterX, mY, mW / 2, toW(0.004) + mouthOp * toW(0.008), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const smile = nm?.facialExpression === "surprised" ? 0.3 : 0;
    ctx.beginPath();
    ctx.arc(mCenterX, mY - toW(smile * 0.005), mW / 2, 0.15 + smile, Math.PI - 0.15 - smile);
    ctx.stroke();
  }

  ctx.restore();
  setShadows(ctx, "transparent", 0);
}

export interface LandmarkRenderOptions {
  signLanguageMode?: boolean;
  debug?: boolean;
  fps?: number;
}

export function drawLandmarkFrame(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[] | undefined,
  face: LandmarkPoint[] | undefined,
  leftHand: LandmarkPoint[],
  rightHand: LandmarkPoint[],
  w: number, h: number,
  options?: LandmarkRenderOptions,
): void {
  const signLang = options?.signLanguageMode ?? true;
  const debug = options?.debug ?? false;
  const fps = options?.fps ?? 0;

  // ── 1. Align hands to pose wrists ──
  const alignToPoseWrist = (hand: LandmarkPoint[], wristIdx: number): LandmarkPoint[] => {
    if (!pose || hand.length < 1) return hand;
    const pw = pose[wristIdx];
    const hw = hand[0];
    if (!pw || !hw) return hand;
    const dx = pw.x - hw.x;
    const dy = pw.y - hw.y;
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return hand;
    return hand.map(p => ({ x: p.x + dx, y: p.y + dy, z: p.z }));
  };
  const alignedLeft = alignToPoseWrist(leftHand, 15);
  const alignedRight = alignToPoseWrist(rightHand, 16);

  // ── 2. Compute bounding box from ALL landmarks ──
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const upd = (p: LandmarkPoint) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };
  if (pose) { for (const p of pose) if (p) upd(p); }
  if (face) { for (const p of face) if (p) upd(p); }
  for (const p of alignedLeft) if (p) upd(p);
  for (const p of alignedRight) if (p) upd(p);

  if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

  const pad = 0.05;
  const bboxW = Math.max(maxX - minX, 0.01);
  const bboxH = Math.max(maxY - minY, 0.01);
  const scale = Math.min((1 - 2 * pad) / bboxW, (1 - 2 * pad) / bboxH, 3);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // ── 3. Transform helpers (no perspective, uniform scale) ──
  const toX = (x: number) => ((x - cx) * scale + 0.5) * w;
  const toY = (y: number) => ((y - cy) * scale + 0.5) * h;
  const lw = Math.max(0.5, 1.5 * scale * Math.min(w, h) / 500);
  const jr = Math.max(0.5, 2 * scale * Math.min(w, h) / 500);

  ctx.shadowBlur = 0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ── 4. Face ──
  if (face && face.length >= 50) {
    ctx.fillStyle = "rgba(251,191,36,0.07)";
    const ovalPts: LandmarkPoint[] = [];
    for (const i of FACE_OVAL) { const p = face[i]; if (p) ovalPts.push(p); }
    if (ovalPts.length > 2) {
      ctx.beginPath(); ctx.moveTo(toX(ovalPts[0].x), toY(ovalPts[0].y));
      for (let i = 1; i < ovalPts.length; i++) ctx.lineTo(toX(ovalPts[i].x), toY(ovalPts[i].y));
      ctx.closePath(); ctx.fill();
    }

    ctx.strokeStyle = "#fbbf24";
    const drawPoly = (indices: number[], closed: boolean, wMul: number = 1) => {
      const pts: LandmarkPoint[] = [];
      for (const i of indices) { const p = face[i]; if (p) pts.push(p); }
      if (pts.length < 2) return;
      ctx.lineWidth = lw * wMul;
      ctx.beginPath(); ctx.moveTo(toX(pts[0].x), toY(pts[0].y));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].x), toY(pts[i].y));
      if (closed) ctx.closePath(); ctx.stroke();
    };

    drawPoly(FACE_LEFT_EYEBROW, false);
    drawPoly(FACE_RIGHT_EYEBROW, false);
    drawPoly(FACE_LEFT_EYE, true);
    drawPoly(FACE_RIGHT_EYE, true);
    drawPoly(FACE_NOSE_BRIDGE, false);
    drawPoly(FACE_NOSE_TIP, false);
    drawPoly(FACE_LIPS_OUTER, true, 1.3);
    drawPoly(FACE_LIPS_INNER, true);

    ctx.fillStyle = "#fbbf24";
    const leftPupil = face[468]; if (leftPupil) drawArc(ctx, toX(leftPupil.x), toY(leftPupil.y), jr * 0.8);
    const rightPupil = face[473]; if (rightPupil) drawArc(ctx, toX(rightPupil.x), toY(rightPupil.y), jr * 0.8);
  }

  // ── 5. Pose (official MediaPipe connections only) ──
  if (pose && pose.length >= 33) {
    ctx.strokeStyle = "#60A5FA";
    for (const [i, j] of FULL_POSE_CONNECTIONS) {
      const a = pose[i], b = pose[j];
      if (!a || !b) continue;
      const isUpper = i <= 22 && j <= 22;
      ctx.lineWidth = isUpper ? lw : lw * 0.6;
      drawLine(ctx, toX(a.x), toY(a.y), toX(b.x), toY(b.y));
    }

    ctx.fillStyle = "#93C5FD";
    for (let i = 0; i < 33; i++) {
      const p = pose[i]; if (!p) continue;
      drawArc(ctx, toX(p.x), toY(p.y), lw * 0.5);
    }
  }

  // ── 6. Hands (emphasized, rendered on top) ──
  const renderHand = (lm: LandmarkPoint[], color: string) => {
    if (lm.length < 4) return;

    const handLw = signLang ? lw * 3 : lw * 1.5;
    const handJr = signLang ? jr * 2 : jr;
    const handScale = signLang ? 1.3 : 1.0;

    const w0 = lm[0];
    if (!w0) return;

    // Scale around wrist, keeping wrist anchored
    const hx = (p: LandmarkPoint) => toX(w0.x + (p.x - w0.x) * handScale);
    const hy = (p: LandmarkPoint) => toY(w0.y + (p.y - w0.y) * handScale);

    ctx.strokeStyle = color;
    ctx.lineWidth = handLw;
    for (const [i, j] of HAND_CONNECTIONS) {
      const a = lm[i], b = lm[j];
      if (a && b) drawLine(ctx, hx(a), hy(a), hx(b), hy(b));
    }

    ctx.fillStyle = color;
    for (const p of lm) {
      if (p) drawArc(ctx, hx(p), hy(p), handJr * 0.6);
    }
    for (const i of [0, 1, 5, 9, 13, 17]) {
      const p = lm[i]; if (p) drawArc(ctx, hx(p), hy(p), handJr * 0.8);
    }

    ctx.fillStyle = signLang ? "#FDE68A" : "#fde68a";
    for (const i of [4, 8, 12, 16, 20]) {
      const p = lm[i]; if (p) drawArc(ctx, hx(p), hy(p), handJr);
    }
  };

  renderHand(alignedLeft, "#C0593A");
  renderHand(alignedRight, "#60A5FA");

  // ── 7. Debug overlay ──
  if (debug) {
    ctx.save();

    // Bounding box
    ctx.strokeStyle = "rgba(0,255,0,0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(toX(minX), toY(minY), toX(maxX) - toX(minX), toY(maxY) - toY(minY));
    ctx.setLineDash([]);

    // Info text
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    const info = [
      `Scale: ${scale.toFixed(2)}`,
      `Center: (${cx.toFixed(3)}, ${cy.toFixed(3)})`,
      `BBox: ${(maxX - minX).toFixed(3)}×${(maxY - minY).toFixed(3)}`,
      `Canvas: ${w}×${h}`,
      `FPS: ${fps.toFixed(1)}`,
    ];
    info.forEach((txt, i) => {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(4, 4 + i * 16, ctx.measureText(txt).width + 8, 14);
      ctx.fillStyle = "#0f0";
      ctx.fillText(txt, 8, 14 + i * 16);
    });

    // Landmark indices for pose
    if (pose) {
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      for (let i = 0; i < 33; i++) {
        const p = pose[i]; if (!p) continue;
        const sx = toX(p.x);
        const sy = toY(p.y);
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
        ctx.fillStyle = "rgba(0,255,0,0.5)";
        ctx.fillText(`${i}`, sx, sy - 6);
      }
    }

    // Hand indices
    ctx.fillStyle = "rgba(255,200,0,0.6)";
    for (const lm of [alignedLeft, alignedRight]) {
      if (lm.length < 4) continue;
      for (let i = 0; i < lm.length; i++) {
        const p = lm[i]; if (!p) continue;
        ctx.fillText(`${i}`, toX(p.x), toY(p.y) - 6);
      }
    }

    ctx.restore();
  }
}
