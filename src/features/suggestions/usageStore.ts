"use client";

const STORAGE_KEY = "senyalita.suggestionUsage.v1";
/** Cap keeps localStorage bounded and stops one phrase dominating forever. */
const MAX_ENTRIES = 200;
const MAX_COUNT = 50;

export type UsageCounts = Record<string, number>;

export function loadUsage(): UsageCounts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: UsageCounts = {};
    for (const [phrase, count] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        out[phrase] = Math.min(MAX_COUNT, Math.floor(count));
      }
    }
    return out;
  } catch {
    // Corrupt or unavailable storage must never break recognition.
    return {};
  }
}

export function recordAcceptance(phrase: string, current: UsageCounts): UsageCounts {
  const next: UsageCounts = { ...current, [phrase]: Math.min(MAX_COUNT, (current[phrase] ?? 0) + 1) };

  const keys = Object.keys(next);
  if (keys.length > MAX_ENTRIES) {
    // Evict the least-used so the store cannot grow without bound.
    const ranked = keys.sort((a, b) => next[b] - next[a]).slice(0, MAX_ENTRIES);
    const trimmed: UsageCounts = {};
    for (const key of ranked) trimmed[key] = next[key];
    persist(trimmed);
    return trimmed;
  }

  persist(next);
  return next;
}

function persist(counts: UsageCounts): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Quota or private-mode failures are non-fatal; ranking just stops learning.
  }
}
