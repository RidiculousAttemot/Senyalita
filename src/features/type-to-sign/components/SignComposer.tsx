"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ClipboardPaste, Loader2, Mic, Volume2, X } from "lucide-react";
import type { DetectedLanguage } from "@/features/translation-pipeline/types";

const LANGUAGE_LABEL: Record<DetectedLanguage, string> = {
  en: "English",
  tl: "Filipino",
  mixed: "Mixed",
};

const MAX_CHARS = 500;

interface SignComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSpeak: () => void;
  onListen: () => void;
  isListening: boolean;
  speechSupported: boolean;
  loading: boolean;
  detectedLanguage: DetectedLanguage | null;
  coverage: number | null;
}

export function SignComposer({
  value, onChange, onSubmit, onSpeak, onListen,
  isListening, speechSupported, loading, detectedLanguage, coverage,
}: SignComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [value]);

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const quality = coverage === null ? null : Math.round(coverage * 100);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(`${value}${text}`.slice(0, MAX_CHARS));
    } catch {
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <section
      aria-labelledby="composer-heading"
      className="rounded-2xl border border-fsl-border bg-fsl-surface shadow-[0_10px_30px_-18px_rgba(70,45,28,0.45)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-fsl-border px-5 py-3.5">
        <h2 id="composer-heading" className="text-sm font-semibold text-fsl-ink">
          Compose
        </h2>
        <div className="flex items-center gap-2">
          {detectedLanguage && (
            <motion.span
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full bg-fsl-teal-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-fsl-teal"
            >
              {LANGUAGE_LABEL[detectedLanguage]} detected
            </motion.span>
          )}
          {quality !== null && (
            <span
              title="Share of words with a direct FSL sign"
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                quality >= 80
                  ? "bg-fsl-success-soft text-fsl-success"
                  : quality >= 50
                    ? "bg-fsl-amber-soft text-fsl-amber"
                    : "bg-fsl-coral-soft text-fsl-coral-dark"
              }`}
            >
              {quality}% sign coverage
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-4">
        <label htmlFor="composer-input" className="sr-only">
          Text to translate into Filipino Sign Language
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          value={value}
          rows={3}
          maxLength={MAX_CHARS}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a word, phrase, or sentence in English or Filipino..."
          className="w-full resize-none bg-transparent text-[17px] leading-relaxed text-fsl-ink outline-none placeholder:text-fsl-faint"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-1">
        <button
          type="button"
          onClick={onListen}
          disabled={!speechSupported}
          aria-pressed={isListening}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isListening
              ? "border-fsl-coral bg-fsl-coral-soft text-fsl-coral-dark"
              : "border-fsl-border text-fsl-body hover:border-fsl-border-strong hover:bg-fsl-sunken"
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          {isListening ? "Listening" : "Dictate"}
        </button>
        <button
          type="button"
          onClick={handlePaste}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-fsl-border px-2.5 text-xs font-medium text-fsl-body transition-colors hover:border-fsl-border-strong hover:bg-fsl-sunken"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Paste
        </button>
        <button
          type="button"
          onClick={onSpeak}
          disabled={!value.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-fsl-border px-2.5 text-xs font-medium text-fsl-body transition-colors hover:border-fsl-border-strong hover:bg-fsl-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Volume2 className="h-3.5 w-3.5" /> Read aloud
        </button>
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={!value}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-medium text-fsl-muted transition-colors hover:bg-fsl-sunken hover:text-fsl-body disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fsl-border px-5 py-3">
        <p className="text-[11px] tabular-nums text-fsl-faint">
          {words} {words === 1 ? "word" : "words"} · {value.length}/{MAX_CHARS}
          <span className="ml-2 hidden sm:inline">Ctrl+Enter to translate</span>
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-fsl-coral px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(216,105,74,0.9)] transition-colors hover:bg-fsl-coral-dark disabled:cursor-not-allowed disabled:bg-fsl-faint disabled:shadow-none"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? "Translating" : "Translate to FSL"}
        </button>
      </div>
    </section>
  );
}
