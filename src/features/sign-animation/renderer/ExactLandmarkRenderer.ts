import type { AnimationFrame, GestureAnimationAsset, LandmarkPoint } from "../types";
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
  /** Draw a short fading path behind the hands to make motion legible. */
  showTrails?: boolean;
  /** Frames of history kept for the trail. */
  trailLength?: number;
}

interface TrailSample {
  left: { x: number; y: number }[] | null;
  right: { x: number; y: number }[] | null;
}

/** Wrist plus fingertips — enough to read the path without clutter. */
const TRAIL_POINTS = [0, 4, 8, 12, 16, 20];
const DEFAULT_TRAIL_LENGTH = 8;

export interface ExactRenderTiming {
  /** Playback position within the current clip, seconds. */
  clipTime: number;
  /** currentTime of the paired <video>, or null when not showing one. */
  videoTime: number | null;
}

/**
 * Stroke weights are authored in *source-video pixels* and scaled by the same
 * factor as the landmarks. A weight in canvas pixels would change the apparent
 * limb thickness whenever the stage resized.
 */
const POSE_LINE_SRC = 5;
const POSE_JOINT_SRC = 4;
const FACE_LINE_SRC = 2.5;
const FACE_POINT_SRC = 1.1;
const HAND_LINE_SRC = 14;
const HAND_JOINT_SRC = 8;
const HAND_PALM_SRC = 11;
const HAND_TIP_SRC = 10;

/**
 * A hand covers only a few percent of a 1080p frame, so faithful scaling alone
 * leaves the 21 joints too small to read — which is the part of the sign that
 * actually carries meaning. These floors keep every joint distinguishable at
 * any stage size without moving a single landmark.
 */
const HAND_LINE_MIN = 3;
const HAND_JOINT_MIN = 2.6;
const HAND_PALM_MIN = 3.4;
const HAND_TIP_MIN = 3.2;

/**
 * Pose landmarks 17-22 are the pose model's own coarse finger stubs. When a
 * real 21-point hand exists for that side they draw a second, cruder hand on
 * top of the accurate one, so they are suppressed per-side.
 */
const LEFT_POSE_HAND_LINKS = new Set(["15-17", "15-19", "15-21", "17-19"]);
const RIGHT_POSE_HAND_LINKS = new Set(["16-18", "16-20", "16-22", "18-20"]);
const LEFT_POSE_HAND_POINTS = new Set([17, 19, 21]);
const RIGHT_POSE_HAND_POINTS = new Set([18, 20, 22]);

/**
 * Pose landmarks 1-10 are eye/ear/mouth stubs. Drawn raw they read as a
 * zigzag scribble, so when no FaceMesh is available (synthesised
 * fingerspelling clips) they are replaced by a head outline built from the
 * nose and ears — the same landmarks, drawn legibly.
 */
const POSE_FACE_LINKS = new Set(["0-1", "1-2", "2-3", "3-7", "0-4", "4-5", "5-6", "6-8", "9-10"]);
const POSE_FACE_POINTS = new Set([1, 2, 3, 4, 5, 6, 9, 10]);

/**
 * Last pose landmark drawn: 24 is the right hip. Everything past it (knees,
 * ankles, feet) lies outside the camera frame on these waist-up captures —
 * MediaPipe extrapolates them, measured as far as y=1.74 where the frame ends
 * at 1.0. They are model guesses rather than captured signing, and drawing
 * them forces the signer either off the stage or down to a speck.
 */
const POSE_DRAW_LIMIT = 24;

// Priority order (Part 7): hands read strongest, face mid, pose faintest.
const POSE_COLOR = "rgba(96, 125, 168, 0.72)";
const POSE_JOINT_COLOR = "rgba(120, 150, 194, 0.95)";
const FACE_FILL = "rgba(150, 104, 66, 0.06)";
const FACE_STROKE = "rgba(139, 94, 58, 0.8)";
const FACE_POINT_COLOR = "rgba(139, 94, 58, 0.28)";
const LEFT_HAND_COLOR = "#2F6FD0";
const LEFT_HAND_JOINT = "#63A0F0";
const RIGHT_HAND_COLOR = "#E1662A";
const RIGHT_HAND_JOINT = "#F79A5C";
const HAND_TIP_COLOR = "#FFC663";

