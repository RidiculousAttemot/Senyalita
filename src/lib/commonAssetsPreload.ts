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

/**
 * There is deliberately no `preloadCommonAssets()` any more.
 *
 * It warmed all 26 letters the moment the Text-to-Sign tab mounted. Measured
 * against production that was **16.1MB over the wire and 78MB decoded and
 * JSON-parsed** (0.62MB brotli / 3.01MB raw per asset) — roughly 1.3s of
 * blocked main thread, competing with the recognition model and the MediaPipe
 * WASM for bandwidth, before the user had typed anything and on a tab they may
 * never open.
 *
 * TypeToSignInterface's debounced typing-pause prefetch already warms exactly
 * the glosses a message resolves to, through the real pipeline, ~400ms after
 * typing stops — still ahead of the Translate click. Precise warming on intent
 * beats warming the alphabet on arrival.
 *
 * This list survives because e2e/animation-load.spec.ts walks it to assert no
 * published asset is ever served from the local development fallback.
 */
