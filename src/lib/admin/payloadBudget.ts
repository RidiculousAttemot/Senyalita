/**
 * How much landmark JSON can actually reach the server.
 *
 * Publishing sends the landmark JSON in the request body, and a Vercel
 * serverless function rejects a request body over 4.5 MB before any of our code
 * runs. That rejection is not a JSON error from a route handler — it is a
 * platform-level 413 with an HTML body, so the studio had no message to show
 * and the publish appeared to fail for no reason.
 *
 * The failure is also environment-dependent in the worst direction: localhost
 * has no such cap, so an asset that publishes on the machine where it was
 * recorded fails only in production. THANK YOU at full float64 precision came
 * to 7,552,771 bytes and did exactly that.
 *
 * Quantisation (see landmarkPrecision) roughly halves it. This module is the
 * other half of the fix: know the number before submitting, and say so.
 */

/**
 * The platform's hard limit. Requests above this never reach the handler.
 *
 * 4.5 MiB, not 4,500,000 bytes. Measured, not assumed: the largest asset that
 * has published successfully is 4,516,030 bytes, which is above the decimal
 * reading and below this one. Taking "4.5 MB" as decimal would refuse a
 * publish that demonstrably works.
 */
export const REQUEST_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;

/**
 * Headroom for everything in the request that is not landmark data: the action,
 * notes, quality score, the JSON envelope, and HTTP framing. Generous, because
 * the cost of being wrong in this direction is only a slightly early refusal,
 * while being wrong the other way returns the opaque 413 this exists to avoid.
 */
const ENVELOPE_ALLOWANCE_BYTES = 64 * 1024;

/**
 * Where we stop and refuse.
 *
 * Deliberately close to the platform cap rather than comfortably below it. A
 * false refusal is the worse error: it blocks a publish that would have worked
 * and offers no override, whereas an optimistic pass merely returns the same
 * platform error as before — and now with the size on screen to explain it.
 * At 4,653,056 bytes this clears every asset ever published here.
 */
export const PUBLISH_BUDGET_BYTES = REQUEST_BODY_LIMIT_BYTES - ENVELOPE_ALLOWANCE_BYTES;

/**
 * Warn from here, so a long recording is flagged before the publish attempt.
 *
 * 4 MiB. Against the 38 assets published so far this flags the largest two and
 * stays quiet for the rest — the point is to mean something when it appears,
 * and a banner on a third of all uploads would be ignored.
 */
export const PUBLISH_WARN_BYTES = 4 * 1024 * 1024;

export type PayloadStatus = "ok" | "tight" | "over";

export interface PayloadBudget {
  bytes: number;
  /** Share of the usable budget, as a percentage. May exceed 100. */
  percent: number;
  status: PayloadStatus;
  /** Human-readable size, e.g. "3.5 MB". */
  readable: string;
  /** What to show the admin. Empty when there is nothing worth saying. */
  message: string;
}

/** Bytes as they will be counted on the wire, not UTF-16 string length. */
export function measureBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The clip the landmarks came from, used to turn bytes into a target length. */
export interface ClipContext {
  frames: number;
  fps: number;
}

/**
 * How long the clip would have to be to fit, given how big it is now.
 *
 * Size scales with frame count, so the ratio is the useful part: "trim to about
 * 6 seconds" is a thing the admin can act on, where "reduce by 380 KB" is not.
 */
function targetSeconds(bytes: number, clip: ClipContext): number | null {
  if (!clip.frames || !clip.fps) return null;
  const seconds = clip.frames / clip.fps;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  // 5% under the limit so the retake is not immediately borderline again.
  return Math.max(1, Math.floor(seconds * (PUBLISH_BUDGET_BYTES / bytes) * 0.95));
}

export function describePayloadBudget(bytes: number, clip?: ClipContext): PayloadBudget {
  const readable = formatBytes(bytes);
  const percent = Math.round((bytes / PUBLISH_BUDGET_BYTES) * 100);

  if (bytes > PUBLISH_BUDGET_BYTES) {
    const target = clip ? targetSeconds(bytes, clip) : null;
    return {
      bytes,
      percent,
      status: "over",
      readable,
      message:
        `This animation is ${readable}, over the ${formatBytes(PUBLISH_BUDGET_BYTES)} limit for a single publish. ` +
        (target
          ? `Re-record the sign in about ${target} seconds or less, then extract and publish again.`
          : `Re-record the sign as a shorter clip, then extract and publish again.`),
    };
  }

  if (bytes >= PUBLISH_WARN_BYTES) {
    return {
      bytes,
      percent,
      status: "tight",
      readable,
      message:
        `This animation is ${readable}, close to the ${formatBytes(PUBLISH_BUDGET_BYTES)} publish limit. ` +
        `It should publish, but a longer clip will not.`,
    };
  }

  return { bytes, percent, status: "ok", readable, message: "" };
}