/** Finger chains as bone runs: MCP -> PIP -> DIP -> tip. */
const FINGER_CHAINS: number[][] = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];
const PALM_ARCH = [5, 9, 13, 17];

const DEBUG_COLOR = "rgba(74, 222, 128, 0.95)";
const DEBUG_BG = "rgba(0, 0, 0, 0.62)";

const CLOSED_FACE_GROUPS = new Set([FACE_LEFT_EYE, FACE_RIGHT_EYE, FACE_LIPS_OUTER, FACE_LIPS_INNER, FACE_OVAL]);
const FACE_GROUPS = [
  FACE_OVAL,
  FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW,
  FACE_LEFT_EYE, FACE_RIGHT_EYE,
  FACE_NOSE_BRIDGE, FACE_NOSE_TIP,
  FACE_LIPS_OUTER, FACE_LIPS_INNER,
];
/** Brows and lips carry the grammatical expression, so they read heavier. */
const EMPHASISED_FACE_GROUPS = new Set([FACE_LEFT_EYEBROW, FACE_RIGHT_EYEBROW, FACE_LIPS_OUTER]);
const FILLED_FACE_GROUPS = new Set([FACE_LEFT_EYE, FACE_RIGHT_EYE, FACE_LIPS_INNER]);

interface Projection {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ClipBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Share of the viewport the signer should fill once fitted. */
const FIT_FRACTION = 0.82;

const boundsCache = new WeakMap<GestureAnimationAsset, ClipBounds | null>();

/**
 * Bounding box of everything drawable across the *whole* clip, in normalised
 * coordinates. Fitting to this once gives a single constant transform: the
 * signer fills the viewport without the scale breathing frame to frame, which
 * would distort the motion.
 */
export function computeClipBounds(asset: GestureAnimationAsset): ClipBounds | null {
  const cached = boundsCache.get(asset);
  if (cached !== undefined) return cached;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (p: LandmarkPoint | undefined) => {
    if (!p) return;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };

  // Sampling every third frame is plenty for an extent and keeps this cheap
  // on 478-point face meshes. Must cover exactly what gets drawn — hence
  // upper body only, matching POSE_DRAW_LIMIT.
  for (let f = 0; f < asset.frames.length; f += 3) {
    const frame = asset.frames[f];
    const pose = frame.poseLandmarks;
    if (pose) {
      for (let i = 0; i <= POSE_DRAW_LIMIT; i++) add(pose[i]);
    }
    if (frame.faceLandmarks?.length) {
      for (const i of FACE_OVAL) add(frame.faceLandmarks[i]);
    }
    for (const hand of frame.landmarks) {
      if (hand.landmarks) for (const p of hand.landmarks) add(p);
    }
  }

  const result = isFinite(minX) && maxX > minX && maxY > minY
    ? { minX, minY, maxX, maxY }
    : null;
  boundsCache.set(asset, result);
  return result;
}

export class ExactLandmarkRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: ExactRendererOptions;
  private lastFrameTime = 0;
  private measuredFps = 0;
  private driftFrames = 0;
  private missingCounts = { pose: 0, face: 0, hands: 0 };
  private trail: TrailSample[] = [];
  private lastTrailIndex = -1;
  private fitBounds: ClipBounds | null = null;
  private lastRendered: { frame: AnimationFrame; index: number; total: number; timing?: ExactRenderTiming } | null = null;

  constructor(canvas: HTMLCanvasElement, options: ExactRendererOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.opts = options;
    this.canvas.width = options.width;
    this.canvas.height = options.height;
  }

  /**
   * Re-points the renderer at a different canvas. Switching view mode swaps
   * the JSX branch, so the element this was constructed with gets detached and
   * anything drawn into it is invisible.
   */
  attach(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.canvas.width = this.opts.width;
    this.canvas.height = this.opts.height;
    this.repaint();
  }

  setSize(width: number, height: number): void {
    // Assigning canvas.width resets the bitmap, so skip the no-op case:
    // this renderer shares its canvas and would otherwise erase whatever
    // the active renderer last painted.
    if (this.opts.width === width && this.opts.height === height) return;
    this.opts.width = width;
    this.opts.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.repaint();
  }

