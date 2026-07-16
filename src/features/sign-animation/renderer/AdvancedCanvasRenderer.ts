import type {
  AnimationFrame,
  BodyPose,
  NonManualFeatures,
  AvatarTheme,
  LandmarkPoint,
} from "../types";
import { HAND_CONNECTIONS, BODY_CONNECTIONS, LANDMARK_COLORS, MEDIAPIPE_POSE_CONNECTIONS } from "../types";
import { estimateBodyPose, estimateNonManual, getDefaultNonManual } from "./bodyPoseEstimator";

export interface AdvancedRendererOptions {
  width: number;
  height: number;
  theme: AvatarTheme;
  showLabels: boolean;
  showNonManual: boolean;
  lineWidth: number;
  jointRadius: number;
  backgroundColor: string;
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

export class AdvancedCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: AdvancedRendererOptions;
  private prevBodyPose: BodyPose | null = null;
  private frameCount = 0;
  private lastRenderTime = 0;
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
      backgroundColor: "#0f172a",
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

  setTheme(theme: AvatarTheme): void {
    this.options.theme = theme;
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
      ctx.fillStyle = "#64748b";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No animation data", w / 2, h / 2);
      this.prevBodyPose = null;
      return;
    }

    const bodyPose = extra?.bodyPose ?? estimateBodyPose(frame.landmarks, this.prevBodyPose ?? undefined);
    this.prevBodyPose = bodyPose;

    const nonManual = extra?.nonManual ?? estimateNonManual(frame.landmarks);
    const theme = THEME_COLORS[this.options.theme];

    if (this.options.showNonManual) {
      this.renderNonManualIndicators(ctx, w, nonManual);
    }

    if (frame.poseLandmarks && frame.poseLandmarks.length > 0) {
      this.renderExtractedPose(ctx, w, h, frame.poseLandmarks);
    } else {
      this.renderBody(ctx, w, h, bodyPose, theme);
    }

    if (frame.faceLandmarks && frame.faceLandmarks.length > 0) {
      this.renderExtractedFace(ctx, w, h, frame.faceLandmarks);
    }

    if (this.options.theme === "avatar2d") {
      this.renderFace(ctx, w, h, bodyPose, nonManual);
    }

    const leftHand = frame.landmarks.find((hand) => hand.side === "left")?.landmarks ?? frame.landmarks[0]?.landmarks ?? [];
    const rightHand = frame.landmarks.find((hand) => hand.side === "right")?.landmarks ?? frame.landmarks[1]?.landmarks ?? [];

    this.renderHand(ctx, w, h, leftHand, theme.leftHand, "left");
    this.renderHand(ctx, w, h, rightHand, theme.rightHand, "right");

    if (this.options.showLabels) {
      this.renderLabels(ctx, w, h, bodyPose, frame);
    }

    this.frameCount++;
    const elapsed = performance.now() - renderStart;
    this.renderTimes.push(elapsed);
    if (this.renderTimes.length > 60) this.renderTimes.shift();
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

  private renderExtractedPose(ctx: CanvasRenderingContext2D, w: number, h: number, landmarks: LandmarkPoint[]): void {
    ctx.strokeStyle = "#C0392B";
    ctx.fillStyle = "#E74C3C";
    ctx.lineWidth = 2;
    for (const [start, end] of MEDIAPIPE_POSE_CONNECTIONS) {
      const a = landmarks[start];
      const b = landmarks[end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
    for (const landmark of landmarks) {
      ctx.beginPath();
      ctx.arc(landmark.x * w, landmark.y * h, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderExtractedFace(ctx: CanvasRenderingContext2D, w: number, h: number, landmarks: LandmarkPoint[]): void {
    ctx.fillStyle = "#7F1D1D";
    for (const landmark of landmarks) {
      ctx.beginPath();
      ctx.arc(landmark.x * w, landmark.y * h, 0.8, 0, Math.PI * 2);
      ctx.fill();
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

  private renderLabels(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    pose: BodyPose,
    frame: AnimationFrame,
  ): void {
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";

    const bodyLabels = ["HEAD", "NECK", "TORSO", "L_SHOULDER", "R_SHOULDER", "L_ELBOW", "R_ELBOW", "L_WRIST", "R_WRIST", "L_HAND", "R_HAND"];
    const nodes = [
      pose.head, pose.neck, pose.torso,
      pose.leftShoulder, pose.rightShoulder,
      pose.leftElbow, pose.rightElbow,
      pose.leftWrist, pose.rightWrist,
      pose.leftHand, pose.rightHand,
    ];

    for (let i = 0; i < nodes.length; i++) {
      ctx.fillText(bodyLabels[i], nodes[i].x * w, nodes[i].y * h - 10);
    }

    if (frame.landmarks[0]) {
      for (let i = 0; i < frame.landmarks[0].landmarks.length; i++) {
        const lm = frame.landmarks[0].landmarks[i];
        ctx.fillStyle = "#c0593a";
        ctx.fillText(`${i}`, lm.x * w + 6, lm.y * h);
      }
    }
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
    this.prevBodyPose = null;
    this.renderTimes = [];
    this.frameCount = 0;
  }
}
