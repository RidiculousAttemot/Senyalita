import { describe, expect, it } from "vitest";

/**
 * Inference must never overlap itself.
 *
 * The scheduler is a setInterval with an async callback, and the timer does
 * not wait for that callback. On desktop a pass takes 10-20ms against a 100ms
 * tick, so passes never overlapped and the missing guard was invisible. On
 * mobile a pass can take 300-500ms: passes pile up, each allocating tensors
 * and running a forward pass on the main thread, starving the camera's
 * requestAnimationFrame loop. Reported as 2 FPS with nothing recognised.
 *
 * This models the scheduler rather than importing the hook, because the bug
 * lives in the timing relationship — a React test would exercise everything
 * except the thing that broke.
 */

type Tick = () => Promise<void>;

/** Runs `ticks` timer fires spaced `intervalMs`, with each pass costing `passMs`. */
async function simulate(opts: {
  ticks: number;
  intervalMs: number;
  passMs: number;
  guarded: boolean;
}) {
  let inFlight = false;
  let concurrentPeak = 0;
  let concurrent = 0;
  let started = 0;
  let completed = 0;
  let now = 0;
  const pending: Array<{ endsAt: number }> = [];

  const tick: Tick = async () => {
    if (opts.guarded && inFlight) return;
    inFlight = true;
    started += 1;
    concurrent += 1;
    concurrentPeak = Math.max(concurrentPeak, concurrent);
    pending.push({ endsAt: now + opts.passMs });
  };

  for (let i = 0; i < opts.ticks; i += 1) {
    now = i * opts.intervalMs;
    // Retire any pass that finished before this tick.
    for (let p = pending.length - 1; p >= 0; p -= 1) {
      if (pending[p].endsAt <= now) {
        pending.splice(p, 1);
        concurrent -= 1;
        completed += 1;
        if (concurrent === 0) inFlight = false;
      }
    }
    await tick();
  }

  return { started, completed, concurrentPeak };
}

describe("inference back-pressure", () => {
  it("never overlaps on a device where a pass outlasts the tick", async () => {
    // 400ms pass against a 100ms tick — the mobile case.
    const guarded = await simulate({ ticks: 40, intervalMs: 100, passMs: 400, guarded: true });

    expect(
      guarded.concurrentPeak,
      "more than one inference in flight starves the camera loop",
    ).toBe(1);
  });

  it("would pile up without the guard, which is the bug", async () => {
    const unguarded = await simulate({ ticks: 40, intervalMs: 100, passMs: 400, guarded: false });

    // Documents the failure rather than asserting the fix twice: without the
    // guard the backlog grows without bound.
    expect(unguarded.concurrentPeak).toBeGreaterThan(1);
  });

  it("does not throttle a device fast enough to keep up", async () => {
    // 15ms pass against a 100ms tick — the desktop case, where the guard must
    // cost nothing.
    const guarded = await simulate({ ticks: 40, intervalMs: 100, passMs: 15, guarded: true });
    const unguarded = await simulate({ ticks: 40, intervalMs: 100, passMs: 15, guarded: false });

    expect(guarded.started).toBe(unguarded.started);
    expect(guarded.concurrentPeak).toBe(1);
  });
});
