import type { JointName, JointPosition, Keyframe, SkeletonPose } from "./types";
import { JOINT_NAMES } from "./types";
import { applyEasing } from "./easing";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpJoint(a: JointPosition, b: JointPosition, t: number): JointPosition {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function interpolatePose(
  keyframes: Keyframe[],
  time: number,
): SkeletonPose {
  if (keyframes.length === 0) {
    return {
      joints: Object.fromEntries(
        JOINT_NAMES.map((j) => [j, { x: 0, y: 0, z: 0 }]),
      ) as Record<JointName, JointPosition>,
    };
  }

  if (keyframes.length === 1) {
    return keyframes[0].pose;
  }

  if (time <= keyframes[0].time) {
    return keyframes[0].pose;
  }

  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].pose;
  }

  let i = 0;
  for (let j = 0; j < keyframes.length - 1; j++) {
    if (time >= keyframes[j].time && time <= keyframes[j + 1].time) {
      i = j;
      break;
    }
  }

  const a = keyframes[i];
  const b = keyframes[i + 1];
  const duration = b.time - a.time;
  const rawT = duration > 0 ? (time - a.time) / duration : 0;
  const easeType = a.ease ?? "ease-in-out";
  const t = applyEasing(rawT, easeType);

  const joints = {} as Record<JointName, JointPosition>;
  for (const jointName of JOINT_NAMES) {
    joints[jointName] = lerpJoint(
      a.pose.joints[jointName],
      b.pose.joints[jointName],
      t,
    );
  }

  return { joints };
}
