export type RecordedLandmarkPoint = {
  x: number;
  y: number;
  z: number;
};

export type RecordedHand = {
  handedness?: string;
  landmarks: RecordedLandmarkPoint[];
};

export type RecordedFrame = {
  timestampMs: number;
  handCount: number;
  hands: RecordedHand[];
};

export type RecordingSession = {
  label: string;
  createdAt: string;
  durationMs: number;
  frameCount: number;
  source: "mediapipe-hands";
  frames: RecordedFrame[];
};

export type ExportPayload = {
  app: "SignLangVisual";
  phase: 3;
  label: string;
  createdAt: string;
  durationMs: number;
  frameCount: number;
  source: "mediapipe-hands";
  frames: RecordedFrame[];
};
