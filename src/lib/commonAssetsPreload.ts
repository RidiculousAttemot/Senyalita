import { globalLoader } from "@/features/sign-animation/hooks/useAnimationClip";

/**
 * The fingerspelling alphabet, and nothing else.
 *
 * This list previously carried twelve phrases — HELLO, THANK YOU, GOOD
 * MORNING, KAMUSTA, SALAMAT, PAALAM, OO, HINDI, PLEASE, SORRY and the two
 * other greetings. Not one of them is published: the published glosses are
 * 0–10 and A–Z. Every mount therefore fired twelve requests that were
 * guaranteed to 404, forever — 32% of the burst, spent confirming the
 * absence of a phrase vocabulary the architecture no longer has.
 *
 * A–Z is worth warming because fingerspelling is the fallback for every word
 * without a published sign, so the alphabet is genuinely hot.
 */
export const COMMON_WORDS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

let started = false;

/** Warms the shared animation-asset cache with high-frequency words so the
 * first real translation has a head start. Idempotent — safe to call from
 * every mount of the translate UI. */
export function preloadCommonAssets(): void {
  if (started) return;
  started = true;

  const run = () => globalLoader.preload(COMMON_WORDS);

  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 300);
  }
}
