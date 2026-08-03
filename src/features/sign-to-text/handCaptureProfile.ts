/**
 * `ideal` is only a hint — a phone is free to ignore it and hand back 1080p at
 * 60fps, which is what made detection cost 500-1000ms per frame on mid-range
 * Android (1-2 FPS, against the 30 the model needs).
 *
 * `max` is honoured much more consistently, and neither is an `exact`
 * constraint, so getUserMedia still succeeds on a device that cannot hit these
 * — it just returns the closest it can. Capping the frame rate matters as much
 * as the resolution: at 60fps half the frames are discarded by the capture
 * throttle anyway, after the camera has already paid to produce them.
 */
export const HAND_CAPTURE_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 640, max: 960 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 30, max: 30 },
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

export type DetectionSensitivity = "relaxed" | "balanced" | "strict";

/**
 * Confidence thresholds MediaPipe applies before it will report a hand.
 *
 * Lower = picks hands up sooner in poor light or at the frame edge, at the
 * cost of more jitter and false positives. Higher = only locks on to a clean,
 * well-lit hand, which steadies the skeleton but drops marginal frames.
 * "balanced" is the long-standing default and matches HAND_LANDMARKER_OPTIONS.
 */
export const SENSITIVITY_PRESETS: Record<
  DetectionSensitivity,
  Pick<
    typeof HAND_LANDMARKER_OPTIONS,
    "minHandDetectionConfidence" | "minHandPresenceConfidence" | "minTrackingConfidence"
  >
> = {
  relaxed: {
    minHandDetectionConfidence: 0.4,
    minHandPresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  },
  balanced: {
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  },
  strict: {
    minHandDetectionConfidence: 0.8,
    minHandPresenceConfidence: 0.8,
    minTrackingConfidence: 0.75,
  },
};

export const SENSITIVITY_LABELS: Record<DetectionSensitivity, { label: string; hint: string }> = {
  relaxed: { label: "Relaxed", hint: "Detects sooner in dim light — more jitter" },
  balanced: { label: "Balanced", hint: "Default — even trade-off" },
  strict: { label: "Strict", hint: "Only clean, well-lit hands — steadiest" },
};

/** MediaPipe options for a sensitivity level; shape is otherwise unchanged. */
export function handLandmarkerOptionsFor(sensitivity: DetectionSensitivity) {
  return { ...HAND_LANDMARKER_OPTIONS, ...SENSITIVITY_PRESETS[sensitivity] };
}