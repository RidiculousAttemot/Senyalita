import type { GestureAnimationAsset } from "@/features/sign-animation/types";

export interface AnimationLibraryAsset {
  id: string;
  gloss: string;
  publishedVersionId: string | null;
  status: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
  publishedVersion: {
    id: string;
    version: number;
    fps: number | null;
    totalFrames: number | null;
    durationMs: number | null;
    qualityScore: number | null;
    landmarkJsonPath: string | null;
    status: string;
    approvedBy: string | null;
    approvedAt: string | null;
    createdBy: string | null;
  } | null;
  latestVersion: {
    id: string;
    version: number;
    status: string;
    fps: number | null;
    totalFrames: number | null;
    durationMs: number | null;
    qualityScore: number | null;
    createdAt: string;
    createdBy: string | null;
  } | null;
  reviewCount: number;
}

export interface AnimationLibraryQuery {
  search?: string;
  status?: string;
  category?: string;
  language?: string;
  difficulty?: string;
  sort?: "recent" | "published" | "gloss";
}

export interface AnimationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    hasPoseLandmarks: boolean;
    hasFaceLandmarks: boolean;
    hasHandLandmarks: boolean;
    missingFrameCount: number;
    averageConfidence: number;
    totalMovement: number;
    durationMs: number;
    frameCount: number;
    fps: number;
  };
}

export const animationLibrary = {
  async list(query?: AnimationLibraryQuery): Promise<AnimationLibraryAsset[]> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.status) params.set("status", query.status);
    if (query?.sort) params.set("sort", query.sort);
    const qs = params.toString();
    const res = await fetch(`/api/admin/animation-assets${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error("Failed to list animation assets");
    const data = await res.json();
    return data.assets as AnimationLibraryAsset[];
  },

  async get(gloss: string): Promise<AnimationLibraryAsset | null> {
    const all = await this.list({ search: gloss });
    return all.find((a) => a.gloss === gloss.toUpperCase()) ?? null;
  },

  async loadPublished(gloss: string): Promise<GestureAnimationAsset | null> {
    try {
      const res = await fetch(`/api/animations/${encodeURIComponent(gloss.toUpperCase())}`);
      if (!res.ok) return null;
      return await res.json() as GestureAnimationAsset;
    } catch {
      return null;
    }
  },

  async performAction(
    versionId: string,
    action: "complete-processing" | "approve" | "reject" | "publish" | "archive",
    options?: { asset?: unknown; qualityScore?: number; notes?: string },
  ): Promise<{ ok: boolean; status: string }> {
    const res = await fetch(`/api/admin/animation-assets/${versionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...options }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Action failed");
    }
    return res.json();
  },

  async upload(
    file: File,
    gloss: string,
  ): Promise<{ assetId: string; versionId: string; version: number }> {
    const form = new FormData();
    form.set("file", file);
    form.set("gloss", gloss);
    const res = await fetch("/api/admin/animation-assets/upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Upload failed");
    }
    return res.json();
  },

  validate(asset: GestureAnimationAsset): AnimationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFrameCount = asset.frames.filter((f) => {
      const hasHands = f.landmarks.length > 0;
      const hasPose = (f.poseLandmarks?.length ?? 0) > 0;
      return !hasHands && !hasPose;
    }).length;

    const framesWithPose = asset.frames.filter((f) => (f.poseLandmarks?.length ?? 0) > 0).length;
    const framesWithFace = asset.frames.filter((f) => (f.faceLandmarks?.length ?? 0) > 0).length;
    const framesWithHands = asset.frames.filter((f) => f.landmarks.length > 0).length;

    if (asset.frames.length < 10) {
      errors.push(`Frame count too low: ${asset.frames.length} (minimum 10)`);
    }
    if (asset.fps <= 0 || asset.fps > 120) {
      errors.push(`Invalid FPS: ${asset.fps}`);
    }
    if (asset.duration <= 0) {
      errors.push(`Invalid duration: ${asset.duration}ms`);
    }
    if (missingFrameCount > asset.frames.length * 0.5) {
      errors.push(`Too many missing/corrupted frames: ${missingFrameCount}/${asset.frames.length}`);
    }
    if (framesWithHands === 0) {
      errors.push("No hand landmarks found in any frame");
    }
    if (framesWithPose === 0) {
      warnings.push("No pose landmarks detected");
    }
    if (framesWithFace === 0) {
      warnings.push("No face landmarks detected");
    }

    let totalMovement = 0;
    for (let i = 1; i < asset.frames.length; i++) {
      const prev = asset.frames[i - 1];
      const curr = asset.frames[i];
      if (prev.landmarks.length > 0 && curr.landmarks.length > 0) {
        const a = prev.landmarks[0].landmarks[0];
        const b = curr.landmarks[0].landmarks[0];
        if (a && b) {
          totalMovement += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
        }
      }
    }

    if (totalMovement < 0.01) {
      warnings.push("Very little hand movement detected - animation may be static");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        hasPoseLandmarks: framesWithPose > 0,
        hasFaceLandmarks: framesWithFace > 0,
        hasHandLandmarks: framesWithHands > 0,
        missingFrameCount,
        averageConfidence: framesWithHands > 0 ? framesWithHands / asset.frames.length : 0,
        totalMovement,
        durationMs: asset.duration,
        frameCount: asset.frames.length,
        fps: asset.fps,
      },
    };
  },
};
