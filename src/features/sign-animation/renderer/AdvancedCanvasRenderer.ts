import type {
  AnimationFrame,
  BodyPose,
  NonManualFeatures,
  AvatarTheme,
  LandmarkPoint,
} from "../types";
import { HAND_CONNECTIONS, BODY_CONNECTIONS } from "../types";
import { estimateBodyPose, estimateNonManual } from "./bodyPoseEstimator";
import { reconstructPose, smoothRig, drawAvatar } from "./avatarRenderer";
import type { ReconstructedRig } from "./avatarRenderer";
import { drawSignFigure, WARM_FIGURE_PALETTE, CONTRAST_FIGURE_PALETTE } from "./signFigureRenderer";

export type RenderMode = "avatar" | "landmark";

export interface DebugOverlayConfig {
  video?: HTMLVideoElement;
  opacity: number; // 0–1
}

export interface AdvancedRendererOptions {
  width: number;
  height: number;
  theme: AvatarTheme;
  showLabels: boolean;
  showNonManual: boolean;
  lineWidth: number;
  jointRadius: number;
  backgroundColor: string;
  renderMode: RenderMode;
  smoothingAlpha: number; // 0 = no smoothing, 1 = max smoothing
  interpolationFactor: number; // 0 = no interp, 1 = max interp
  debugOverlay: DebugOverlayConfig | null;
  debugLandmarkIndices: boolean; // draw index numbers on landmarks
  highContrast: boolean;
}

const THEME_COLORS: Record<AvatarTheme, {
  body: string; joint: string; leftHand: string; rightHand: string;
  bodyStroke: number; jointRadius: number; lineWidth: number;
  glowEnabled: boolean;
}> = {
  minimal: {
    body: "#60A5FA", joint: "#93C5FD", leftHand: "#C0593A", rightHand: "#60A5FA",
    bodyStroke: 2, jointRadius: 3, lineWidth: 2, glowEnabled: false,
  },
  skeleton: {
    body: "#FBBF24", joint: "#FDE68A", leftHand: "#C0593A", rightHand: "#60A5FA",
    bodyStroke: 3, jointRadius: 5, lineWidth: 3, glowEnabled: true,
  },
  flat: {
    body: "#34D399", joint: "#6EE7B7", leftHand: "#C0593A", rightHand: "#60A5FA",
    bodyStroke: 5, jointRadius: 6, lineWidth: 5, glowEnabled: false,
  },
  avatar2d: {
    body: "#F472B6", joint: "#F9A8D4", leftHand: "#C0593A", rightHand: "#60A5FA",
    bodyStroke: 6, jointRadius: 7, lineWidth: 6, glowEnabled: true,
  },
};

/** Catmull-Rom interpolation: t in [0,1] between p1 and p2 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function lerpLandmark(a: LandmarkPoint, b: LandmarkPoint, t: number): LandmarkPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function catmullRomLandmark(p0: LandmarkPoint, p1: LandmarkPoint, p2: LandmarkPoint, p3: LandmarkPoint, t: number): LandmarkPoint {
  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
  };
}

/**
 * Assets that carry only one hand (fingerspelling) tag it with a side. Falling
 * back to positional lookup in that case renders the same hand twice, once per
 * wrist — so positional lookup only applies when no side is labelled at all.
 */
function splitHands(frame: AnimationFrame): { left: LandmarkPoint[]; right: LandmarkPoint[] } {
  const labelled = frame.landmarks.some((h) => h.side === "left" || h.side === "right");
  if (labelled) {
    return {
      left: frame.landmarks.find((h) => h.side === "left")?.landmarks ?? [],
      right: frame.landmarks.find((h) => h.side === "right")?.landmarks ?? [],
    };
  }
  return {
    left: frame.landmarks[0]?.landmarks ?? [],
    right: frame.landmarks[1]?.landmarks ?? [],
  };
}

