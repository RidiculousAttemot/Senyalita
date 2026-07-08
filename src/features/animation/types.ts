export type JointName =
  | "head"
  | "neck"
  | "torso"
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "leftHand"
  | "rightHand"
  | "leftHip"
  | "rightHip";

export const JOINT_NAMES: JointName[] = [
  "head",
  "neck",
  "torso",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftHand",
  "rightHand",
  "leftHip",
  "rightHip",
];

export interface JointPosition {
  x: number;
  y: number;
  z: number;
}

export interface SkeletonPose {
  joints: Record<JointName, JointPosition>;
}

export interface Keyframe {
  time: number;
  pose: SkeletonPose;
  ease?: EasingType;
}

export type EasingType =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "bounce"
  | "elastic";

export interface GestureAnimation {
  version: number;
  gesture: string;
  duration: number;
  fps: number;
  keyframes: Keyframe[];
}

export interface AnimationClip {
  id: string;
  gesture: string;
  animation: GestureAnimation;
  metadata?: AnimationMetadata;
}

export interface AnimationState {
  currentClip: AnimationClip | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  playbackSpeed: number;
  queue: AnimationClip[];
  currentKeyframeIndex: number;
}

export interface AnimationMetadata {
  label: string;
  category: "alphabet" | "phrase";
  difficulty: number;
  meaning: string;
}

export const REST_POSE: SkeletonPose = {
  joints: {
    head: { x: 0, y: -1.6, z: 0 },
    neck: { x: 0, y: -1.2, z: 0 },
    torso: { x: 0, y: -0.4, z: 0 },
    leftShoulder: { x: -0.35, y: -0.5, z: 0 },
    rightShoulder: { x: 0.35, y: -0.5, z: 0 },
    leftElbow: { x: -0.55, y: -0.9, z: 0 },
    rightElbow: { x: 0.55, y: -0.9, z: 0 },
    leftWrist: { x: -0.55, y: -1.3, z: 0 },
    rightWrist: { x: 0.55, y: -1.3, z: 0 },
    leftHand: { x: -0.55, y: -1.4, z: 0 },
    rightHand: { x: 0.55, y: -1.4, z: 0 },
    leftHip: { x: -0.15, y: 0.2, z: 0 },
    rightHip: { x: 0.15, y: 0.2, z: 0 },
  },
};
