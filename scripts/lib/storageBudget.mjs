/**
 * Storage preflight, so a batch stops at sign 1 rather than sign 60.
 *
 * The free tier caps Storage at 1 GB and 612 MB is already used, 490 MB of it
 * source video. A 91-sign batch that uploaded video would need 1.68 GB and fail
 * partway, leaving the library half-populated -- the failure mode that is worst
 * to recover from, because the successful half is indistinguishable from a
 * finished run.
 *
 * Measured before the first write and re-checked as the run proceeds, because
 * the projection is an estimate and the actual sizes are not known until each
 * asset is serialised.
 */

const BYTES_PER_MB = 1048576;

/** Free-tier ceiling. Override for a paid plan rather than editing this. */
export const STORAGE_CAP_BYTES = Number(process.env.SUPABASE_STORAGE_CAP_BYTES ?? 1024 * BYTES_PER_MB);

/** Leaves room for the run's own metadata and any concurrent writer. */
const SAFETY_MARGIN_BYTES = 32 * BYTES_PER_MB;

export const mb = (bytes) => `${(bytes / BYTES_PER_MB).toFixed(2)} MB`;

/**
 * Sums every object in a bucket, walking the two prefix levels the animation
 * buckets use ({asset_id}/{version_id}/file).
 */
export async function measureBucket(supabase, bucket) {
  let total = 0;
  const list = async (prefix) => {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    return data ?? [];
  };

  for (const level1 of await list("")) {
    for (const level2 of await list(`${level1.name}/`)) {
      for (const file of await list(`${level1.name}/${level2.name}/`)) {
        total += file.metadata?.size ?? 0;
      }
    }
  }
  return total;
}

export async function measureUsedBytes(supabase, buckets = ["animation-landmarks", "animation-source-videos"]) {
  const perBucket = {};
  let used = 0;
  for (const bucket of buckets) {
    const bytes = await measureBucket(supabase, bucket);
    perBucket[bucket] = bytes;
    used += bytes;
  }
  return { used, perBucket };
}

/**
 * Throws before the first write when the projection does not fit.
 *
 * `projectedBytes` is what the run intends to add. The message names the
 * numbers rather than saying "quota exceeded", because the useful next step
 * differs completely depending on whether the shortfall is 20 MB or 700 MB.
 */
export function assertFits({ used, projectedBytes, cap = STORAGE_CAP_BYTES }) {
  const remaining = cap - used;
  const headroom = remaining - SAFETY_MARGIN_BYTES;

  if (projectedBytes > headroom) {
    throw new Error(
      `Storage preflight failed. Used ${mb(used)} of ${mb(cap)}; this run projects ` +
        `${mb(projectedBytes)} but only ${mb(headroom)} is usable ` +
        `(${mb(SAFETY_MARGIN_BYTES)} held back as margin). ` +
        `Nothing was written. Reduce the batch, skip source video (--skip-video), ` +
        `or raise the cap with SUPABASE_STORAGE_CAP_BYTES on a paid plan.`,
    );
  }

  return { used, remaining, headroom, projectedBytes };
}
