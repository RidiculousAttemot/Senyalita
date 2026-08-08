import type { GestureAnimationAsset } from "@/features/sign-animation/types";
import { isQuantisableAsset, quantiseAsset } from "@/lib/landmarkPrecision";

/**
 * Turns a failed response into something a human can act on.
 *
 * These paths used to call `await res.json()` on the error branch, which
 * assumes every failure is one of ours. A 500 raised above the route handler —
 * by middleware, or by the framework — comes back as an HTML error page, so the
 * parse itself threw and the admin saw
 *
 *   Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 *
 * instead of the reason the publish failed. The real message never reached the
 * screen and never reached the network tab in a readable form either, which is
 * a bad place to be when the underlying error is intermittent.
 *
 * Reads the body once as text, tries JSON, and falls back to the status line
 * plus a snippet. Always includes the status code, because "500" and "413" want
 * completely different responses from whoever is reading it.
 */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    return `${fallback} (HTTP ${res.status}, response body unreadable)`;
  }

  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) {
      return `${parsed.error} (HTTP ${res.status})`;
    }
  } catch {
    // Not JSON — an HTML error page, or an empty body.
  }

  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 120);
  return snippet
    ? `${fallback} (HTTP ${res.status}): ${snippet}`
    : `${fallback} (HTTP ${res.status})`;
}

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
    action: "complete-processing" | "approve" | "reject" | "publish" | "unpublish" | "archive",
    options?: { asset?: unknown; qualityScore?: number; notes?: string; language?: string },
  ): Promise<{ ok: boolean; status: string }> {
    // Quantise before serialising, not after: the point is the size of the
    // request body. A Vercel function request is capped at 4.5 MB, and the
    // studio was sending raw float64 -- THANK YOU came to 7,552,771 bytes, so
    // it published on localhost and could not publish in production at all.
    //
    // Done here rather than in PublishTab so every caller that submits an asset
    // gets it, and so the payload can never be assembled at full precision by a
    // future call site that forgets.
    const payload = options?.asset && isQuantisableAsset(options.asset)
      ? { ...options, asset: quantiseAsset(options.asset) }
      : options;

    const res = await fetch(`/api/admin/animation-assets/${versionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      throw new Error(await failureMessage(res, `${action} failed`));
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
      throw new Error(await failureMessage(res, "Upload failed"));
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
