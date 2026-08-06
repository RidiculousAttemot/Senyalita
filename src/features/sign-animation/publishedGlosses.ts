/**
 * What the server currently has published, as far as the browser knows.
 *
 * The type-to-sign pipeline picks its animation key from a hardcoded
 * dictionary. A gloss that file does not name was unreachable however
 * correctly it had been published: the word fingerspelled, /api/animations was
 * never asked for it, and publishing produced no visible change. This registry
 * is the missing question -- "does an asset exist for this word?" -- asked once
 * and cached, so an upload becomes playable without a code deploy.
 *
 * Failure is deliberately silent and empty. If the list cannot be fetched the
 * caller must behave exactly as it did before this existed, which is
 * fingerspelling. A registry error must never cost the user a word.
 */

/** Glosses are stored uppercase with single spaces; typed input is neither. */
export function normalizeGloss(word: string): string {
  return word.trim().toUpperCase().replace(/\s+/g, " ");
}

export class PublishedGlossRegistry {
  private glosses: Set<string> | null = null;
  private inFlight: Promise<Set<string>> | null = null;

  constructor(private readonly endpoint = "/api/animations") {}

  /**
   * One request per page load, shared by every concurrent caller.
   *
   * A translation resolves its words in parallel, so without collapsing this
   * a five-word sentence would fire five identical requests on the first
   * translation and nothing would be cached in time to prevent it.
   */
  async load(): Promise<Set<string>> {
    if (this.glosses) return this.glosses;
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const response = await fetch(this.endpoint);
        if (!response.ok) {
          console.error(
            `[publishedGlosses] HTTP ${response.status} listing published assets.` +
              " Falling back to the dictionary; newly published glosses will not play.",
          );
          return new Set<string>();
        }
        const body = (await response.json()) as { glosses?: unknown };
        if (!Array.isArray(body.glosses)) {
          console.error("[publishedGlosses] malformed response: no gloss array.");
          return new Set<string>();
        }
        return new Set(body.glosses.filter((g): g is string => typeof g === "string").map(normalizeGloss));
      } catch (error) {
        console.error(
          "[publishedGlosses] network error listing published assets:",
          error instanceof Error ? error.message : error,
        );
        return new Set<string>();
      }
    })();

    const resolved = await this.inFlight;
    this.glosses = resolved;
    this.inFlight = null;
    return resolved;
  }

  /** Null when the registry is unavailable, so callers can tell "no" from "unknown". */
  async has(word: string): Promise<boolean> {
    const glosses = await this.load();
    return glosses.has(normalizeGloss(word));
  }

  /** Lets a publish become visible without a reload. */
  invalidate(): void {
    this.glosses = null;
    this.inFlight = null;
  }
}

export const publishedGlosses = new PublishedGlossRegistry();
