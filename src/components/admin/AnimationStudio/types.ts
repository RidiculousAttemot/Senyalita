import type {
  AnimationFrame,
  GestureAnimationAsset,
} from "@/features/sign-animation/types";

export type ExtractionStatus =
  | "idle"
  | "reading"
  | "extracting"
  | "normalizing"
  | "generating"
  | "complete"
  | "error";

export interface ExtractionProgress {
  status: ExtractionStatus;
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
  message: string;
}

export interface VideoMetadata {
  file: File;
  url: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  fileSize: number;
}

export interface ExtractionResult {
  asset: GestureAnimationAsset;
  frames: AnimationFrame[];
  metadata: {
    sourceFps: number;
    extractedFrames: number;
    processingTime: number;
  };
}

export type PublishStatus = "draft" | "published" | "archived";

export interface PublishData {
  gloss: string;
  category: string;
  language: string;
  difficulty: string;
  keywords: string[];
  notes: string;
  status: PublishStatus;
}
