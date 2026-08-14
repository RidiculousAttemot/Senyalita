import type { AliasSource } from "@/lib/aliases/ownership";

/**
 * Admin-added word→sign mappings, as far as the browser knows.
 *
 * Modelled on PublishedGlossRegistry, and for the same reason: the source
 * dictionary is bundled at build time, so a phrase added there needs a deploy
 * before anyone can type it. These are read at runtime from the shared
 * database, which is what lets a word added in the local admin work on the
 * deployed site immediately.
 *
 * SYNCHRONOUS ON PURPOSE. The translation pipeline is synchronous end to end,
 * so this cannot be an async lookup without rewriting it. Instead the caller
 * awaits load() once before translating and the matcher then reads an in-memory
 * snapshot. An unloaded index is empty, not pending, so the worst case is the
 * behaviour that existed before this feature: the source dictionary alone.
 *
 * Failure is silent and empty for the same reason it is in the gloss registry —
 * a registry error must never cost the user a word.
 */
export interface AliasEntry {
  phrase: string;
  /** The gloss, which is also the asset lookup key. Never the phrase. */
  gloss: string;
  language: "en" | "tl";
  isCanonical: boolean;
}

export class AliasIndex {
  private byPhrase = new Map<string, AliasEntry>();
  private longestPhraseWords = 0;
  private loaded = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly endpoint = "/api/animations/aliases") {}

  /** One request per page load, shared by every concurrent caller. */
  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const response = await fetch(this.endpoint);
        if (!response.ok) {
          console.error(
            `[aliasIndex] HTTP ${response.status} listing aliases.` +
              " Falling back to the built-in dictionary; admin-added words will not match.",
          );
          return;
        }
        const body = (await response.json()) as { aliases?: unknown };
        if (!Array.isArray(body.aliases)) {
          console.error("[aliasIndex] malformed response: no alias array.");
          return;
        }
        this.replace(body.aliases.filter(isAliasEntry));
      } catch (error) {
        console.error(
          "[aliasIndex] network error listing aliases:",
          error instanceof Error ? error.message : error,
        );
      }
    })();

    await this.inFlight;
    this.loaded = true;
    this.inFlight = null;
  }

  /** Seeds the index directly. Used by tests and by server-rendered callers. */
  replace(entries: readonly AliasEntry[]): void {
    this.byPhrase = new Map(entries.map((e) => [e.phrase, e]));
    this.longestPhraseWords = entries.reduce(
      (longest, e) => Math.max(longest, e.phrase.split(" ").length),
      0,
    );
  }

  lookup(phrase: string): AliasEntry | undefined {
    return this.byPhrase.get(phrase);
  }

  /**
   * The longest phrase the matcher has to be willing to try.
   *
   * The matcher's window is bounded by the longest form it could match. Left at
   * the dictionary's maximum, an admin-added phrase longer than anything in
   * source would never be offered for lookup, and the failure would look like
   * the alias had not been saved.
   */
  maxPhraseWords(): number {
    return this.longestPhraseWords;
  }

  /** Lets a save become visible without a reload. */
  invalidate(): void {
    this.byPhrase = new Map();
    this.longestPhraseWords = 0;
    this.loaded = false;
    this.inFlight = null;
  }

  get source(): AliasSource {
    return "database";
  }
}

function isAliasEntry(value: unknown): value is AliasEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.phrase === "string" && v.phrase.length > 0
    && typeof v.gloss === "string" && v.gloss.length > 0
    && (v.language === "en" || v.language === "tl");
}

export const aliasIndex = new AliasIndex();