  setImageDimensions(w: number, h: number): void {
    if (!w || !h || (this.opts.imageWidth === w && this.opts.imageHeight === h)) return;
    this.opts.imageWidth = w;
    this.opts.imageHeight = h;
    this.repaint();
  }

  setShowDebug(enabled: boolean): void {
    if (this.opts.showDebug === enabled) return;
    this.opts.showDebug = enabled;
    this.repaint();
  }

  setBackgroundColor(color: string): void {
    if (this.opts.backgroundColor === color) return;
    this.opts.backgroundColor = color;
    this.repaint();
  }

  /**
   * One uniform scale plus a letterbox offset, fixed for the whole clip. The
   * subject keeps the position and proportions it had in the recording — no
   * per-frame fitting, recentring or axis-independent stretching.
   */
  private projection(): Projection {
    const { width, height, imageWidth, imageHeight } = this.opts;
    const iw = imageWidth > 0 ? imageWidth : width;
    const ih = imageHeight > 0 ? imageHeight : height;

    // Fitted: one scale derived from the clip's full extent, so the signer
    // fills the stage and the container never has to resize to suit them.
    if (this.fitBounds) {
      const boxW = Math.max((this.fitBounds.maxX - this.fitBounds.minX) * iw, 1);
      const boxH = Math.max((this.fitBounds.maxY - this.fitBounds.minY) * ih, 1);
      const scale = Math.min((width * FIT_FRACTION) / boxW, (height * FIT_FRACTION) / boxH);
      const centreX = ((this.fitBounds.minX + this.fitBounds.maxX) / 2) * iw;
      const centreY = ((this.fitBounds.minY + this.fitBounds.maxY) / 2) * ih;
      return {
        scale,
        offsetX: width / 2 - centreX * scale,
        offsetY: height / 2 - centreY * scale,
      };
    }

    // Unfitted: plain contain, matching how a paired <video> lays itself out
    // so overlay mode stays registered with the recording.
    const scale = Math.min(width / iw, height / ih);
    return {
      scale,
      offsetX: (width - iw * scale) / 2,
      offsetY: (height - ih * scale) / 2,
    };
  }

  /** Pass null to fall back to contain (required for overlay alignment). */
  setFitBounds(bounds: ClipBounds | null): void {
    const same = this.fitBounds === bounds
      || (this.fitBounds && bounds
        && this.fitBounds.minX === bounds.minX && this.fitBounds.maxX === bounds.maxX
        && this.fitBounds.minY === bounds.minY && this.fitBounds.maxY === bounds.maxY);
    if (same) return;
    this.fitBounds = bounds;
    this.repaint();
  }

  private px(lm: LandmarkPoint, p: Projection): { x: number; y: number } {
    return {
      x: p.offsetX + lm.x * this.opts.imageWidth * p.scale,
      y: p.offsetY + lm.y * this.opts.imageHeight * p.scale,
    };
  }

  /** Source-pixel weight -> canvas pixels, with a floor so nothing disappears. */
  private w(sourcePx: number, p: Projection, min = 0.6): number {
    return Math.max(min, sourcePx * p.scale);
  }

  private repaint(): void {
    if (!this.lastRendered) return;
    const { frame, index, total, timing } = this.lastRendered;
    this.render(frame, index, total, timing);
  }

