import { globalLoader } from "@/features/sign-animation/hooks/useAnimationClip";

const COMMON_WORDS = [
  ...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")),
  "HELLO", "THANK YOU", "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING",
  "KAMUSTA", "SALAMAT", "PAALAM", "OO", "HINDI", "PLEASE", "SORRY",
];

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
