export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  landmarks: LandmarkPoint[];
  side?: "left" | "right";
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
  poseLandmarks?: LandmarkPoint[];
  faceLandmarks?: LandmarkPoint[];
}

export interface GestureAnimationAsset {
  label: string;
  language: string;
  fps: number;
  duration: number;
  totalFrames: number;
  frames: AnimationFrame[];
  /** Path/URL to original source video */
  video?: string;
  /** Original video dimensions for pixel-space rendering */
  imageWidth?: number;
  imageHeight?: number;
  /** Seconds into `video` where this (trimmed) asset's first frame sits. */
  sourceOffsetSeconds?: number;
  /** Present when idle lead-in/trail-off was removed from the capture. */
  trim?: {
    originalTotalFrames: number;
    startFrame: number;
    endFrame: number;
    method: string;
  };
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
export type ViewMode = "human" | "skeleton" | "split" | "overlay";

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
  onFrame?: (frame: AnimationFrame, time: number, clip: AnimationClip, frameIndex?: number) => void;
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

export const MEDIAPIPE_POSE_CONNECTIONS: ConnectionPair[] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32],
];

/** Official MediaPipe Pose connections (33 landmarks) */
export const FULL_POSE_CONNECTIONS: ConnectionPair[] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

export const FACE_OVAL: number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
  361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109, 10,
];

export const FACE_LEFT_EYEBROW: number[] = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];
export const FACE_RIGHT_EYEBROW: number[] = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];
export const FACE_LEFT_EYE: number[] = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const FACE_RIGHT_EYE: number[] = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
export const FACE_NOSE_BRIDGE: number[] = [168, 193, 122, 196, 419];
export const FACE_NOSE_TIP: number[] = [1, 2, 98, 97];
export const FACE_LIPS_OUTER: number[] = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const FACE_LIPS_INNER: number[] = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 316, 315];

// --- Phase 2: Natural Sign Playback types ---

export type SentenceType = "statement" | "question" | "exclamation" | "command" | "greeting" | "unknown";

export interface ExpressionRule {
  sentenceType: SentenceType;
  expression: string;
  intensity: number;
}

export interface TransitionPlan {
  fromGesture: string;
  toGesture: string;
  fromFrame: AnimationFrame | null;
  toFrame: AnimationFrame | null;
  duration: number;
  blendMethod: "linear" | "smoothstep" | "anticipate";
  holdBefore: number;
  holdAfter: number;
}

export interface AnimationPlan {
  gestures: string[];
  transitions: TransitionPlan[];
  totalDuration: number;
  expressionTimeline: Array<{ time: number; expression: string; intensity: number }>;
  pauseTimeline: Array<{ time: number; duration: number; reason: string }>;
}

export interface FingerspellingConfig {
  enabled: boolean;
  speed: number;
  letterPause: number;
  handShape: "right" | "left";
}

export interface ResolverResult {
  resolved: boolean;
  strategy: ResolutionStrategy;
  originalGloss: string;
  resolvedGloss: string;
  asset: GestureAnimationAsset | null;
  confidence: number;
  fallbackChain?: string[];
}

export interface PlaybackAnalyticsEvent {
  type: "gesture_played" | "transition" | "fingerspell" | "resolution_fallback" | "cache_hit" | "cache_miss" | "phrase_resolved" | "recommendation" | "translation_latency";
  timestamp: number;
  gesture?: string;
  duration?: number;
  details?: string;
}

export interface AnimationInspectorData {
  originalGloss: string;
  resolvedGloss: string;
  strategy: ResolverResult["strategy"];
  assetDuration: number;
  frameCount: number;
  fps: number;
  transitionIn: string | null;
  transitionOut: string | null;
  expression: string;
  timingSpeed: number;
  confidence: number;
  missingFrames: number;
  coarticulationScore: number;
  cacheHit: boolean;
}

// --- Phase 3: Intelligent Sentence-Level types ---

export interface PhraseEntry {
  phrase: string;
  canonicalKey: string;
  type: "greeting" | "common" | "question" | "farewell" | "politeness";
}

export interface PlaybackSegment {
  type: "phrase" | "gloss" | "fingerspell" | "pause";
  originalText: string;
  resolvedText: string;
  asset: GestureAnimationAsset | null;
  duration: number;
  strategy: ResolverResult["strategy"];
  expression: string;
}

export interface PlaybackPlan {
  inputText: string;
  language: string;
  sentenceType: SentenceType;
  segments: PlaybackSegment[];
  totalDuration: number;
  expressionTimeline: Array<{ time: number; expression: string; intensity: number }>;
  pauseTimeline: Array<{ time: number; duration: number; reason: string }>;
  transitionTimeline: Array<{ time: number; from: string; to: string; duration: number }>;
  metadata: {
    phraseCount: number;
    glossCount: number;
    fingerspellCount: number;
    pauseCount: number;
    fallbackCount: number;
    resolutionChain: string[];
  };
}

export interface MotionCurveConfig {
  interpolation: "linear" | "smoothstep" | "ease-in" | "ease-out" | "ease-in-out" | "bezier";
  bezierPoints?: [number, number, number, number];
  handSpeed: number;
  wristSpeed: number;
  elbowSpeed: number;
  shoulderSpeed: number;
  bodySpeed: number;
}

export interface BodyMotionConfig {
  enabled: boolean;
  idleBreathing: boolean;
  headMotion: boolean;
  shoulderMovement: boolean;
  torsoSway: boolean;
  weightShifting: boolean;
  naturalRestPose: boolean;
  amplitude: number;
}

export interface AnimationRecommendation {
  word: string;
  frequency: number;
  language: string;
  firstSeen: number;
  lastSeen: number;
  currentPlayback: string;
  occurrences: number;
  recommendation: string;
}

export interface TranslationPipelinePlugin {
  name: string;
  init: () => Promise<void>;
  translate?: (text: string, context: { language: string; sentenceType: SentenceType }) => Promise<string[]>;
  generatePose?: (text: string, context: { language: string }) => Promise<GestureAnimationAsset | null>;
  isAvailable: () => boolean;
}

export type ResolutionStrategy =
  | "exact_phrase"
  | "phrase_alias"
  | "exact_gloss"
  | "gloss_alias"
  | "synonym"
  | "morphological"
  | "category_mapping"
  | "fingerspell"
  | "unknown_placeholder";
