import { ExportPayload, RecordedFrame } from "./types";

export const MAX_RECORDING_MS = 10000;
export const MAX_FRAMES = 300;

export const sanitizeLabel = (label: string): string => {
  const cleaned = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "sample";
};

export const createExportPayload = (params: {
  label: string;
  frames: RecordedFrame[];
  startedAtMs: number;
  endedAtMs: number;
}): ExportPayload => {
  const durationMs = Math.max(0, params.endedAtMs - params.startedAtMs);

  return {
    app: "SignLangVisual",
    phase: 3,
    label: params.label,
    createdAt: new Date(params.startedAtMs).toISOString(),
    durationMs,
    frameCount: params.frames.length,
    source: "mediapipe-hands",
    frames: params.frames
  };
};

export const buildExportFilename = (label: string, timestampMs: number) => {
  return `signlangvisual_${sanitizeLabel(label)}_${timestampMs}.json`;
};

export const downloadJson = (filename: string, payload: ExportPayload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
