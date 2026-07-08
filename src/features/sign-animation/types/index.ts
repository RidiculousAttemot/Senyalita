export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  landmarks: LandmarkPoint[];
}

export interface BodyPose {
  head: LandmarkPoint;
  neck: LandmarkPoint;
  torso: LandmarkPoint;
  leftShoulder: LandmarkPoint;
  rightShoulder: LandmarkPoint;
  leftElbow: LandmarkPoint;
  rightElbow: LandmarkPoint;
  leftWrist: LandmarkPoint;
  rightWrist: LandmarkPoint;
  leftHand: LandmarkPoint;
  rightHand: LandmarkPoint;
}

export interface NonManualFeatures {
  eyebrowRaise: number;
  headNod: number;
  headShake: number;
  mouthOpen: number;
  bodyOrientation: number;
  facialExpression: string;
}

export interface EnhancedFrame {
  timestamp: number;
  landmarks: HandLandmarks[];
  bodyPose?: BodyPose;
  nonManual?: NonManualFeatures;
}

export interface AnimationFrame {
  timestamp: number;
  landmarks: HandLandmarks[];
}

export interface GestureAnimationAsset {
  label: string;
  language: string;
  fps: number;
  duration: number;
  totalFrames: number;
  frames: AnimationFrame[];
  metadata: {
    signerId?: string;
    source?: string;
    featureDimension: number;
    sequenceLength: number;
    handedness?: string;
    version: number;
  };
}

export interface AnimationClip {
  id: string;
  gesture: string;
  asset: GestureAnimationAsset;
}

export interface AnimationQueueItem {
  gesture: string;
  original: string;
  clip: AnimationClip;
  priority: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  currentGesture: string | null;
  currentIndex: number;
  queueLength: number;
  speed: number;
  loop: boolean;
}

export type AvatarTheme = "minimal" | "skeleton" | "flat" | "avatar2d";

export interface AvatarThemeConfig {
  id: AvatarTheme;
  name: string;
  description: string;
}

export const AVATAR_THEMES: AvatarThemeConfig[] = [
  { id: "minimal", name: "Minimal", description: "Simplified stick figure" },
  { id: "skeleton", name: "Skeleton", description: "Bone-like structure with joints" },
  { id: "flat", name: "Flat", description: "Solid shapes and rounded caps" },
  { id: "avatar2d", name: "2D Avatar", description: "Cartoon-style character" },
];

export type InterpolationMethod = "linear" | "cubic" | "catmull-rom" | "smoothstep";

export interface MotionSmoothingConfig {
  interpolation: InterpolationMethod;
  velocitySmoothing: boolean;
  motionDamping: number;
  jitterThreshold: number;
}

export interface CoarticulationConfig {
  enabled: boolean;
  blendDuration: number;
  wristContinuity: boolean;
  bodyContinuity: boolean;
  trajectoryOptimization: boolean;
}

export interface GestureTimingConfig {
  baseSpeed: number;
  adjustByComplexity: boolean;
  adjustByPunctuation: boolean;
  minDuration: number;
  maxDuration: number;
}

export interface AnimationQualityMetrics {
  gesture: string;
  smoothness: number;
  frameCount: number;
  missingLandmarks: number;
  transitionQuality: number;
  playbackDuration: number;
  assetComplete: boolean;
  totalScore: number;
}

export type PlaybackEventCallback = {
  onFrame?: (frame: AnimationFrame, time: number, clip: AnimationClip) => void;
  onGestureChange?: (gesture: string, index: number, total: number) => void;
  onComplete?: (clip: AnimationClip) => void;
  onQueueComplete?: () => void;
};

export type ConnectionPair = [number, number];

export const HAND_CONNECTIONS: ConnectionPair[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export const LANDMARK_COLORS: Record<string, string> = {
  left: "#C0593A",
  right: "#60A5FA",
};

export const BODY_CONNECTIONS: ConnectionPair[] = [
  [0, 1], [1, 2], // head → neck → torso
  [1, 3], [1, 4], // neck → shoulders
  [3, 5], [4, 6], // shoulders → elbows
  [5, 7], [6, 8], // elbows → wrists
  [7, 9], [8, 10], // wrists → hands
];
