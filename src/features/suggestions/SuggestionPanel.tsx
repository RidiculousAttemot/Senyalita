"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CornerDownLeft, Delete, X } from "lucide-react";
import type { Suggestion } from "./suggestionEngine";

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  exact: "exact",
  phrase: "phrase",
  prefix: "completion",
  fuzzy: "corrected",
};

interface SuggestionPanelProps {
  letters: string;
  suggestions: Suggestion[];
  onAccept: (phrase: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

export function SuggestionPanel({
  letters, suggestions, onAccept, onBackspace, onClear,
}: SuggestionPanelProps) {
  const [top, ...rest] = suggestions;

  return (
    <section
      aria-labelledby="suggestion-heading"
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_8px_20px_rgba(69,45,28,0.06)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="suggestion-heading" className="text-sm font-semibold text-stone-800">
          Spelled letters
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBackspace}
            disabled={letters.length === 0}
            aria-label="Delete last letter"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800 disabled:opacity-35"
          >
            <Delete className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={letters.length === 0}
            aria-label="Clear spelled letters"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800 disabled:opacity-35"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-3 py-2"
      >
        <AnimatePresence initial={false}>
          {letters.split("").map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.16 }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white font-mono text-sm font-bold text-stone-700 shadow-sm"
            >
              {letter}
            </motion.span>
          ))}
        </AnimatePresence>
        {letters.length === 0 && (
          <span className="text-xs text-stone-400">
            Sign letters to spell a word — suggestions appear here.
          </span>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {top && (
          <motion.div
            key={top.phrase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4"
          >
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Did you mean
            </p>
            <button
              type="button"
              onClick={() => onAccept(top.phrase)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[#d88567]/40 bg-[#fdf5f3] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#d88567] hover:shadow-md"
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-[#bc6d53]" />
                <span className="font-mono text-base font-bold tracking-wide text-stone-800">
                  {top.phrase}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  {KIND_LABEL[top.kind]}
                </span>
                <CornerDownLeft className="h-3.5 w-3.5 text-stone-400 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {rest.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Other suggestions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rest.map((suggestion) => (
              <button
                key={suggestion.phrase}
                type="button"
                onClick={() => onAccept(suggestion.phrase)}
                title={`${KIND_LABEL[suggestion.kind]}${
                  suggestion.distance ? ` · ${suggestion.distance} letter correction` : ""
                }`}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-stone-600 transition-all hover:-translate-y-0.5 hover:border-[#d88567] hover:bg-[#fdf5f3] hover:text-[#bc6d53]"
              >
                {suggestion.phrase}
              </button>
            ))}
          </div>
        </div>
      )}

      {letters.length >= 2 && suggestions.length === 0 && (
        <p className="mt-3 text-xs text-stone-400">
          No match yet — keep signing, or add the letters directly.
        </p>
      )}
    </section>
  );
}
