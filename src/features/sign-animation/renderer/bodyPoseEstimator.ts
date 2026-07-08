import type { LandmarkPoint, HandLandmarks, BodyPose, NonManualFeatures } from "../types";

const DEFAULT_BODY_POSE: BodyPose = {
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
};

const DEFAULT_NON_MANUAL: NonManualFeatures = {
  eyebrowRaise: 0,
  headNod: 0,
  headShake: 0,
  mouthOpen: 0,
  bodyOrientation: 0,
  facialExpression: "neutral",
};

export function estimateBodyPose(
  landmarks: HandLandmarks[],
  prevPose?: BodyPose,
): BodyPose {
  const leftHand = landmarks[0]?.landmarks ?? [];
  const rightHand = landmarks[1]?.landmarks ?? [];

  const leftWristPos = leftHand.length > 0 ? leftHand[0] : { x: -0.55, y: -1.3, z: 0 };
  const rightWristPos = rightHand.length > 0 ? rightHand[0] : { x: 0.55, y: -1.3, z: 0 };

  const leftHandPos = leftHand.length > 0
    ? averageLandmarks(leftHand.slice(5, 9))
    : { x: -0.55, y: -1.4, z: 0 };
  const rightHandPos = rightHand.length > 0
    ? averageLandmarks(rightHand.slice(5, 9))
    : { x: 0.55, y: -1.4, z: 0 };

  const bodyLean = computeBodyLean(leftWristPos, rightWristPos);
  const shoulderWidth = 0.35;
  const shoulderY = -0.5 + bodyLean * 0.1;

  const leftShoulder: LandmarkPoint = {
    x: -shoulderWidth + bodyLean * 0.05,
    y: shoulderY,
    z: 0,
  };
  const rightShoulder: LandmarkPoint = {
    x: shoulderWidth + bodyLean * 0.05,
    y: shoulderY,
    z: 0,
  };

  const headY = -1.6 + bodyLean * 0.05;
  const neckY = -1.2 + bodyLean * 0.05;
  const torsoY = -0.4 + bodyLean * 0.1;

  const head = prevPose
    ? dampenPose({ x: bodyLean * 0.03, y: headY, z: bodyLean * 0.02 }, prevPose.head)
    : { x: bodyLean * 0.03, y: headY, z: bodyLean * 0.02 };

  const neck = prevPose
    ? dampenPose({ x: 0, y: neckY, z: 0 }, prevPose.neck)
    : { x: 0, y: neckY, z: 0 };

  const torso = prevPose
    ? dampenPose({ x: bodyLean * 0.03, y: torsoY, z: 0 }, prevPose.torso)
    : { x: bodyLean * 0.03, y: torsoY, z: 0 };

  const leftElbow = computeElbow(
    leftShoulder,
    leftWristPos,
    "left",
    prevPose?.leftElbow,
  );
  const rightElbow = computeElbow(
    rightShoulder,
    rightWristPos,
    "right",
    prevPose?.rightElbow,
  );

  const wristZ = (leftWristPos.z + rightWristPos.z) / 2;

  return {
    head,
    neck,
    torso,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist: { x: leftWristPos.x, y: leftWristPos.y, z: wristZ },
    rightWrist: { x: rightWristPos.x, y: rightWristPos.y, z: wristZ },
    leftHand: leftHandPos,
    rightHand: rightHandPos,
  };
}

export function getDefaultNonManual(): NonManualFeatures {
  return { ...DEFAULT_NON_MANUAL };
}

export function estimateNonManual(
  landmarks: HandLandmarks[],
): NonManualFeatures {
  const leftHand = landmarks[0]?.landmarks ?? [];

  let eyebrowRaise = 0;
  let headNod = 0;
  let headShake = 0;
  let mouthOpen = 0;
  let bodyOrientation = 0;

  if (leftHand.length > 0) {
    const wristY = leftHand[0].y;
    const palmCenter = averageLandmarks(leftHand.slice(0, 5));
    eyebrowRaise = Math.max(0, Math.min(1, (-palmCenter.y - 1.2) / 0.8));
    headNod = Math.max(0, Math.min(1, Math.abs(leftHand[0].x) * 0.5));

    const wristSpeed = Math.abs(leftHand[0].x - (leftHand[5]?.x ?? 0));
    headShake = Math.min(1, wristSpeed * 0.5);

    const fingerSpread = fingerTipSpread(leftHand);
    mouthOpen = Math.min(1, fingerSpread * 0.3);
  }

  const facialExpression = eyebrowRaise > 0.5 ? "surprised" : "neutral";

  return {
    eyebrowRaise,
    headNod,
    headShake,
    mouthOpen,
    bodyOrientation,
    facialExpression,
  };
}

function averageLandmarks(lms: LandmarkPoint[]): LandmarkPoint {
  if (lms.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = lms.reduce(
    (acc, lm) => ({ x: acc.x + lm.x, y: acc.y + lm.y, z: acc.z + lm.z }),
    { x: 0, y: 0, z: 0 },
  );
  return { x: sum.x / lms.length, y: sum.y / lms.length, z: sum.z / lms.length };
}

function computeBodyLean(
  leftWrist: LandmarkPoint,
  rightWrist: LandmarkPoint,
): number {
  const avgX = (leftWrist.x + rightWrist.x) / 2;
  return Math.max(-0.3, Math.min(0.3, avgX * 0.5));
}

function computeElbow(
  shoulder: LandmarkPoint,
  wrist: LandmarkPoint,
  side: "left" | "right",
  prevElbow?: LandmarkPoint,
): LandmarkPoint {
  const dx = wrist.x - shoulder.x;
  const dy = wrist.y - shoulder.y;
  const armLen = Math.sqrt(dx * dx + dy * dy);
  const maxArm = 0.6;

  let elbowX: number;
  let elbowY: number;

  if (armLen > maxArm) {
    const ratio = maxArm / armLen;
    elbowX = shoulder.x + dx * ratio * 0.6;
    elbowY = shoulder.y + dy * ratio * 0.6 + 0.05;
  } else {
    const midX = (shoulder.x + wrist.x) / 2;
    const midY = (shoulder.y + wrist.y) / 2;
    const bendDir = side === "left" ? -1 : 1;
    elbowX = midX + bendDir * 0.1;
    elbowY = midY + 0.1;
  }

  if (prevElbow) {
    return dampenPose({ x: elbowX, y: elbowY, z: 0 }, prevElbow);
  }
  return { x: elbowX, y: elbowY, z: 0 };
}

function dampenPose(current: LandmarkPoint, prev: LandmarkPoint): LandmarkPoint {
  const factor = 0.3;
  return {
    x: prev.x + (current.x - prev.x) * factor,
    y: prev.y + (current.y - prev.y) * factor,
    z: prev.z + (current.z - prev.z) * factor,
  };
}

function fingerTipSpread(landmarks: LandmarkPoint[]): number {
  if (landmarks.length < 20) return 0;
  const tips = [4, 8, 12, 16, 20];
  let spread = 0;
  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      const a = landmarks[tips[i]];
      const b = landmarks[tips[j]];
      spread += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  }
  return spread;
}
