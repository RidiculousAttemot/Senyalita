export const ANIMATION_ASSET_STATUSES = [
  "pending",
  "processing",
  "failed",
  "ready",
  "approved",
  "published",
  "archived",
] as const;

export type AnimationAssetStatus = (typeof ANIMATION_ASSET_STATUSES)[number];

export type AnimationProcessingStatus = "queued" | "processing" | "completed" | "failed";

export type AnimationAsset = {
  id: string;
  gloss: string;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AnimationAssetVersion = {
  id: string;
  asset_id: string;
  version: number;
  source_video_path: string | null;
  landmark_json_path: string | null;
  status: AnimationAssetStatus;
  fps: number | null;
  total_frames: number | null;
  duration_ms: number | null;
  quality_score: number | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnimationAssetReview = {
  id: string;
  version_id: string;
  reviewer_id: string;
  decision: "approved" | "rejected";
  notes: string | null;
  created_at: string;
};

export type AnimationProcessingJob = {
  id: string;
  version_id: string;
  status: AnimationProcessingStatus;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export const canPublishAnimationVersion = (status: AnimationAssetStatus): boolean => status === "approved";