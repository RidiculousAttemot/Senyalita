import { describe, expect, it } from "vitest";
import {
  PUBLISH_BUDGET_BYTES,
  PUBLISH_WARN_BYTES,
  REQUEST_BODY_LIMIT_BYTES,
  describePayloadBudget,
  formatBytes,
  measureBytes,
} from "../payloadBudget";

describe("payload budget thresholds", () => {
  it("refuses below the platform's hard limit, leaving room for the envelope", () => {
    // If these ever cross, we would hand the request to Vercel expecting it to
    // pass and get back an unannotatable HTML 413 instead.
    expect(PUBLISH_BUDGET_BYTES).toBeLessThan(REQUEST_BODY_LIMIT_BYTES);
    expect(PUBLISH_WARN_BYTES).toBeLessThan(PUBLISH_BUDGET_BYTES);
  });
});

describe("describePayloadBudget", () => {
  it("passes a normal asset silently", () => {
    const budget = describePayloadBudget(1024 * 1024);
    expect(budget.status).toBe("ok");
    expect(budget.message).toBe("");
  });

  it("warns before the limit, so a long clip is caught before publishing", () => {
    const budget = describePayloadBudget(PUBLISH_WARN_BYTES + 1);
    expect(budget.status).toBe("tight");
    expect(budget.message).toContain("close to");
  });

  it("rejects over the limit and says what to do about it", () => {
    const budget = describePayloadBudget(PUBLISH_BUDGET_BYTES + 1);
    expect(budget.status).toBe("over");
    // The message has to carry the remedy: the admin cannot infer "record a
    // shorter clip" from a byte count.
    expect(budget.message).toContain("shorter");
  });

  it("turns an oversize clip into a target length when the clip is known", () => {
    // 12 seconds at roughly double the budget should suggest around 5.
    const bytes = PUBLISH_BUDGET_BYTES * 2;
    const budget = describePayloadBudget(bytes, { frames: 360, fps: 30 });
    expect(budget.message).toMatch(/about \d+ seconds/);
    const suggested = Number(budget.message.match(/about (\d+) seconds/)![1]);
    expect(suggested).toBeGreaterThan(0);
    expect(suggested).toBeLessThan(12);
  });

  it("does not refuse any asset that has actually published", () => {
    // Measured from storage: the largest successfully published landmark JSON
    // is 4,516,030 bytes. An earlier 4.2 MB budget would have blocked it — a
    // false refusal of work that demonstrably succeeds.
    expect(describePayloadBudget(4_516_030).status).not.toBe("over");
  });

  it("reports the real THANK YOU sizes correctly", () => {
    // Raw float64 could not publish in production at all; quantised did.
    expect(describePayloadBudget(7_552_771).status).toBe("over");
    expect(describePayloadBudget(3_638_491).status).toBe("ok");
  });
});

describe("measureBytes", () => {
  it("counts encoded bytes, not UTF-16 string length", () => {
    // A multi-byte gloss must not be under-counted, or the estimate drifts
    // below the real request size in exactly the direction that fails.
    expect(measureBytes("é")).toBeGreaterThan(measureBytes("e"));
  });
});

describe("formatBytes", () => {
  it("renders sizes an admin can compare to the stated limit", () => {
    expect(formatBytes(4_404_019)).toBe("4.2 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });
});