function smoothArray(current: LandmarkPoint[], prev: LandmarkPoint[] | null, alpha: number): LandmarkPoint[] {
  if (!prev || current.length !== prev.length) return current.map(p => ({ ...p }));
  const out: LandmarkPoint[] = [];
  for (let i = 0; i < current.length; i++) {
    const c = current[i], p = prev[i];
    if (c && p) {
      out.push({
        x: p.x + (c.x - p.x) * (1 - alpha),
        y: p.y + (c.y - p.y) * (1 - alpha),
        z: p.z + (c.z - p.z) * (1 - alpha),
      });
    } else {
      out.push(c ? { ...c } : p ? { ...p } : { x: 0.5, y: 0.5, z: 0 });
    }
  }
  return out;
}

export class AdvancedCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: AdvancedRendererOptions;
  private prevBodyPose: BodyPose | null = null;
  private prevRig: ReconstructedRig | null = null;

  // Smoothed landmark buffers
  private smoothPose: LandmarkPoint[] | null = null;
  private smoothFace: LandmarkPoint[] | null = null;
  private smoothLeftHand: LandmarkPoint[] | null = null;
  private smoothRightHand: LandmarkPoint[] | null = null;

  // Catmull-Rom history (need 4 frames)
  private poseHistory: LandmarkPoint[][] = [];
  private faceHistory: LandmarkPoint[][] = [];
  private leftHandHistory: LandmarkPoint[][] = [];
  private rightHandHistory: LandmarkPoint[][] = [];
  private histTimestamp: number[] = [];

  private lastFrame: AnimationFrame | null = null;
  private lastExtra: { bodyPose?: BodyPose; nonManual?: NonManualFeatures } | undefined;

  private frameCount = 0;
  private lastFrameTime = 0;
  private measuredFps = 0;
  private renderTimes: number[] = [];

  constructor(canvas: HTMLCanvasElement, options?: Partial<AdvancedRendererOptions>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.options = {
      width: 320,
      height: 400,
      theme: "minimal",
      showLabels: false,
      showNonManual: false,
      lineWidth: 2,
      jointRadius: 3,
      backgroundColor: "#FBF4EA",
      renderMode: "landmark",
      smoothingAlpha: 0.25,
      interpolationFactor: 0,
      debugOverlay: null,
      debugLandmarkIndices: false,
      highContrast: false,
      ...options,
    };
    this.setSize(this.options.width, this.options.height);
  }

  setSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.options.width = width;
    this.options.height = height;
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
    this.setSize(this.options.width, this.options.height);
    if (this.lastFrame) this.render(this.lastFrame, this.lastExtra);
  }

  setTheme(theme: AvatarTheme): void {
    this.options.theme = theme;
  }

  setOptions(partial: Partial<AdvancedRendererOptions>): void {
    Object.assign(this.options, partial);
    if (partial.width !== undefined || partial.height !== undefined) {
      this.setSize(this.options.width, this.options.height);
    }
    // Resizing clears the canvas, so repaint the held frame rather than
    // leaving the stage blank when playback has already finished.
    if (this.lastFrame) this.render(this.lastFrame, this.lastExtra);
  }

  setDebugOverlay(cfg: DebugOverlayConfig | null): void {
    this.options.debugOverlay = cfg;
  }

  setDebugLandmarkIndices(enabled: boolean): void {
    this.options.debugLandmarkIndices = enabled;
  }

  render(frame: AnimationFrame | null, extra?: { bodyPose?: BodyPose; nonManual?: NonManualFeatures }): void {
    const renderStart = performance.now();
    const ctx = this.ctx;
    const w = this.options.width;
    const h = this.options.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.options.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    if (!frame || frame.landmarks.length === 0) {
      ctx.fillStyle = this.options.highContrast ? "#e2e8f0" : "#a8998a";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No animation data", w / 2, h / 2);
      this.prevBodyPose = null;
      this.prevRig = null;
      this.lastFrame = null;
      this.lastExtra = undefined;
      return;
    }

    this.lastFrame = frame;
    this.lastExtra = extra;

    const theme = THEME_COLORS[this.options.theme];
    const nonManual = extra?.nonManual ?? estimateNonManual(frame.landmarks);

    if (this.options.showNonManual) {
      this.renderNonManualIndicators(ctx, w, nonManual);
    }

    // ── Debug overlay: draw video frame first ──
    if (this.options.debugOverlay?.video && this.options.debugOverlay.opacity > 0) {
      const vid = this.options.debugOverlay.video;
      if (vid.readyState >= 2) {
        ctx.globalAlpha = this.options.debugOverlay.opacity;
        ctx.drawImage(vid, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    }

    const poseData = frame.poseLandmarks;
    const faceData = frame.faceLandmarks;
    const hasFullPose = poseData && poseData.length >= 33;

    if (hasFullPose && this.options.renderMode === "landmark") {
      const { left: leftHand, right: rightHand } = splitHands(frame);

      // Push into Catmull-Rom history (up to 4 frames)
      this.poseHistory.push(poseData!.map(p => ({ ...p })));
      this.faceHistory.push(faceData ? faceData.map(p => ({ ...p })) : []);
      this.leftHandHistory.push(leftHand.map(p => ({ ...p })));
      this.rightHandHistory.push(rightHand.map(p => ({ ...p })));
      this.histTimestamp.push(frame.timestamp);
      while (this.poseHistory.length > 4) {
        this.poseHistory.shift();
        this.faceHistory.shift();
        this.leftHandHistory.shift();
        this.rightHandHistory.shift();
        this.histTimestamp.shift();
      }

      const interpFactor = this.options.interpolationFactor;
      const hasHistory = this.poseHistory.length >= 4 && interpFactor > 0;

      // Catmull-Rom interpolation between stored frames
      let renderPose = poseData!;
      let renderFace = faceData;
      let renderLeftHand = leftHand;
      let renderRightHand = rightHand;

      if (hasHistory) {
        const t = interpFactor;
        renderPose = poseData!.map((p, i) => {
          if (!p) return p;
          const h = this.poseHistory.map(f => f[i]);
          return h[0] && h[1] && h[2] && h[3] ? catmullRomLandmark(h[0], h[1], h[2], h[3], t) : { ...p };
        });
        if (faceData) {
          renderFace = faceData.map((p, i) => {
            if (!p) return p;
            const h = this.faceHistory.map(f => f[i]);
            return h[0] && h[1] && h[2] && h[3] ? catmullRomLandmark(h[0], h[1], h[2], h[3], t) : { ...p };
          });
        }
        renderLeftHand = leftHand.map((p, i) => {
          const h = this.leftHandHistory.map(f => f[i]);
          return h[0] && h[1] && h[2] && h[3] ? catmullRomLandmark(h[0], h[1], h[2], h[3], t) : { ...p };
        });
        renderRightHand = rightHand.map((p, i) => {
          const h = this.rightHandHistory.map(f => f[i]);
          return h[0] && h[1] && h[2] && h[3] ? catmullRomLandmark(h[0], h[1], h[2], h[3], t) : { ...p };
        });
      }

      // EMA smoothing
      const alpha = this.options.smoothingAlpha;
      const finalPose = smoothArray(renderPose, this.smoothPose, alpha);
      const finalFace = renderFace ? smoothArray(renderFace, this.smoothFace, alpha) : undefined;
      const finalLeftHand = smoothArray(renderLeftHand, this.smoothLeftHand, alpha);
      const finalRightHand = smoothArray(renderRightHand, this.smoothRightHand, alpha);

      this.smoothPose = finalPose;
      this.smoothFace = finalFace ?? null;
      this.smoothLeftHand = finalLeftHand;
      this.smoothRightHand = finalRightHand;

      drawSignFigure(ctx, finalPose, finalFace, finalLeftHand, finalRightHand, w, h, {
        palette: this.options.highContrast ? CONTRAST_FIGURE_PALETTE : WARM_FIGURE_PALETTE,
        debug: this.options.debugLandmarkIndices,
        fps: this.measuredFps,
      });

      this.prevBodyPose = null;
      this.prevRig = null;

    } else if (hasFullPose && this.options.renderMode === "avatar") {
      // Avatar mode: hierarchical reconstruction (alternative view)
      const { left: leftHand, right: rightHand } = splitHands(frame);

      const rig = reconstructPose(poseData!, faceData, leftHand, rightHand);
      this.prevRig = smoothRig(rig, this.prevRig);

      if (theme.glowEnabled) {
        ctx.shadowColor = theme.body;
        ctx.shadowBlur = 8;
      }
      drawAvatar(ctx, this.prevRig, w, h, this.options.theme, nonManual);
      ctx.shadowBlur = 0;
      this.prevBodyPose = null;

    } else {
      // Fallback: no full pose data
      const bodyPose = extra?.bodyPose ?? estimateBodyPose(frame.landmarks, this.prevBodyPose ?? undefined);
      this.prevBodyPose = bodyPose;
      this.prevRig = null;

      this.renderBody(ctx, w, h, bodyPose, theme);

      if (this.options.theme === "avatar2d") {
        this.renderFace(ctx, w, h, bodyPose, nonManual);
      }

      ctx.shadowBlur = 0;

      const { left: leftHand, right: rightHand } = splitHands(frame);

      this.renderHand(ctx, w, h, leftHand, theme.leftHand, "left");
      this.renderHand(ctx, w, h, rightHand, theme.rightHand, "right");
    }

    if (this.options.showLabels) {
      this.renderLabels(ctx, w, h, frame);
    }

    this.frameCount++;
    const elapsed = performance.now() - renderStart;
    this.renderTimes.push(elapsed);
    if (this.renderTimes.length > 60) this.renderTimes.shift();

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.measuredFps = this.measuredFps * 0.9 + (1000 / (now - this.lastFrameTime)) * 0.1;
    }
    this.lastFrameTime = now;
  }

  private renderBody(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    pose: BodyPose,
    theme: typeof THEME_COLORS[AvatarTheme],
  ): void {
    const nodes = [
      pose.head, pose.neck, pose.torso,
      pose.leftShoulder, pose.rightShoulder,
      pose.leftElbow, pose.rightElbow,
      pose.leftWrist, pose.rightWrist,
      pose.leftHand, pose.rightHand,
    ];

    if (theme.glowEnabled) {
      ctx.shadowColor = theme.body;
      ctx.shadowBlur = 8;
    }

    ctx.strokeStyle = theme.body;
    ctx.lineWidth = theme.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [i, j] of BODY_CONNECTIONS) {
      if (i < nodes.length && j < nodes.length) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x * w, nodes[i].y * h);
        ctx.lineTo(nodes[j].x * w, nodes[j].y * h);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;

    ctx.fillStyle = theme.joint;
    for (let i = 0; i < nodes.length; i++) {
      ctx.beginPath();
      ctx.arc(nodes[i].x * w, nodes[i].y * h, theme.jointRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderHand(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    landmarks: LandmarkPoint[],
    color: string,
    side: string,
  ): void {
    if (landmarks.length < 4) return;

    const theme = THEME_COLORS[this.options.theme];

    ctx.strokeStyle = color;
    ctx.lineWidth = theme.lineWidth;
    ctx.lineCap = "round";

    if (theme.glowEnabled) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }

    for (const [i, j] of HAND_CONNECTIONS) {
      if (i < landmarks.length && j < landmarks.length) {
        ctx.beginPath();
        ctx.moveTo(landmarks[i].x * w, landmarks[i].y * h);
        ctx.lineTo(landmarks[j].x * w, landmarks[j].y * h);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    const palmPoints = [0, 1, 5, 9, 13, 17];
    for (const i of palmPoints) {
      if (i < landmarks.length) {
        ctx.beginPath();
        ctx.arc(landmarks[i].x * w, landmarks[i].y * h, theme.jointRadius + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = side === "left" ? "#FDE68A" : "#BFDBFE";
    const tipPoints = [4, 8, 12, 16, 20];
    for (const i of tipPoints) {
      if (i < landmarks.length) {
        ctx.beginPath();
        ctx.arc(landmarks[i].x * w, landmarks[i].y * h, theme.jointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderNonManualIndicators(
    ctx: CanvasRenderingContext2D,
    w: number,
    nm: NonManualFeatures,
  ): void {
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";

    const indicators = [
      { label: "BROW", value: nm.eyebrowRaise, x: 8, y: 16 },
      { label: "NOD", value: nm.headNod, x: 8, y: 30 },
      { label: "SHAKE", value: nm.headShake, x: 8, y: 44 },
      { label: "MOUTH", value: nm.mouthOpen, x: 8, y: 58 },
    ];

    for (const ind of indicators) {
      ctx.fillStyle = "#475569";
      ctx.fillText(`${ind.label} `, ind.x, ind.y);
      ctx.fillStyle = ind.value > 0.5 ? "#bbf7d0" : ind.value > 0.2 ? "#fde68a" : "#64748b";
      const barW = Math.min(40, ind.value * 40);
      ctx.fillRect(ind.x + 40, ind.y - 8, barW, 6);
    }
  }

  private renderLabels(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    frame: AnimationFrame,
  ): void {
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";

    if (frame.landmarks[0]) {
      for (let i = 0; i < frame.landmarks[0].landmarks.length; i++) {
        const lm = frame.landmarks[0].landmarks[i];
        ctx.fillStyle = "#c0593a";
        ctx.fillText(`${i}`, lm.x * w + 6, lm.y * h);
      }
    }
  }

  private renderFace(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    pose: BodyPose,
    nm: NonManualFeatures,
  ): void {
    const cx = pose.head.x * w;
    const cy = pose.head.y * h;
    const headR = 16;

    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(cx, cy, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const eyeY = cy - 2;
    const eyeSpacing = 6;
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(cx - eyeSpacing, eyeY, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + eyeSpacing, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const mouthY = cy + 6;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (nm.mouthOpen > 0.5) {
      ctx.arc(cx, mouthY + 2, 4, 0, Math.PI);
    } else {
      ctx.arc(cx, mouthY, 4, 0.1, Math.PI - 0.1);
    }
    ctx.stroke();

    if (nm.eyebrowRaise > 0.3) {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - 3, eyeY - 5 - nm.eyebrowRaise * 3);
      ctx.lineTo(cx - eyeSpacing + 3, eyeY - 5);
      ctx.moveTo(cx + eyeSpacing - 3, eyeY - 5);
      ctx.lineTo(cx + eyeSpacing + 3, eyeY - 5 - nm.eyebrowRaise * 3);
      ctx.stroke();
    }

    const smile = nm.facialExpression === "surprised" ? "surprised" : "neutral";
    if (smile === "surprised") {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx, mouthY + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  setRenderMode(mode: RenderMode): void {
    this.options.renderMode = mode;
    this.prevRig = null;
  }

  setSmoothing(alpha: number): void {
    this.options.smoothingAlpha = Math.max(0, Math.min(1, alpha));
  }

  setInterpolation(factor: number): void {
    this.options.interpolationFactor = Math.max(0, Math.min(1, factor));
  }



  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.options.width, this.options.height);
  }

  dispose(): void {
    this.clear();
    this.lastFrame = null;
    this.lastExtra = undefined;
    this.prevBodyPose = null;
    this.prevRig = null;
    this.smoothPose = null;
    this.smoothFace = null;
    this.smoothLeftHand = null;
    this.smoothRightHand = null;
    this.poseHistory = [];
    this.faceHistory = [];
    this.leftHandHistory = [];
    this.rightHandHistory = [];
    this.histTimestamp = [];
    this.renderTimes = [];
    this.frameCount = 0;
    this.measuredFps = 0;
  }
}
