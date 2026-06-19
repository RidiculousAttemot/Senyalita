import "server-only";
import { createSupabaseServerClient } from "../server";
import type { LanguageProfile, TranslationEntry } from "../types";

export const listLanguages = async (): Promise<LanguageProfile[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("language_profiles")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listLanguages: ${error.message}`);
  return data ?? [];
};

export const listActiveLanguages = async (): Promise<LanguageProfile[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("language_profiles")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listActiveLanguages: ${error.message}`);
  return data ?? [];
};

export const getTranslation = async (
  languageCode: string,
  gestureLabel: string
): Promise<TranslationEntry | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("translations")
    .select("*")
    .eq("language_code", languageCode)
    .eq("gesture_label", gestureLabel)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(`getTranslation: ${error.message}`);
  return data;
};

export const upsertTranslation = async (input: {
  language_code: string;
  gesture_label: string;
  translated_text: string;
  context_notes?: string | null;
}): Promise<TranslationEntry> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("translations")
    .upsert(input, { onConflict: "language_code,gesture_label" })
    .select()
    .single();
  if (error) throw new Error(`upsertTranslation: ${error.message}`);
  return data;
};
