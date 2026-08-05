import { describe, expect, it } from "vitest";
import {
  computeVideoSync,
  SYNC_RESEEK_SECONDS,
  SYNC_MAX_TRIM,
} from "../videoSync";

/**
 * Runs the real correction against a model of the two clocks, because the
 * defect is not visible in any single call — it is what the loop settles into.
 *
 * The video advances at whatever rate the correction last asked for; the engine
 * advances at the requested speed. That is the whole system: one controller,
 * one plant. Counting seeks over ten seconds of it is the measurement that
 * matters, since a seek is what makes the picture step instead of play.
 */
/** The rule this replaced, verbatim: rate untouched, seek past 80ms. */
const LEGACY_SEEK_SECONDS = 0.08;

function simulate(options: {
  speed: number;
  seconds?: number;
  hz?: number;
  /**
   * Models the previous implementation exactly — playbackRate was never
   * assigned, so the element ran at 1x whatever the engine did, and the only
   * correction was a seek past LEGACY_SEEK_SECONDS.
   */
  legacy?: boolean;
  /** One-off jump, e.g. a clip change or a tab restored from the background. */
  jumpAt?: { second: number; seconds: number };
}) {
  const { speed, seconds = 10, hz = 60, legacy = false, jumpAt } = options;
  const step = 1 / hz;

  let engineTime = 0;
  let videoTime = 0;
  let rate = legacy ? 1 : speed;
  let seeks = 0;
  let maxDrift = 0;
  let settledMaxDrift = 0;

  for (let i = 0; i < seconds * hz; i += 1) {
    const now = i * step;
    if (jumpAt && Math.abs(now - jumpAt.second) < step / 2) {
      videoTime += jumpAt.seconds;
    }

    engineTime += step * speed;
    videoTime += step * rate;

    if (legacy) {
      if (Math.abs(videoTime - engineTime) > LEGACY_SEEK_SECONDS) {
        videoTime = engineTime;
        seeks += 1;
      }
      rate = 1;
    } else {
      const correction = computeVideoSync(videoTime, engineTime, speed);
      if (correction.action === "seek") {
        videoTime = correction.to;
        seeks += 1;
      }
      rate = correction.rate;
    }

    const drift = Math.abs(videoTime - engineTime);
    maxDrift = Math.max(maxDrift, drift);
    // Ignore the first second so a deliberate jump's recovery is not counted
    // as the steady state.
    if (now > 1 && (!jumpAt || now > jumpAt.second + 1)) {
      settledMaxDrift = Math.max(settledMaxDrift, drift);
    }
  }

  return { seeks, maxDrift, settledMaxDrift, finalRate: rate };
}

describe("video sync", () => {
  it("stops seeking at speeds other than 1x", () => {
    // The defect: the recording ran at 1x whatever the engine did, so drift
    // grew without bound and the corrector seeked forever.
    const rows: string[] = [];
    for (const speed of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
      const fixed = simulate({ speed });
      const old = simulate({ speed, legacy: true });
      rows.push(
        `  ${String(speed).padStart(4)}x  seeks/10s ${String(old.seeks).padStart(3)} -> `
        + `${String(fixed.seeks).padStart(2)}   max drift `
        + `${old.maxDrift.toFixed(3)}s -> ${fixed.settledMaxDrift.toFixed(3)}s`,
      );
      expect(fixed.seeks, `${speed}x still seeks in the steady state`).toBe(0);
    }
    console.log(`\n  10s of playback, 60Hz\n${rows.join("\n")}\n`);

    // 1x is the one speed that could be measured against the deployed site:
    // the recording played smoothly there, one seek in four seconds. The model
    // has to agree with that, or its numbers for the other speeds mean nothing.
    expect(simulate({ speed: 1, legacy: true }).seeks).toBe(0);
  });

  it("holds the recording within a frame of the landmarks", () => {
    // A frame at 30fps is 33ms. Sync tighter than that is not observable, and
    // looser than that shows as the hands leading or trailing the video.
    for (const speed of [0.5, 1, 2]) {
      const { settledMaxDrift } = simulate({ speed });
      expect(settledMaxDrift, `${speed}x drifts more than one frame`)
        .toBeLessThan(1 / 30);
    }
  });

  it("seeks once for a jump too large to trim away, then settles", () => {
    const { seeks, settledMaxDrift } = simulate({
      speed: 1,
      jumpAt: { second: 3, seconds: 2 },
    });
    expect(seeks).toBe(1);
    expect(settledMaxDrift).toBeLessThan(1 / 30);
  });

  it("never asks for a rate the trim was not allowed to reach", () => {
    for (const speed of [0.5, 1, 2]) {
      for (const drift of [-0.3, -0.1, -0.03, 0, 0.03, 0.1, 0.3]) {
        const c = computeVideoSync(drift, 0, speed);
        if (c.action === "rate") {
          expect(c.rate).toBeGreaterThanOrEqual(speed * (1 - SYNC_MAX_TRIM) - 1e-9);
          expect(c.rate).toBeLessThanOrEqual(speed * (1 + SYNC_MAX_TRIM) + 1e-9);
        }
      }
    }
  });

  it("still seeks rather than trims once drift is past the reseek threshold", () => {
    const c = computeVideoSync(SYNC_RESEEK_SECONDS + 0.01, 0, 1);
    expect(c.action).toBe("seek");
    if (c.action === "seek") {
      expect(c.to).toBe(0);
      // The rate must come back to the requested speed on a seek, or a trim
      // left over from before the jump keeps pulling after it is corrected.
      expect(c.rate).toBe(1);
    }
  });

  it("restores the requested speed once inside the deadband", () => {
    for (const speed of [0.5, 1, 2]) {
      const c = computeVideoSync(0.001, 0, speed);
      expect(c).toEqual({ action: "rate", rate: speed });
    }
  });
});
