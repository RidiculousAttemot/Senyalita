import type { GestureAnimationAsset } from "@/features/sign-animation/types";
import { generateMetadata, type AnimationMetadata } from "./metadataGenerator";
import { analyzeQuality, type QualityAnalysis } from "./qualityAnalyzer";

export interface VersionDiff {
  versionA: string;
  versionB: string;
  durationChange: number;
  smoothnessChange: number;
  qualityChange: number;
  landmarkCompletenessChange: number;
  handVisibilityChange: number;
  dominantHandChanged: boolean;
  frameCountChange: number;
  fpsChange: number;
  movementChange: number;
  overallImprovement: number;
  verdict: "improved" | "regressed" | "similar";
}

export function compareVersions(
  assetA: GestureAnimationAsset,
  versionA: string,
  assetB: GestureAnimationAsset,
  versionB: string,
): VersionDiff {
  const metaA = generateMetadata(assetA);
  const metaB = generateMetadata(assetB);
  const qualityA = analyzeQuality(assetA);
  const qualityB = analyzeQuality(assetB);

  const durationChange = metaB.durationMs - metaA.durationMs;
  const smoothnessChange = metaB.motionSmoothness - metaA.motionSmoothness;
  const qualityChange = qualityB.score - qualityA.score;
  const landmarkCompletenessChange = metaB.landmarkCompleteness - metaA.landmarkCompleteness;
  const handVisibilityChange = metaB.handVisibility - metaA.handVisibility;
  const dominantHandChanged = metaA.dominantHand !== metaB.dominantHand;
  const frameCountChange = assetB.frames.length - assetA.frames.length;
  const fpsChange = (metaB.fps ?? 0) - (metaA.fps ?? 0);
  const movementChange = metaB.movementScore - metaA.movementScore;

  const improvements = [
    qualityChange > 0 ? 1 : 0,
    smoothnessChange > 0 ? 1 : 0,
    landmarkCompletenessChange > 0 ? 1 : 0,
    handVisibilityChange > 0 ? 1 : 0,
    movementChange > 0 ? 1 : 0,
  ];
  const overallImprovement = Math.round(
    (improvements.reduce((s, v) => s + (qualityChange > 5 ? v * 2 : v), 0) / improvements.length) * 100,
  );

  const verdict: VersionDiff["verdict"] =
    overallImprovement > 60 ? "improved"
    : overallImprovement < 30 ? "regressed"
    : "similar";

  return {
    versionA,
    versionB,
    durationChange,
    smoothnessChange,
    qualityChange,
    landmarkCompletenessChange,
    handVisibilityChange,
    dominantHandChanged,
    frameCountChange,
    fpsChange,
    movementChange,
    overallImprovement,
    verdict,
  };
}
