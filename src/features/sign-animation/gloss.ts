/**
 * Canonical gloss key used for every animation lookup, cache, and alias map.
 *
 * A published gloss is stored uppercase with underscores ("HELLO_WORLD"), but
 * a typed search can arrive as "hello world", "hello-world", or "Hello_World"
 * — these must all resolve to the same asset. Centralised here because this
 * exact `.toUpperCase().replace(...)` used to be copy-pasted across
 * AnimationLoader, AnimationCache and SmartAnimationResolver with a
 * hyphen-blind regex in every copy, so "hello-world" silently failed to
 * resolve while "hello world" worked.
 */
export function normalizeGloss(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "_");
}
