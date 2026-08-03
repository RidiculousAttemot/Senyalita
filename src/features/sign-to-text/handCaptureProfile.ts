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

/**
 * One hand, not two — the single biggest lever on detection cost.
 *
 * MediaPipe runs its landmark model once per tracked hand, so `numHands: 2`
 * costs roughly double. Measured on /translate against a software-rendered GPU
 * (a reasonable stand-in for a weak phone):
 *
 *   numHands 2, 480px input -> 631ms per detection, 1 FPS
 *   numHands 1, 480px input -> 342ms per detection, 3 FPS
 *   numHands 1, 320px input -> 360ms per detection, 2 FPS
 *
 * Input resolution is a red herring: MediaPipe resizes to 224x224 internally,
 * so shrinking the frame below that buys nothing and 320 measured no better
 * than 480.
 *
 * THE TRADE: two-handed signs lose their second hand. Sign-to-Text is
 * alphabet-scoped — FSL fingerspelling is one-handed and the UI treats every
 * prediction as a single character (README, "The model") — so this costs
 * nothing on the deployed workflow. It would degrade the two-handed phrases
 * among the model's 105 non-letter classes if that path is ever surfaced, and
 * this is the line to revisit first if so.
 *
 * The feature vector is unchanged at 126 (two hands x 21 x 3); the absent hand
 * is zero-filled, exactly as it already is whenever only one hand is in frame.
 */
export const HAND_LANDMARKER_OPTIONS = {
  numHands: 1,
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