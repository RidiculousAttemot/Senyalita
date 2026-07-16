export const HAND_CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 640 },
    height: { ideal: 480 },
  },
  audio: false,
};

export const HAND_LANDMARKER_OPTIONS = {
  numHands: 2,
  runningMode: "VIDEO" as const,
  minHandDetectionConfidence: 0.6,
  minHandPresenceConfidence: 0.6,
  minTrackingConfidence: 0.6,
};