import { spellableCharacters } from "@/features/type-to-sign/sourceLabel";

/**
 * What can go wrong when someone claims a phrase for a sign.
 *
 * Being able to add phrases means being able to recreate the bug the matcher
 * fix removed, so every one of these is checked at save time rather than
 * discovered later by a user whose word did not play.
 *
 * `refuse` stops the save. `warn` does not: longest-match-first handles the
 * collision cases correctly, but they change what a *different* input does, and
 * that is worth knowing before you are surprised by it.
 */
export type AliasConflictKind =
  | "duplicate-owner"
  | "duplicate-in-asset"
  | "tail-collision"
  | "prefix-collision"
  | "unspellable";

export interface AliasConflict {
  kind: AliasConflictKind;
  severity: "refuse" | "warn";
  message: string;
}

/** One phrase already claimed, and by which gloss. */
export interface ClaimedPhrase {
  phrase: string;
  gloss: string;
}

export interface ConflictInput {
  /** The normalised phrase being added. */
  phrase: string;
  /** The gloss it is being added to. */
  gloss: string;
  /** Every phrase already claimed, from both stores. */
  claimed: readonly ClaimedPhrase[];
}

const sameGloss = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

export function detectAliasConflicts({ phrase, gloss, claimed }: ConflictInput): AliasConflict[] {
  const conflicts: AliasConflict[] = [];
  const words = phrase.split(" ").filter(Boolean);

  const existing = claimed.find((c) => c.phrase === phrase);
  if (existing) {
    conflicts.push(
      sameGloss(existing.gloss, gloss)
        ? {
            kind: "duplicate-in-asset",
            severity: "refuse",
            message: `"${phrase}" is already one of this sign's words.`,
          }
        : {
            kind: "duplicate-owner",
            severity: "refuse",
            // Naming the other asset is the point: "already taken" leaves you
            // hunting for who took it.
            message: `"${phrase}" already plays ${existing.gloss}. A phrase can only belong to one sign — remove it there first.`,
          },
    );
    // Once refused, the collision warnings below are noise.
    return conflicts;
  }

  // The tail of the new phrase is itself a claimed phrase. Longest-match-first
  // consumes the whole phrase so this resolves correctly, but the shorter
  // phrase keeps working on its own and that is worth stating.
  for (let start = 1; start < words.length; start++) {
    const tail = words.slice(start).join(" ");
    const owner = claimed.find((c) => c.phrase === tail);
    if (owner) {
      conflicts.push({
        kind: "tail-collision",
        severity: "warn",
        message: `The ending "${tail}" already plays ${owner.gloss}. Typing the full phrase plays ${gloss.toUpperCase()}; typing just "${tail}" still plays ${owner.gloss}.`,
      });
    }
  }

  // Prefix in either direction. Both can coexist; longest-match decides.
  for (const c of claimed) {
    if (c.phrase === phrase) continue;
    if (c.phrase.startsWith(`${phrase} `)) {
      conflicts.push({
        kind: "prefix-collision",
        severity: "warn",
        message: `"${c.phrase}" already plays ${c.gloss} and starts with this phrase. The longer phrase wins when both could match.`,
      });
    } else if (phrase.startsWith(`${c.phrase} `)) {
      conflicts.push({
        kind: "prefix-collision",
        severity: "warn",
        message: `"${c.phrase}" already plays ${c.gloss}. Adding this longer phrase means that input now plays ${gloss.toUpperCase()} instead.`,
      });
    }
  }

  // A phrase whose characters have no alphabet animation cannot fall back to
  // fingerspelling, so if the sign is ever unpublished the word renders
  // nothing at all.
  const spellable = spellableCharacters(phrase).flat();
  if (spellable.length === 0) {
    conflicts.push({
      kind: "unspellable",
      severity: "refuse",
      message: `"${phrase}" has no letters or digits to fall back on, so it would show nothing if this sign were unpublished.`,
    });
  }

  return conflicts;
}

export const isRefusal = (conflicts: readonly AliasConflict[]): boolean =>
  conflicts.some((c) => c.severity === "refuse");
