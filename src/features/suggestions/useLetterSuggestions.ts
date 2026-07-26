"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { suggest, type Suggestion } from "./suggestionEngine";
import { loadUsage, recordAcceptance, type UsageCounts } from "./usageStore";

/** FSL signs that contribute more than one character. */
const MULTI_CHARACTER_LABELS = new Set(["NG"]);

/**
 * Holds the run of letters the signer has spelled and derives ranked
 * suggestions from it.
 *
 * Deliberately knows nothing about the recognition model — callers push
 * already-recognised labels in, so this survives a future move to word-level
 * recognition unchanged.
 */
export function useLetterSuggestions(limit = 6) {
  const [letters, setLetters] = useState("");
  const [usage, setUsage] = useState<UsageCounts>({});

  // localStorage is unavailable during SSR, so read it after mount.
  useEffect(() => setUsage(loadUsage()), []);

  const suggestions = useMemo<Suggestion[]>(
    () => suggest(letters, { usage, limit }),
    [letters, usage, limit],
  );

  const appendLabel = useCallback((label: string) => {
    const upper = label.toUpperCase().trim();
    // "NG" is one sign but two characters; everything else contributes one.
    const token = MULTI_CHARACTER_LABELS.has(upper)
      ? upper
      : upper.replace(/[^A-Z0-9Ñ]/g, "").slice(0, 1);
    if (!token) return;
    setLetters((previous) => previous + token);
  }, []);

  const backspace = useCallback(() => {
    setLetters((previous) => (previous.endsWith("NG") ? previous.slice(0, -2) : previous.slice(0, -1)));
  }, []);

  const clear = useCallback(() => setLetters(""), []);

  const accept = useCallback((phrase: string) => {
    setUsage((current) => recordAcceptance(phrase, current));
    setLetters("");
    return phrase;
  }, []);

  return {
    letters,
    suggestions,
    topSuggestion: suggestions[0] ?? null,
    appendLabel,
    backspace,
    clear,
    accept,
  };
}
