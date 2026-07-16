import type { AnimationClip } from "@/features/animation/types";
import { createAnimationClip } from "@/features/gesture-mapping";
import { mapWordToGesture } from "@/features/gesture-mapping";
import type { GlossResult } from "./glossTranslator";
import type { SequencedItem } from "./animationSequencer";
import { fingerSpellAnimation } from "./fallback";

function getUnknownPlaceholder(): any {
  return {
    version: 1,
    gesture: "UNKNOWN",
    duration: 1.0,
    fps: 30,
    keyframes: [{
      time: 0,
      pose: {
        joints: {
          head: { x: 0, y: -1.6, z: 0 },
          neck: { x: 0, y: -1.2, z: 0 },
          torso: { x: 0, y: -0.4, z: 0 },
          leftShoulder: { x: -0.35, y: -0.5, z: 0 },
          rightShoulder: { x: 0.35, y: -0.5, z: 0 },
          leftElbow: { x: -0.55, y: -0.9, z: 0 },
          rightElbow: { x: 0.55, y: -0.9, z: 0 },
          leftWrist: { x: -0.55, y: -1.3, z: 0 },
          rightWrist: { x: 0.55, y: -1.3, z: 0 },
          leftHand: { x: -0.55, y: -1.4, z: 0 },
          rightHand: { x: 0.55, y: -1.4, z: 0 },
          leftHip: { x: -0.15, y: 0.2, z: 0 },
          rightHip: { x: 0.15, y: 0.2, z: 0 },
        },
      },
    }],
  };
}

export interface AnimationQueueItem {
  gesture: string;
  original: string;
  clip: AnimationClip;
  priority: number;
  confidence: number;
  strategy: string;
  isPause: boolean;
  pauseDuration: number;
}

export function buildAnimationQueue(
  glossResult: GlossResult,
  sequence: SequencedItem[],
): AnimationQueueItem[] {
  const queue: AnimationQueueItem[] = [];

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i];

    if (item.isPause) {
      const pauseClip = createPauseClip(item.pauseDuration);
      queue.push({
        gesture: "PAUSE",
        original: "",
        clip: pauseClip,
        priority: -1,
        confidence: 1,
        strategy: "pause",
        isPause: true,
        pauseDuration: item.pauseDuration,
      });
      continue;
    }

    const mapping = mapWordToGesture(item.gesture.toLowerCase());

    if (item.strategy === "fingerspelling" || mapping.isFingerSpelling) {
      const letter = item.original.toLowerCase();
      const spellAnim = fingerSpellAnimation(letter);
      if (spellAnim) {
        const clip = createAnimationClip(mapping.gloss, i);
        queue.push({
          gesture: mapping.gloss,
          original: item.original,
          clip,
          priority: 2,
          confidence: item.confidence,
          strategy: "fingerspelling",
          isPause: false,
          pauseDuration: 0,
        });
      }
    } else {
      const clip = createAnimationClip(mapping.gloss, i);
      queue.push({
        gesture: mapping.gloss,
        original: item.original,
        clip,
        priority: item.priority,
        confidence: item.confidence,
        strategy: item.strategy,
        isPause: false,
        pauseDuration: 0,
      });
    }
  }

  return queue;
}

function createPauseClip(duration: number): AnimationClip {
  const restPose = {
    version: 1,
    gesture: "PAUSE",
    duration,
    fps: 30,
    keyframes: [
      {
        time: 0,
        pose: {
          joints: {
            head: { x: 0, y: -1.6, z: 0 },
            neck: { x: 0, y: -1.2, z: 0 },
            torso: { x: 0, y: -0.4, z: 0 },
            leftShoulder: { x: -0.35, y: -0.5, z: 0 },
            rightShoulder: { x: 0.35, y: -0.5, z: 0 },
            leftElbow: { x: -0.55, y: -0.9, z: 0 },
            rightElbow: { x: 0.55, y: -0.9, z: 0 },
            leftWrist: { x: -0.55, y: -1.3, z: 0 },
            rightWrist: { x: 0.55, y: -1.3, z: 0 },
            leftHand: { x: -0.55, y: -1.4, z: 0 },
            rightHand: { x: 0.55, y: -1.4, z: 0 },
            leftHip: { x: -0.15, y: 0.2, z: 0 },
            rightHip: { x: 0.15, y: 0.2, z: 0 },
          },
        },
      },
    ],
  };
  return {
    id: `pause-${Date.now()}`,
    gesture: "PAUSE",
    animation: restPose,
  };
}

export function getQueueText(glossResult: GlossResult): string {
  return glossResult.glossSequence.map((g) => g.gloss).join(" → ");
}

export function getQueueDisplay(glossResult: GlossResult): string[] {
  return glossResult.glossSequence.map((g) => g.gloss);
}
