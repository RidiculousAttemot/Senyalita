import "server-only";

import { createSupabaseServiceClient } from "../service";

/**
 * Reads and writes for admin-managed word→sign mappings.
 *
 * The gloss stays the identity throughout. An alias is a lexical form pointing
 * at an asset; it is never the key used to fetch one, because an alias used as
 * an asset key 404s and silently fingerspells.
 */

export interface AnimationAlias {
  id: string;
  assetId: string;
  phrase: string;
  language: "en" | "tl";
  isCanonical: boolean;
  sortOrder: number;
}

/** What the public site needs: a phrase and the gloss it plays. */
export interface PublishedAlias {
  phrase: string;
  gloss: string;
  language: "en" | "tl";
  isCanonical: boolean;
}

type AliasRow = {
  id: string;
  asset_id: string;
  phrase: string;
  language: "en" | "tl";
  is_canonical: boolean;
  sort_order: number;
};

const toAlias = (row: AliasRow): AnimationAlias => ({
  id: row.id,
  assetId: row.asset_id,
  phrase: row.phrase,
  language: row.language,
  isCanonical: row.is_canonical,
  sortOrder: row.sort_order,
});

export async function listAliasesForAsset(assetId: string): Promise<AnimationAlias[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("animation_asset_aliases")
    .select("id, asset_id, phrase, language, is_canonical, sort_order")
    .eq("asset_id", assetId)
    .order("language")
    .order("sort_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAlias);
}

/**
 * Every alias in the system, with the gloss it resolves to.
 *
 * Not filtered to published assets. An alias on a drafted sign should still
 * resolve to that gloss so the word stops fingerspelling the moment the asset
 * is published, rather than needing the page reloaded afterwards.
 */
export async function listAllAliases(): Promise<PublishedAlias[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("animation_asset_aliases")
    .select("phrase, language, is_canonical, animation_assets!inner(gloss)")
    .order("phrase");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const joined = (row as { animation_assets: { gloss: string } | { gloss: string }[] }).animation_assets;
    const gloss = Array.isArray(joined) ? joined[0]?.gloss : joined?.gloss;
    return {
      phrase: (row as { phrase: string }).phrase,
      gloss: (gloss ?? "").toUpperCase(),
      language: (row as { language: "en" | "tl" }).language,
      isCanonical: (row as { is_canonical: boolean }).is_canonical,
    };
  }).filter((a) => a.gloss);
}

/** Every phrase already claimed, for conflict detection. */
export async function listClaimedPhrases(): Promise<{ phrase: string; gloss: string }[]> {
  const all = await listAllAliases();
  return all.map((a) => ({ phrase: a.phrase, gloss: a.gloss }));
}

export async function createAlias(input: {
  assetId: string;
  phrase: string;
  language: "en" | "tl";
  isCanonical: boolean;
}): Promise<AnimationAlias> {
  const supabase = createSupabaseServiceClient();

  // Appended, not inserted at the front: the admin controls order explicitly
  // and a new phrase arriving above the canonical one would be surprising.
  const { data: last } = await supabase
    .from("animation_asset_aliases")
    .select("sort_order")
    .eq("asset_id", input.assetId)
    .eq("language", input.language)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (last?.sort_order ?? -1) + 1;

  // Only one canonical per (asset, language) — the database enforces it, so
  // clear the old one rather than colliding with a constraint mid-request.
  if (input.isCanonical) await clearCanonical(input.assetId, input.language);

  const { data, error } = await supabase
    .from("animation_asset_aliases")
    .insert({
      asset_id: input.assetId,
      phrase: input.phrase,
      language: input.language,
      is_canonical: input.isCanonical,
      sort_order: sortOrder,
    })
    .select("id, asset_id, phrase, language, is_canonical, sort_order")
    .single();

  if (error) throw new Error(error.message);
  return toAlias(data);
}

export async function deleteAlias(aliasId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("animation_asset_aliases").delete().eq("id", aliasId);
  if (error) throw new Error(error.message);
}

async function clearCanonical(assetId: string, language: "en" | "tl"): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("animation_asset_aliases")
    .update({ is_canonical: false })
    .eq("asset_id", assetId)
    .eq("language", language)
    .eq("is_canonical", true);
  if (error) throw new Error(error.message);
}

export async function setCanonicalAlias(aliasId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("animation_asset_aliases")
    .select("asset_id, language")
    .eq("id", aliasId)
    .single();
  if (error) throw new Error(error.message);

  await clearCanonical(data.asset_id, data.language);

  const { error: setError } = await supabase
    .from("animation_asset_aliases")
    .update({ is_canonical: true })
    .eq("id", aliasId);
  if (setError) throw new Error(setError.message);
}

/** Persists an explicit ordering for one asset's aliases in one language. */
export async function reorderAliases(aliasIdsInOrder: string[]): Promise<void> {
  const supabase = createSupabaseServiceClient();
  for (const [index, id] of aliasIdsInOrder.entries()) {
    const { error } = await supabase
      .from("animation_asset_aliases")
      .update({ sort_order: index })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

/** Glosses that have no alias at all — reachable only by publishing, never by typing. */
export async function listGlossesWithoutAliases(): Promise<string[]> {
  const supabase = createSupabaseServiceClient();
  const [{ data: assets, error: assetError }, { data: aliases, error: aliasError }] = await Promise.all([
    supabase.from("animation_assets").select("id, gloss"),
    supabase.from("animation_asset_aliases").select("asset_id"),
  ]);
  if (assetError) throw new Error(assetError.message);
  if (aliasError) throw new Error(aliasError.message);

  const withAliases = new Set((aliases ?? []).map((a) => a.asset_id));
  return (assets ?? []).filter((a) => !withAliases.has(a.id)).map((a) => a.gloss);
}
