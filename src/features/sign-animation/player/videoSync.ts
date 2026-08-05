/**
 * Keeping the human recording on the same instant as the landmark playhead.
 *
 * The player runs two clocks: PlaybackEngine advances its own `currentTime` on
 * requestAnimationFrame, scaled by the playback speed, and the <video> element
 * advances on the browser's media clock. Nothing makes them agree, so they have
 * to be reconciled every frame.
 *
 * The reconciliation used to be a single rule — seek the video whenever it was
 * more than 80ms out. That is correct only while the two clocks already run at
 * the same rate. They do not:
 *
 *   - `playbackRate` was never set, so at 0.5x the landmarks halved and the
 *     recording kept running at 1x, opening 0.5s of drift per second of
 *     playback. Past the 80ms threshold that is a seek roughly every 160ms.
 *   - A seek is not a nudge. Each one flushes the decode pipeline and shows the
 *     next keyframe-decoded picture, so a video seeked six times a second does
 *     not play — it steps. That is the reported "frame by frame".
 *
 * So the rate is the primary control and seeking is the fallback, which is how
 * audio/video sync is normally done:
 *
 *   |drift| <= DEADBAND      run at exactly the requested speed
 *   |drift| <  RESEEK        trim the rate a few percent to close the gap
 *   |drift| >= RESEEK        too far to trim smoothly, seek once
 *
 * The deadband matters as much as the thresholds. Without it the rate is
 * rewritten every frame, and a constantly-changing playbackRate is audible and
 * visible as judder even when the drift number looks small.
 */

/** Drift below this is left alone — see the note on rewriting rate every frame. */
export const SYNC_DEADBAND_SECONDS = 0.02;

/**
 * Drift at or past this is closed by seeking. Set well above the drift a rate
 * trim can absorb, so a seek means "something jumped" (a clip change, a stall,
 * a tab restored from the background) rather than "we are slightly behind".
 */
export const SYNC_RESEEK_SECONDS = 0.35;

/** Ceiling on the rate trim, as a fraction of the requested speed. */
export const SYNC_MAX_TRIM = 0.12;

/**
 * How aggressively drift is converted into a rate trim, per second of drift.
 * 1.5 closes a 0.1s gap in roughly a second at the resulting ~12% trim, which
 * is fast enough to be gone before the eye reads it and slow enough not to look
 * like a speed change.
 */
export const SYNC_GAIN = 1.5;

/** The browsers' own accepted range for HTMLMediaElement.playbackRate. */
const MIN_RATE = 0.0625;
const MAX_RATE = 16;

export type SyncCorrection =
  | { action: "seek"; to: number; rate: number }
  | { action: "rate"; rate: number };

/**
 * @param videoTime  the recording's current position, seconds
 * @param targetTime where the recording should be, seconds (engine time + the
 *                   clip's offset into its source recording)
 * @param speed      the requested playback speed, which the video must match
 */
export function computeVideoSync(
  videoTime: number,
  targetTime: number,
  speed: number,
): SyncCorrection {
  const requested = clampRate(speed);
  const drift = videoTime - targetTime;
  const magnitude = Math.abs(drift);

  if (magnitude >= SYNC_RESEEK_SECONDS) {
    return { action: "seek", to: targetTime, rate: requested };
  }

  if (magnitude <= SYNC_DEADBAND_SECONDS) {
    return { action: "rate", rate: requested };
  }

  // Ahead of the landmarks (drift > 0) means play slower, and vice versa.
  const trim = clamp(-drift * SYNC_GAIN, -SYNC_MAX_TRIM, SYNC_MAX_TRIM);
  return { action: "rate", rate: clampRate(requested * (1 + trim)) };
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return clamp(rate, MIN_RATE, MAX_RATE);
}
