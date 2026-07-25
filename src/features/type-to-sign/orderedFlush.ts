export interface SettledSlot<T> {
  done: boolean;
  value: T | null;
}

export interface FlushResult<T> {
  /** Newly ready items, in original sentence order. */
  ready: T[];
  /** Updated "flushed up to" pointer — pass this back in as `fromIndex` next call. */
  nextIndex: number;
}

/**
 * Given per-position results that resolve out of order (parallel loads),
 * returns only the longest *consecutive* run of resolved items starting at
 * `fromIndex` — so word 3 resolving before word 1 waits until word 1 (and 2)
 * are also ready, keeping playback strictly in sentence order. A resolved
 * slot with `value: null` (no asset, not fingerspellable) is skipped rather
 * than emitted, but still advances the pointer past it.
 */
export function computeReadyPrefix<T>(
  settled: ReadonlyArray<SettledSlot<T>>,
  fromIndex: number,
): FlushResult<T> {
  const ready: T[] = [];
  let i = fromIndex;
  while (i < settled.length && settled[i].done) {
    const value = settled[i].value;
    if (value !== null) ready.push(value);
    i++;
  }
  return { ready, nextIndex: i };
}
