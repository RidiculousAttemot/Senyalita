export function createFrameRateTracker(startTimestamp: number) {
  let windowStart = startTimestamp;
  let frameCount = 0;
  let framesPerSecond = 0;

  return {
    record(timestamp: number): number {
      frameCount++;
      const elapsed = timestamp - windowStart;
      if (elapsed < 1000) return framesPerSecond;
      framesPerSecond = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      windowStart = timestamp;
      return framesPerSecond;
    },
  };
}