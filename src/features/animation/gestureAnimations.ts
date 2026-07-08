import type { JointName, JointPosition, Keyframe, GestureAnimation, SkeletonPose } from "./types";
import { JOINT_NAMES, REST_POSE } from "./types";

function p(x: number, y: number, z = 0): JointPosition {
  return { x, y, z };
}

function kf(time: number, j: Partial<Record<JointName, JointPosition>>): Keyframe {
  const pose: SkeletonPose = {
    joints: { ...REST_POSE.joints, ...j } as Record<JointName, JointPosition>,
  };
  return { time, pose };
}

export const GESTURE_ANIMATIONS: Record<string, GestureAnimation> = {
  HELLO: {
    version: 1, gesture: "HELLO", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.8), rightWrist: p(0.25, -0.7), rightElbow: p(0.35, -0.6) }),
      kf(0.6, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4) }),
      kf(0.9, { rightHand: p(0.25, -0.6), rightWrist: p(0.2, -0.5) }),
      kf(1.2, {}),
    ],
  },
  "THANK YOU": {
    version: 1, gesture: "THANK YOU", duration: 1.8, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.7), rightWrist: p(0.2, -0.6) }),
      kf(0.6, { rightHand: p(0.1, -0.3), rightWrist: p(0.05, -0.2), rightElbow: p(0.2, -0.4) }),
      kf(0.9, { rightHand: p(-0.1, -0.5), rightWrist: p(-0.05, -0.4) }),
      kf(1.2, { rightHand: p(0.1, -0.3), rightWrist: p(0.05, -0.2) }),
      kf(1.5, {}),
    ],
  },
  YES: {
    version: 1, gesture: "YES", duration: 1.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.15, { rightHand: p(0.2, -0.6), rightWrist: p(0.15, -0.5) }),
      kf(0.35, { rightHand: p(0.0, -0.3), rightWrist: p(0.0, -0.2) }),
      kf(0.5, { rightHand: p(0.1, -0.4), rightWrist: p(0.1, -0.3) }),
      kf(0.7, { rightHand: p(0.2, -0.6), rightWrist: p(0.15, -0.5) }),
      kf(0.85, {}),
    ],
  },
  NO: {
    version: 1, gesture: "NO", duration: 1.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.2, { head: p(0.05, -1.6) }),
      kf(0.4, { head: p(-0.05, -1.6) }),
      kf(0.6, { head: p(0.05, -1.6) }),
      kf(0.8, {}),
    ],
  },
  PLEASE: {
    version: 1, gesture: "PLEASE", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { leftHand: p(-0.3, -0.7), leftWrist: p(-0.25, -0.6), rightHand: p(0.3, -0.7), rightWrist: p(0.25, -0.6) }),
      kf(0.5, { leftHand: p(-0.2, -0.4), leftWrist: p(-0.15, -0.3), rightHand: p(0.2, -0.4), rightWrist: p(0.15, -0.3) }),
      kf(0.75, { leftHand: p(-0.25, -0.5), leftWrist: p(-0.2, -0.4), rightHand: p(0.25, -0.5), rightWrist: p(0.2, -0.4) }),
      kf(1.0, { leftHand: p(-0.3, -0.7), leftWrist: p(-0.25, -0.6), rightHand: p(0.3, -0.7), rightWrist: p(0.25, -0.6) }),
      kf(1.25, {}),
    ],
  },
  SORRY: {
    version: 1, gesture: "SORRY", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.0, -0.3), rightWrist: p(0.0, -0.2) }),
      kf(0.6, { rightHand: p(-0.1, -0.5), rightWrist: p(-0.05, -0.4) }),
      kf(0.9, { rightHand: p(0.0, -0.7), rightWrist: p(0.0, -0.6) }),
      kf(1.2, {}),
    ],
  },
  "HOW ARE YOU": {
    version: 1, gesture: "HOW ARE YOU", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.4, -0.3), rightWrist: p(0.3, -0.2), leftHand: p(-0.4, -0.3), leftWrist: p(-0.3, -0.2) }),
      kf(0.6, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4), leftHand: p(-0.3, -0.5), leftWrist: p(-0.2, -0.4) }),
      kf(0.9, { rightHand: p(0.2, -0.7), rightWrist: p(0.15, -0.6), leftHand: p(-0.2, -0.7), leftWrist: p(-0.15, -0.6) }),
      kf(1.2, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4), leftHand: p(-0.3, -0.5), leftWrist: p(-0.2, -0.4) }),
      kf(1.5, {}),
    ],
  },
  "GOOD MORNING": {
    version: 1, gesture: "GOOD MORNING", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.4, -0.4), rightWrist: p(0.3, -0.3) }),
      kf(0.6, { rightHand: p(0.5, 0.0), rightWrist: p(0.4, 0.1) }),
      kf(0.9, { rightHand: p(0.4, -0.2), rightWrist: p(0.3, -0.1) }),
      kf(1.2, { rightHand: p(0.4, -0.4), rightWrist: p(0.3, -0.3) }),
      kf(1.5, {}),
    ],
  },
  "GOOD AFTERNOON": {
    version: 1, gesture: "GOOD AFTERNOON", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.4, -0.4), rightWrist: p(0.3, -0.3) }),
      kf(0.6, { rightHand: p(0.5, -0.2), rightWrist: p(0.4, -0.1) }),
      kf(0.9, { rightHand: p(0.4, -0.4), rightWrist: p(0.3, -0.3) }),
      kf(1.2, { rightHand: p(0.4, -0.6), rightWrist: p(0.3, -0.5) }),
      kf(1.5, {}),
    ],
  },
  "GOOD EVENING": {
    version: 1, gesture: "GOOD EVENING", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.4, -0.4), rightWrist: p(0.3, -0.3) }),
      kf(0.6, { rightHand: p(0.5, -0.1), rightWrist: p(0.4, 0.0) }),
      kf(0.9, { rightHand: p(0.3, -0.3), rightWrist: p(0.2, -0.2) }),
      kf(1.2, {}),
    ],
  },
  "IM FINE": {
    version: 1, gesture: "IM FINE", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.6), rightWrist: p(0.2, -0.5) }),
      kf(0.6, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(0.9, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4) }),
      kf(1.2, {}),
    ],
  },
  "NICE TO MEET YOU": {
    version: 1, gesture: "NICE TO MEET YOU", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.6), rightWrist: p(0.2, -0.5), leftHand: p(-0.3, -0.6), leftWrist: p(-0.2, -0.5) }),
      kf(0.6, { rightHand: p(0.1, -0.3), rightWrist: p(0.05, -0.2), leftHand: p(-0.1, -0.3), leftWrist: p(-0.05, -0.2) }),
      kf(0.9, { rightHand: p(0.2, -0.4), rightWrist: p(0.15, -0.3), leftHand: p(-0.2, -0.4), leftWrist: p(-0.15, -0.3) }),
      kf(1.2, { rightHand: p(0.3, -0.6), rightWrist: p(0.2, -0.5), leftHand: p(-0.3, -0.6), leftWrist: p(-0.2, -0.5) }),
      kf(1.5, {}),
    ],
  },
  "YOURE WELCOME": {
    version: 1, gesture: "YOURE WELCOME", duration: 1.8, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4) }),
      kf(0.6, { rightHand: p(0.2, -0.2), rightWrist: p(0.15, -0.1) }),
      kf(0.9, { rightHand: p(0.1, -0.4), rightWrist: p(0.05, -0.3) }),
      kf(1.2, { rightHand: p(0.2, -0.6), rightWrist: p(0.15, -0.5) }),
      kf(1.5, {}),
    ],
  },
  "SEE YOU TOMORROW": {
    version: 1, gesture: "SEE YOU TOMORROW", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.4, -0.3), rightWrist: p(0.3, -0.2) }),
      kf(0.6, { rightHand: p(0.5, 0.0), rightWrist: p(0.4, 0.1) }),
      kf(0.9, { rightHand: p(0.4, -0.2), rightWrist: p(0.3, -0.1) }),
      kf(1.2, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4) }),
      kf(1.5, {}),
    ],
  },
  UNDERSTAND: {
    version: 1, gesture: "UNDERSTAND", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4), leftHand: p(-0.2, -0.5), leftWrist: p(-0.15, -0.4) }),
      kf(0.6, { rightHand: p(0.1, -0.2), rightWrist: p(0.05, -0.1) }),
      kf(0.9, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4), leftHand: p(-0.2, -0.5), leftWrist: p(-0.15, -0.4) }),
      kf(1.2, {}),
    ],
  },
  "DON'T UNDERSTAND": {
    version: 1, gesture: "DON'T UNDERSTAND", duration: 1.8, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4), leftHand: p(-0.2, -0.5), leftWrist: p(-0.15, -0.4) }),
      kf(0.6, { rightHand: p(0.3, -0.2), rightWrist: p(0.25, -0.1) }),
      kf(0.9, { rightHand: p(0.4, -0.4), rightWrist: p(0.3, -0.3), head: p(0.05, -1.6) }),
      kf(1.2, {}),
    ],
  },
  KNOW: {
    version: 1, gesture: "KNOW", duration: 1.2, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(0.5, { rightHand: p(0.1, -0.1), rightWrist: p(0.05, 0.0) }),
      kf(0.75, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(1.0, {}),
    ],
  },
  "DON'T KNOW": {
    version: 1, gesture: "DON'T KNOW", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(0.5, { rightHand: p(0.1, -0.1), rightWrist: p(0.05, 0.0), head: p(0.05, -1.6) }),
      kf(0.75, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(1.0, { rightHand: p(0.3, -0.5), rightWrist: p(0.25, -0.4) }),
      kf(1.25, {}),
    ],
  },
  WRONG: {
    version: 1, gesture: "WRONG", duration: 1.2, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.2, { head: p(-0.05, -1.6), rightHand: p(0.4, -0.5), rightWrist: p(0.3, -0.4) }),
      kf(0.4, { head: p(0.05, -1.6), rightHand: p(0.5, -0.3), rightWrist: p(0.4, -0.2) }),
      kf(0.6, {}),
      kf(0.8, {}),
    ],
  },
  CORRECT: {
    version: 1, gesture: "CORRECT", duration: 1.2, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.2, { head: p(0, -1.5), rightHand: p(0.2, -0.4), rightWrist: p(0.15, -0.3) }),
      kf(0.4, { rightHand: p(0.3, -0.2), rightWrist: p(0.25, -0.1) }),
      kf(0.6, { rightHand: p(0.2, -0.4), rightWrist: p(0.15, -0.3) }),
      kf(0.8, {}),
    ],
  },
  SLOW: {
    version: 1, gesture: "SLOW", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.5, { rightHand: p(0.5, -0.2), rightWrist: p(0.4, -0.1) }),
      kf(1.0, { rightHand: p(0.3, -0.6), rightWrist: p(0.2, -0.5) }),
      kf(1.5, { rightHand: p(0.5, -0.4), rightWrist: p(0.4, -0.3) }),
      kf(1.75, {}),
    ],
  },
  FAST: {
    version: 1, gesture: "FAST", duration: 0.8, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.15, { rightHand: p(0.5, -0.3), rightWrist: p(0.4, -0.2) }),
      kf(0.3, { rightHand: p(0.2, -0.1), rightWrist: p(0.15, 0.0) }),
      kf(0.45, { rightHand: p(0.5, -0.3), rightWrist: p(0.4, -0.2) }),
      kf(0.6, {}),
    ],
  },
  HOT: {
    version: 1, gesture: "HOT", duration: 1.2, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(0.5, { rightHand: p(0.3, -0.1), rightWrist: p(0.25, 0.0) }),
      kf(0.7, { rightHand: p(0.2, -0.3), rightWrist: p(0.15, -0.2) }),
      kf(0.9, {}),
    ],
  },
  COLD: {
    version: 1, gesture: "COLD", duration: 1.2, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { rightHand: p(0.3, -0.4), rightWrist: p(0.25, -0.3), leftHand: p(-0.3, -0.4), leftWrist: p(-0.25, -0.3) }),
      kf(0.5, { rightHand: p(0.4, -0.2), rightWrist: p(0.35, -0.1), leftHand: p(-0.4, -0.2), leftWrist: p(-0.35, -0.1) }),
      kf(0.7, { rightHand: p(0.3, -0.4), rightWrist: p(0.25, -0.3), leftHand: p(-0.3, -0.4), leftWrist: p(-0.25, -0.3) }),
      kf(0.9, {}),
    ],
  },
  FATHER: {
    version: 1, gesture: "FATHER", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.4, -0.3), rightWrist: p(0.3, -0.2) }),
      kf(0.6, { rightHand: p(0.3, 0.0), rightWrist: p(0.25, 0.1) }),
      kf(0.9, { rightHand: p(0.4, -0.3), rightWrist: p(0.3, -0.2) }),
      kf(1.2, {}),
    ],
  },
  MOTHER: {
    version: 1, gesture: "MOTHER", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.4), rightWrist: p(0.2, -0.3) }),
      kf(0.6, { rightHand: p(0.2, -0.1), rightWrist: p(0.15, 0.0) }),
      kf(0.9, { rightHand: p(0.3, -0.4), rightWrist: p(0.2, -0.3) }),
      kf(1.2, {}),
    ],
  },
  DEAF: {
    version: 1, gesture: "DEAF", duration: 1.3, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4) }),
      kf(0.5, { rightHand: p(0.2, -0.2), rightWrist: p(0.15, -0.1) }),
      kf(0.75, { rightHand: p(0.3, -0.5), rightWrist: p(0.2, -0.4) }),
      kf(1.0, {}),
    ],
  },
  "HARD OF HEARING": {
    version: 1, gesture: "HARD OF HEARING", duration: 2.0, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.4), rightWrist: p(0.2, -0.3) }),
      kf(0.6, { rightHand: p(0.2, 0.0), rightWrist: p(0.15, 0.1) }),
      kf(0.9, { rightHand: p(0.1, -0.3), rightWrist: p(0.05, -0.2) }),
      kf(1.2, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4) }),
      kf(1.6, {}),
    ],
  },
  BLIND: {
    version: 1, gesture: "BLIND", duration: 1.3, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.25, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4) }),
      kf(0.5, { rightHand: p(0.1, -0.2), rightWrist: p(0.05, -0.1) }),
      kf(0.75, { rightHand: p(0.2, -0.5), rightWrist: p(0.15, -0.4) }),
      kf(1.0, {}),
    ],
  },
  MARRIED: {
    version: 1, gesture: "MARRIED", duration: 1.5, fps: 30,
    keyframes: [
      kf(0, {}),
      kf(0.3, { rightHand: p(0.3, -0.3), rightWrist: p(0.25, -0.2), leftHand: p(-0.3, -0.3), leftWrist: p(-0.25, -0.2) }),
      kf(0.6, { rightHand: p(0.2, -0.1), rightWrist: p(0.15, 0.0), leftHand: p(-0.2, -0.1), leftWrist: p(-0.15, 0.0) }),
      kf(0.9, { rightHand: p(0.3, -0.3), rightWrist: p(0.25, -0.2), leftHand: p(-0.3, -0.3), leftWrist: p(-0.25, -0.2) }),
      kf(1.2, {}),
    ],
  },
};

export function getAnimation(gesture: string): GestureAnimation | null {
  return GESTURE_ANIMATIONS[gesture] ?? null;
}

export function hasAnimation(gesture: string): boolean {
  return gesture in GESTURE_ANIMATIONS;
}

export function listAnimatedGestures(): string[] {
  return Object.keys(GESTURE_ANIMATIONS);
}