  render(
    frame: AnimationFrame | null,
    frameIndex: number,
    totalFrames: number,
    timing?: ExactRenderTiming,
  ): void {
    const ctx = this.ctx;
    const w = this.opts.width;
    const h = this.opts.height;

    ctx.clearRect(0, 0, w, h);
    // Overlay mode passes "transparent" so the recording shows through beneath
    // the landmarks.
    if (this.opts.backgroundColor !== "transparent") {
      ctx.fillStyle = this.opts.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    if (!frame) {
      ctx.fillStyle = "#a8998a";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No animation data", w / 2, h / 2);
      this.lastRendered = null;
      return;
    }

    this.lastRendered = { frame, index: frameIndex, total: totalFrames, timing };
    const p = this.projection();
    this.missingCounts = { pose: 0, face: 0, hands: 0 };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const hasLeftHand = frame.landmarks.some((h) => h.side === "left" && h.landmarks?.length >= 21);
    const hasRightHand = frame.landmarks.some((h) => h.side === "right" && h.landmarks?.length >= 21);

    const hasFaceMesh = (frame.faceLandmarks?.length ?? 0) >= 50;

    // Painted back-to-front so hands stay legible on top.
    if (frame.poseLandmarks?.length) {
      this.drawPose(ctx, frame.poseLandmarks, p, hasLeftHand, hasRightHand, hasFaceMesh);
      if (!hasFaceMesh) this.drawPoseHead(ctx, frame.poseLandmarks, p);
    }
    if (hasFaceMesh) this.drawFace(ctx, frame.faceLandmarks!, p);

    if (this.opts.showTrails) {
      this.recordTrail(frame, frameIndex, p);
      this.drawTrail(ctx, p);
    } else if (this.trail.length) {
      this.trail = [];
    }

    for (const hand of frame.landmarks) {
      if (!hand.landmarks?.length) continue;
      const color = hand.side === "left" ? LEFT_HAND_COLOR : RIGHT_HAND_COLOR;
      this.drawHand(ctx, hand.landmarks, color, p);
    }

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.measuredFps = this.measuredFps * 0.9 + (1000 / (now - this.lastFrameTime)) * 0.1;
    }
    this.lastFrameTime = now;

    if (this.opts.showDebug) {
      this.drawDebug(ctx, frameIndex, totalFrames, timing);
    }
  }

  private recordTrail(frame: AnimationFrame, frameIndex: number, p: Projection): void {
    // A seek or replay makes the history meaningless, so drop it rather than
    // streak a line across the stage.
    if (frameIndex <= this.lastTrailIndex || frameIndex - this.lastTrailIndex > 3) {
      this.trail = [];
    }
    this.lastTrailIndex = frameIndex;

    const sample = (side: "left" | "right") => {
      const hand = frame.landmarks.find((h) => h.side === side)?.landmarks;
      if (!hand || hand.length < 21) return null;
      return TRAIL_POINTS.map((i) => this.px(hand[i], p));
    };

    this.trail.push({ left: sample("left"), right: sample("right") });
    const max = this.opts.trailLength ?? DEFAULT_TRAIL_LENGTH;
    while (this.trail.length > max) this.trail.shift();
  }

