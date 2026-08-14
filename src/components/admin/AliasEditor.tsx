"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Plus, Star, X } from "lucide-react";
import { aliasClient, type AliasRecord } from "@/lib/aliases/client";
import { normalisePhrase } from "@/lib/aliases/normalisePhrase";
import type { AliasConflict } from "@/lib/aliases/conflicts";

/**
 * The words that play one sign.
 *
 * One component, two entry points: the Animation Library detail panel and the
 * publish step. A new sign that ships with no words is unreachable by typing —
 * silently, with nothing on screen saying so — which is why the publish flow
 * gets the same editor rather than a cut-down version.
 */

const LANGUAGE_LABEL: Record<"en" | "tl", string> = { en: "English", tl: "Filipino" };

interface AliasEditorProps {
  assetId: string;
  gloss: string;
  /** Rendered more compactly inside the publish step. */
  compact?: boolean;
  onCountChange?: (count: number) => void;
}

export function AliasEditor({ assetId, gloss, compact = false, onCountChange }: AliasEditorProps) {
  const [aliases, setAliases] = useState<AliasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<AliasConflict[]>([]);
  const [phrase, setPhrase] = useState("");
  const [language, setLanguage] = useState<"en" | "tl">("tl");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await aliasClient.list(assetId);
      setAliases(next);
      onCountChange?.(next.length);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this sign's words");
    } finally {
      setLoading(false);
    }
  }, [assetId, onCountChange]);

  useEffect(() => { void load(); }, [load]);

  /**
   * What will actually be stored, shown before saving.
   *
   * The normaliser substitutes spelling variants, so "kumusta ka" is stored as
   * "kamusta ka". Saving silently would be correct and baffling — you would
   * type one thing and see another in the list.
   */
  const preview = useMemo(() => (phrase.trim() ? normalisePhrase(phrase).phrase : ""), [phrase]);
  const willChange = preview && preview !== phrase.trim().toLowerCase();

  const add = useCallback(async () => {
    if (!phrase.trim()) return;
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      const result = await aliasClient.create({ assetId, phrase, language });
      setWarnings(result.conflicts.filter((c) => c.severity === "warn"));
      setPhrase("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that phrase");
    } finally {
      setBusy(false);
    }
  }, [assetId, phrase, language, load]);

  const remove = useCallback(async (aliasId: string) => {
    setBusy(true);
    try { await aliasClient.remove(aliasId); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not remove that phrase"); }
    finally { setBusy(false); }
  }, [load]);

  const makeCanonical = useCallback(async (aliasId: string) => {
    setBusy(true);
    try { await aliasClient.setCanonical(aliasId); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not set the display word"); }
    finally { setBusy(false); }
  }, [load]);

  const move = useCallback(async (language: "en" | "tl", index: number, direction: -1 | 1) => {
    const group = aliases.filter((a) => a.language === language);
    const target = index + direction;
    if (target < 0 || target >= group.length) return;
    const reordered = [...group];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    try { await aliasClient.reorder(reordered.map((a) => a.id)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save the new order"); }
    finally { setBusy(false); }
  }, [aliases, load]);

  const byLanguage = useMemo(() => ({
    tl: aliases.filter((a) => a.language === "tl"),
    en: aliases.filter((a) => a.language === "en"),
  }), [aliases]);

  return (
    <div className="alias-editor">
      <div className="alias-editor-head">
        <div>
          <p className="alias-editor-title">Words that play {gloss}</p>
          <p className="alias-editor-hint">
            Typing any of these plays this sign. The gloss <code>{gloss}</code> stays its name.
          </p>
        </div>
        {loading && <Loader2 size={14} className="alias-spin" />}
      </div>

      {!loading && aliases.length === 0 && (
        // The silent failure this feature exists to end: a published sign that
        // nothing can trigger.
        <p className="alias-editor-empty">
          <AlertTriangle size={14} />
          No words yet — nobody can reach this sign by typing. Add at least one below.
        </p>
      )}

      {(["tl", "en"] as const).map((lang) => (
        byLanguage[lang].length > 0 && (
          <div key={lang} className="alias-group">
            <p className="alias-group-label">{LANGUAGE_LABEL[lang]}</p>
            <ul className="alias-list">
              {byLanguage[lang].map((alias, index) => (
                <li key={alias.id} className={alias.isCanonical ? "alias-row is-canonical" : "alias-row"}>
                  <span className="alias-phrase">{alias.phrase}</span>
                  {alias.isCanonical && <span className="alias-badge">Shown on screen</span>}
                  <span className="alias-row-actions">
                    <button type="button" title="Move up" disabled={busy || index === 0}
                      onClick={() => move(lang, index, -1)}><ChevronUp size={13} /></button>
                    <button type="button" title="Move down" disabled={busy || index === byLanguage[lang].length - 1}
                      onClick={() => move(lang, index, 1)}><ChevronDown size={13} /></button>
                    <button type="button" title="Show this word on screen" disabled={busy || alias.isCanonical}
                      onClick={() => makeCanonical(alias.id)}><Star size={13} /></button>
                    <button type="button" title="Remove" disabled={busy}
                      onClick={() => remove(alias.id)}><X size={13} /></button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      ))}

      <div className="alias-add">
        <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "tl")} disabled={busy}>
          <option value="tl">Filipino</option>
          <option value="en">English</option>
        </select>
        <input
          type="text"
          value={phrase}
          placeholder="e.g. kumusta ka"
          disabled={busy}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
        />
        <button type="button" className="primary" disabled={busy || !phrase.trim()} onClick={() => void add()}>
          {busy ? <Loader2 size={13} className="alias-spin" /> : <Plus size={13} />} Add
        </button>
      </div>

      {willChange && (
        <p className="alias-editor-preview">
          Stored as <code>{preview}</code> — that is the form the translator matches.
        </p>
      )}

      {error && <p className="alias-editor-error">{error}</p>}

      {warnings.map((w, i) => (
        <p key={i} className="alias-editor-warning">
          <AlertTriangle size={13} /> {w.message}
        </p>
      ))}

      {!compact && (
        <p className="alias-editor-foot">
          Saved straight to the shared database, so this works on the live site without a rebuild.
        </p>
      )}
    </div>
  );
}
