import { failureMessage } from "@/lib/http/failureMessage";
import { aliasIndex } from "@/features/fsl-translation/dictionary/aliasIndex";
import type { AliasConflict } from "./conflicts";

export interface AliasRecord {
  id: string;
  assetId: string;
  phrase: string;
  language: "en" | "tl";
  isCanonical: boolean;
  sortOrder: number;
}

export interface CreateAliasResult {
  alias: AliasRecord;
  /** Warnings that did not block the save, for the admin to show. */
  conflicts: AliasConflict[];
  /** What the admin typed, when normalisation changed it. */
  normalisedFrom: string;
}

/**
 * Alias CRUD for the admin.
 *
 * Every write invalidates the client-side alias index, so the person who just
 * added a word sees it work on the next translation rather than after a
 * reload. The deployed site picks it up on its own next load — the database is
 * shared, which is the entire point of the feature.
 */
export const aliasClient = {
  async list(assetId: string): Promise<AliasRecord[]> {
    const res = await fetch(`/api/admin/aliases?assetId=${encodeURIComponent(assetId)}`);
    if (!res.ok) throw new Error(await failureMessage(res, "Could not load this sign's words"));
    return ((await res.json()) as { aliases: AliasRecord[] }).aliases;
  },

  async create(input: {
    assetId: string;
    phrase: string;
    language: "en" | "tl";
    isCanonical?: boolean;
  }): Promise<CreateAliasResult> {
    const res = await fetch("/api/admin/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await failureMessage(res, "Could not add that phrase"));
    aliasIndex.invalidate();
    return (await res.json()) as CreateAliasResult;
  },

  async remove(aliasId: string): Promise<void> {
    const res = await fetch(`/api/admin/aliases?aliasId=${encodeURIComponent(aliasId)}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await failureMessage(res, "Could not remove that phrase"));
    aliasIndex.invalidate();
  },

  async setCanonical(aliasId: string): Promise<void> {
    const res = await fetch("/api/admin/aliases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId }),
    });
    if (!res.ok) throw new Error(await failureMessage(res, "Could not set the display word"));
    aliasIndex.invalidate();
  },

  async reorder(order: string[]): Promise<void> {
    const res = await fetch("/api/admin/aliases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    if (!res.ok) throw new Error(await failureMessage(res, "Could not save the new order"));
    aliasIndex.invalidate();
  },
};
