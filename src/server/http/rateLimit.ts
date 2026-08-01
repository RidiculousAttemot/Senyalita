/**
 * Anything with a `headers.get()` lookup — a `NextRequest`, or the
 * `ReadonlyHeaders` returned by `next/headers` inside a Server Action, which
 * has no `Request` of its own to rate limit against.
 */
interface HeaderSource {
  headers: { get(name: string): string | null };
}

/**
 * In-process sliding-window rate limiter.
 *
 * LIMITATION, stated plainly: state lives in the module scope of one server
 * instance. On Vercel each serverless instance keeps its own counters and they
 * reset on cold start, so the effective global limit is (instances x limit).
 * That is a real ceiling on a route that spends money per call, but it is not
 * a strong guarantee. For a hard limit, back this with Vercel KV / Upstash
 * Redis and keep the same interface.
 */

interface Hit {
  timestamps: number[];
}

const buckets = new Map<string, Hit>();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

/** Drops windows nothing has touched recently so the Map cannot grow forever. */
function sweep(windowMs: number, now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, hit] of buckets) {
    const live = hit.timestamps.filter((t) => now - t < windowMs);
    if (live.length === 0) buckets.delete(key);
    else hit.timestamps = live;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Namespace, so different routes do not share a budget. */
  bucket: string;
}

/**
 * Identifies the caller. x-forwarded-for is set by the platform edge; the
 * left-most entry is the client. It is spoofable in principle, but on Vercel
 * the edge rewrites it, so it is the best signal available without auth.
 */
export function clientKey(request: HeaderSource): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(request: HeaderSource, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs, bucket } = options;
  const now = Date.now();
  sweep(windowMs, now);

  const key = `${bucket}:${clientKey(request)}`;
  const entry = buckets.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    buckets.set(key, entry);
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  entry.timestamps.push(now);
  buckets.set(key, entry);
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    limit,
    retryAfterSeconds: 0,
  };
}

/** Standard headers so clients can back off without guessing. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
  if (!result.allowed) headers["Retry-After"] = String(result.retryAfterSeconds);
  return headers;
}
