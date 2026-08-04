import { describe, expect, it } from "vitest";
import { PredictionSmoother } from "../smoothing";
import type { InferenceResult } from "../model";

/**
 * The smoother must let a new label take over.
 *
 * Hysteresis compared a vote ratio against a stored average *confidence* — a
 * model probability. Different units, so the bar scaled with how confident the
 * incumbent had been rather than how much of the window it held. Above 0.90
 * the challenger needed a vote share over 1.0, which cannot exist, and the
 * label locked until something reset the smoother.
 *
 * That is invisible in a quick manual test: the first sign of a session works
 * fine, and only the *second* one fails. The confidence values matter here,
 * not just the labels, which is why these fixtures carry realistic ones.
 */

const r = (label: string, confidence: number): InferenceResult => ({
  label,
  labelId: 0,
  confidence,
  topK: [{ label, confidence }],
});

/** Feeds `count` frames of one label and returns the last smoothed label. */
const feed = (s: PredictionSmoother, label: string, confidence: number, count: number) => {
  let out = "";
  for (let i = 0; i < count; i += 1) out = s.smooth(r(label, confidence)).label;
  return out;
};

describe("smoother hysteresis", () => {
  /**
   * The permanent-lock case, and the only one that actually caught the bug.
   *
   * The old comparison used the *previous* window's average confidence, which
   * decays as the challenger fills the window — so a weaker challenger dragged
   * the bar down with it and escaped after about six frames. A challenger that
   * is equally confident never does: a full 1.0 vote share stays under
   * 0.95 + 0.10, and the label locks for good.
   *
   * That is the ordinary case in use — one clearly-read letter after another —
   * which is why "a" would not appear after a confident previous sign.
   */
  it("replaces an incumbent when the challenger is equally confident", () => {
    const s = new PredictionSmoother();
    expect(feed(s, "b", 0.95, 6)).toBe("b");

    // A full window of "a": vote share 1.0 against 0.0. Under the old
    // comparison this needed to clear 1.05 and never could.
    expect(feed(s, "a", 0.95, 8)).toBe("a");
  });

  it("replaces a very confident incumbent", () => {
    const s = new PredictionSmoother();
    expect(feed(s, "b", 0.99, 6)).toBe("b");
    expect(feed(s, "a", 0.99, 8)).toBe("a");
  });

  it("lets a LOW-confidence challenger through once it owns the window", () => {
    const s = new PredictionSmoother();
    expect(feed(s, "b", 0.98, 6)).toBe("b");

    // "a" reading weakly is the realistic case — a letter the model is unsure
    // of still has to be reportable, or it can never be corrected.
    expect(feed(s, "a", 0.35, 6)).toBe("a");
  });

  it("still resists a single stray frame", () => {
    const s = new PredictionSmoother();
    expect(feed(s, "b", 0.90, 6)).toBe("b");

    // One frame of "a" against four of "b" is a 0.2 share versus 0.8 — well
    // inside the threshold, so the incumbent holds. This is the behaviour the
    // hysteresis exists for and it must survive the fix.
    expect(s.smooth(r("a", 0.9)).label).toBe("b");
  });

  it("needs a real margin, not just a tie", () => {
    const s = new PredictionSmoother();
    feed(s, "b", 0.9, 6);
    // Two "a" against three "b": 0.4 vs 0.6, challenger behind.
    s.smooth(r("a", 0.9));
    expect(s.smooth(r("a", 0.9)).label).toBe("b");
  });

  it("resets cleanly", () => {
    const s = new PredictionSmoother();
    feed(s, "b", 0.95, 6);
    s.reset();
    // After a reset there is no incumbent, so the first stable label wins
    // immediately — this is the path commitPrediction relies on.
    expect(feed(s, "a", 0.5, 3)).toBe("a");
  });
});