  private drawTrail(ctx: CanvasRenderingContext2D, p: Projection): void {
    if (this.trail.length < 2) return;
    const radius = this.w(HAND_TIP_SRC * 0.55, p, 1.2);

    // Oldest samples fade out, so the trail reads as direction of travel.
    for (let i = 0; i < this.trail.length - 1; i++) {
      const age = (i + 1) / this.trail.length;
      const alpha = age * age * 0.45;
      for (const side of ["left", "right"] as const) {
        const pts = this.trail[i][side];
        if (!pts) continue;
        ctx.fillStyle = side === "left"
          ? `rgba(47,111,208,${alpha.toFixed(3)})`
          : `rgba(225,102,42,${alpha.toFixed(3)})`;
        for (const q of pts) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, radius * age, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /** A landmark is drawable only if it exists and carries usable confidence. */
  private usable(lm: LandmarkPoint | undefined): lm is LandmarkPoint {
    if (!lm) return false;
    // `visibility` is only present on newer extractions; when absent the point
    // is trusted rather than guessed at.
    const vis = (lm as LandmarkPoint & { visibility?: number }).visibility;
    return vis === undefined || vis >= 0.5;
  }

  private drawPose(
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[],
    p: Projection,
    hasLeftHand: boolean,
    hasRightHand: boolean,
    hasFaceMesh: boolean,
  ): void {
    ctx.strokeStyle = POSE_COLOR;
    ctx.lineWidth = this.w(POSE_LINE_SRC, p);

    for (const [i, j] of FULL_POSE_CONNECTIONS) {
      const key = `${i}-${j}`;
      if (i > POSE_DRAW_LIMIT || j > POSE_DRAW_LIMIT) continue;
      if (hasLeftHand && LEFT_POSE_HAND_LINKS.has(key)) continue;
      if (hasRightHand && RIGHT_POSE_HAND_LINKS.has(key)) continue;
      if (!hasFaceMesh && POSE_FACE_LINKS.has(key)) continue;
      const a = landmarks[i];
      const b = landmarks[j];
      if (!this.usable(a) || !this.usable(b)) continue;
      const pa = this.px(a, p);
      const pb = this.px(b, p);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    const r = this.w(POSE_JOINT_SRC, p, 1.2);
    // Shoulders, elbows and wrists get a larger, brighter node so the arm
    // articulates visibly instead of looking like a broken polyline.
    const articulated = new Set([11, 12, 13, 14, 15, 16]);
    for (let i = 0; i < landmarks.length && i <= POSE_DRAW_LIMIT; i++) {
      if (hasLeftHand && LEFT_POSE_HAND_POINTS.has(i)) continue;
      if (hasRightHand && RIGHT_POSE_HAND_POINTS.has(i)) continue;
      if (!hasFaceMesh && POSE_FACE_POINTS.has(i)) continue;
      const lm = landmarks[i];
      if (!this.usable(lm)) { this.missingCounts.pose++; continue; }
      const q = this.px(lm, p);
      ctx.fillStyle = POSE_JOINT_COLOR;
      ctx.beginPath();
      ctx.arc(q.x, q.y, articulated.has(i) ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Head outline from the pose's nose and ears, used when no FaceMesh exists. */
  private drawPoseHead(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[], p: Projection): void {
    const nose = landmarks[0];
    if (!this.usable(nose)) return;
    const earL = landmarks[7];
    const earR = landmarks[8];

    const centre = this.px(nose, p);
    let rx: number;
    if (this.usable(earL) && this.usable(earR)) {
      const a = this.px(earL, p);
      const b = this.px(earR, p);
      rx = Math.max(Math.hypot(a.x - b.x, a.y - b.y) / 2, this.w(20, p, 6));
    } else {
      rx = this.w(70, p, 10);
    }
    const ry = rx * 1.25;

    ctx.strokeStyle = POSE_COLOR;
    ctx.lineWidth = this.w(POSE_LINE_SRC, p);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y - ry * 0.12, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawFace(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[], p: Projection): void {
    const oval: Array<{ x: number; y: number }> = [];
    for (const idx of FACE_OVAL) {
      const lm = landmarks[idx];
      if (this.usable(lm)) oval.push(this.px(lm, p));
    }
    if (oval.length > 2) {
      ctx.fillStyle = FACE_FILL;
      ctx.beginPath();
      ctx.moveTo(oval[0].x, oval[0].y);
      for (let i = 1; i < oval.length; i++) ctx.lineTo(oval[i].x, oval[i].y);
      ctx.closePath();
      ctx.fill();
    }

    // Every mesh point, not just the contours (Part 6).
    ctx.fillStyle = FACE_POINT_COLOR;
    const pr = this.w(FACE_POINT_SRC, p, 0.35);
    for (const lm of landmarks) {
      if (!this.usable(lm)) { this.missingCounts.face++; continue; }
      const q = this.px(lm, p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Contours are redrawn every frame straight from FaceMesh, so a raised
    // brow, widened eye or opened mouth shows up as it happens.
    const baseWidth = this.w(FACE_LINE_SRC, p, 0.5);
    for (const group of FACE_GROUPS) {
      const pts: Array<{ x: number; y: number }> = [];
      for (const idx of group) {
        const lm = landmarks[idx];
        if (this.usable(lm)) pts.push(this.px(lm, p));
      }
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (CLOSED_FACE_GROUPS.has(group)) ctx.closePath();

      if (FILLED_FACE_GROUPS.has(group)) {
        ctx.fillStyle = "rgba(139, 94, 58, 0.35)";
        ctx.fill();
      }
      ctx.strokeStyle = FACE_STROKE;
      ctx.lineWidth = EMPHASISED_FACE_GROUPS.has(group) ? baseWidth * 1.9 : baseWidth;
      ctx.stroke();
    }

    ctx.fillStyle = FACE_STROKE;
    for (const idx of [468, 473]) {
      const lm = landmarks[idx];
      if (!this.usable(lm)) continue;
      const q = this.px(lm, p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, this.w(FACE_POINT_SRC * 2.2, p, 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHand(
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[],
    color: string,
    p: Projection,
  ): void {
    const jointColor = color === LEFT_HAND_COLOR ? LEFT_HAND_JOINT : RIGHT_HAND_JOINT;
    const base = this.w(HAND_LINE_SRC, p, HAND_LINE_MIN);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Palm webbing first, so the finger bones sit on top of it.
    const arch = PALM_ARCH.map((i) => landmarks[i]).filter((lm) => this.usable(lm));
    if (arch.length === PALM_ARCH.length && this.usable(landmarks[0])) {
      const pts = [landmarks[0], ...arch].map((lm) => this.px(lm, p));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = `${color}22`;
      ctx.fill();
      ctx.strokeStyle = `${color}66`;
      ctx.lineWidth = base * 0.5;
      ctx.stroke();
    }

    // Bones taper from knuckle to fingertip, so a finger reads as a finger
    // rather than a constant-width stick.
    ctx.strokeStyle = color;
    for (const chain of FINGER_CHAINS) {
      for (let seg = 1; seg < chain.length; seg++) {
        const a = landmarks[chain[seg - 1]];
        const b = landmarks[chain[seg]];
        if (!this.usable(a) || !this.usable(b)) continue;
        const pa = this.px(a, p);
        const pb = this.px(b, p);
        ctx.lineWidth = Math.max(HAND_LINE_MIN * 0.7, base * (1 - (seg - 1) * 0.16));
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }

    // Outlining each joint keeps the 21 points countable where the knuckles
    // bunch together, instead of merging into one blob.
    const jr = this.w(HAND_JOINT_SRC, p, HAND_JOINT_MIN);
    const palmR = this.w(HAND_PALM_SRC, p, HAND_PALM_MIN);
    const tipR = this.w(HAND_TIP_SRC, p, HAND_TIP_MIN);
    const palmSet = new Set([0, 1, 5, 9, 13, 17]);
    const tipSet = new Set([4, 8, 12, 16, 20]);

    // In overlay mode there is no base colour to outline against, so fall back
    // to a dark rim that reads against arbitrary video content.
    ctx.strokeStyle = this.opts.backgroundColor === "transparent"
      ? "rgba(24,18,14,0.75)"
      : this.opts.backgroundColor;
    ctx.lineWidth = Math.max(1, jr * 0.35);

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!this.usable(lm)) { this.missingCounts.hands++; continue; }
      const q = this.px(lm, p);
      const radius = tipSet.has(i) ? tipR : palmSet.has(i) ? palmR : jr;
      ctx.fillStyle = tipSet.has(i) ? HAND_TIP_COLOR : jointColor;
      ctx.beginPath();
      ctx.arc(q.x, q.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawDebug(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    totalFrames: number,
    timing?: ExactRenderTiming,
  ): void {
    ctx.save();
    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    const missing = this.missingCounts;
    const lines = [
      `Frame ${frameIndex + 1} / ${totalFrames}`,
      `FPS ${this.measuredFps.toFixed(1)}`,
      `Clip t ${timing ? timing.clipTime.toFixed(3) : "-"}s`,
      `Video t ${timing?.videoTime != null ? timing.videoTime.toFixed(3) : "-"}s`,
      `Drift ${this.driftFrames} frames`,
      `Missing p${missing.pose} f${missing.face} h${missing.hands}`,
      `Src ${this.opts.imageWidth}x${this.opts.imageHeight}`,
    ];

    lines.forEach((txt, i) => {
      const y = 4 + i * 15;
      ctx.fillStyle = DEBUG_BG;
      ctx.fillRect(4, y, ctx.measureText(txt).width + 8, 13);
      ctx.fillStyle = DEBUG_COLOR;
      ctx.fillText(txt, 8, y + 10);
    });

    ctx.restore();
  }

  setDrift(drift: number): void {
    this.driftFrames = drift;
  }

  getMissingCounts(): { pose: number; face: number; hands: number } {
    return { ...this.missingCounts };
  }

  setShowTrails(enabled: boolean): void {
    if (this.opts.showTrails === enabled) return;
    this.opts.showTrails = enabled;
    if (!enabled) this.trail = [];
    this.repaint();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.opts.width, this.opts.height);
    this.lastRendered = null;
    this.trail = [];
  }

  dispose(): void {
    this.clear();
  }
}
