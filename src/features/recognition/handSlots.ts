import type { LandmarkPoint } from "./normalize";

export type DetectedHand = {
  landmarks: LandmarkPoint[];
  /** MediaPipe's categoryName: "Left" or "Right". Anything else is treated as right. */
  handedness: string | undefined;
};

/** Slot 0 is the left hand, slot 1 the right — the layout the model was trained on. */
export type HandSlots = [LandmarkPoint[] | null, LandmarkPoint[] | null];

/**
 * Places detected hands into the two feature slots, the way training did.
 *
 * The model's input is 126 numbers: 21 landmarks x 3 axes x 2 hands, left in
 * [0..62] and right in [63..125]. scripts/extract-fsl-105-landmarks.mjs built
 * that vector with a fallback — if two hands claim the same slot, the second
 * goes into whichever slot is still empty:
 *
 *   if (handSlots[slot] === null) { handSlots[slot] = normalized; continue; }
 *   const firstEmpty = handSlots.indexOf(null);
 *   if (firstEmpty !== -1) handSlots[firstEmpty] = normalized;
 *
 * The live path had no equivalent. It ran two independent findIndex calls, one
 * for "left" and one for "right", so when MediaPipe labelled both detected
 * hands "Right" — which it does regularly, handedness being a guess from a
 * single frame — leftIndex came back -1 and only the first hand survived. The
 * other was discarded and its 63 features stayed zero.
 *
 * That is fatal for phrases specifically. Measured over a stride sample of the
 * v4 test split: 93% of phrase sequences carry both hands (102 of 105 classes),
 * against 18% of letters. So a dropped second hand hands the model a vector it
 * effectively never saw during training, and the prediction collapses — which
 * presents as "two-handed signs are not recognised".
 *
 * Handedness is still respected when it is unambiguous, because that is what
 * training did and the two must agree. This only changes what happens when the
 * labels collide: keep both hands rather than throw one away.
 */
export function assignHandSlots(hands: readonly DetectedHand[]): HandSlots {
  const slots: HandSlots = [null, null];

  for (const hand of hands) {
    if (!hand?.landmarks?.length) continue;

    const slot = hand.handedness?.toLowerCase().includes("left") ? 0 : 1;
    if (slots[slot] === null) {
      slots[slot] = hand.landmarks;
      continue;
    }

    // Same label twice. Training kept the hand; so do we.
    const firstEmpty = slots.indexOf(null);
    if (firstEmpty !== -1) slots[firstEmpty] = hand.landmarks;
    // Beyond two hands there is nowhere to put it — numHands caps this at 2.
  }

  return slots;
}
