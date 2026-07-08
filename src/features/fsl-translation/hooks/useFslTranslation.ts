"use client";

import { useState, useCallback, useRef } from "react";
import type { FslTranslationResult } from "../types";
import { FslTranslationEngine } from "../engine/fslTranslationEngine";

const engine = new FslTranslationEngine();

export interface UseFslTranslationOptions {
  useGrammar?: boolean;
  useContext?: boolean;
}

export interface FslTranslationState {
  result: FslTranslationResult | null;
  isTranslating: boolean;
  error: string | null;
}

export function useFslTranslation(options?: UseFslTranslationOptions) {
  const [state, setState] = useState<FslTranslationState>({
    result: null,
    isTranslating: false,
    error: null,
  });
  const engineRef = useRef(engine);

  const translate = useCallback(
    (input: string) => {
      if (!input.trim()) {
        setState({ result: null, isTranslating: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, isTranslating: true, error: null }));

      try {
        const result = engineRef.current.translate(input, {
          useGrammar: options?.useGrammar ?? true,
          useContext: options?.useContext ?? false,
        });
        setState({ result, isTranslating: false, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Translation failed";
        setState({ result: null, isTranslating: false, error: message });
      }
    },
    [options?.useGrammar, options?.useContext],
  );

  const clearContext = useCallback(() => {
    engineRef.current.clearContext();
  }, []);

  const getUnknownWords = useCallback(() => {
    return engineRef.current.getUnknownWords();
  }, []);

  return {
    ...state,
    translate,
    clearContext,
    getUnknownWords,
  };
}
