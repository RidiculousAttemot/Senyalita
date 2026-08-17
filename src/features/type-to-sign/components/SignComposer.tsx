"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, ClipboardPaste, Loader2, Mic, Volume2, X } from "lucide-react";
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
  dictationError?: string | null;
  loading: boolean;
  detectedLanguage: DetectedLanguage | null;
  coverage: number | null;
}

export function SignComposer({
  value, onChange, onSubmit, onSpeak, onListen,
  isListening, speechSupported, dictationError, loading, detectedLanguage, coverage,
}: SignComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
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
      className="overflow-hidden rounded-[28px] border border-senyalita-border bg-white/80 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-5">
        <h2 id="composer-heading" className="font-display text-lg font-bold tracking-tight text-senyalita-dark">
          Your message
        </h2>
        <div className="flex items-center gap-2">
          {detectedLanguage && (
            <motion.span
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full border border-senyalita-primary/20 bg-senyalita-primary/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-senyalita-primary"
            >
              {LANGUAGE_LABEL[detectedLanguage]}
            </motion.span>
          )}
          {quality !== null && (
            <motion.span
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              title="Share of words with a recorded FSL sign"
              className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${
                quality >= 80
                  ? "bg-senyalita-accent/10 text-senyalita-accent"
                  : quality >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-600"
              }`}
            >
              {quality}% covered
            </motion.span>
          )}
        </div>
      </div>

      <div className="px-6 pt-3">
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
          placeholder="Type something to translate into Filipino Sign Language..."
          className="w-full resize-none rounded-2xl border border-senyalita-border bg-white px-4 py-3.5 text-[1.0625rem] leading-relaxed text-senyalita-dark outline-none transition-all placeholder:text-slate-400 focus:border-senyalita-primary/50 focus:ring-4 focus:ring-senyalita-primary/10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
        <ComposerChip onClick={onListen} disabled={!speechSupported} active={isListening} icon={<Mic className="h-3.5 w-3.5" />}>
          {isListening ? "Listening" : "Dictate"}
        </ComposerChip>
        <ComposerChip onClick={handlePaste} icon={<ClipboardPaste className="h-3.5 w-3.5" />}>
          Paste
        </ComposerChip>
        <ComposerChip onClick={onSpeak} disabled={!value.trim()} icon={<Volume2 className="h-3.5 w-3.5" />}>
          Read aloud
        </ComposerChip>
        <ComposerChip onClick={() => onChange("")} disabled={!value} icon={<X className="h-3.5 w-3.5" />}>
          Clear
        </ComposerChip>
      </div>

      {dictationError && (
        <div role="alert" className="mx-6 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-[0.75rem] leading-snug text-amber-800">{dictationError}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-senyalita-border/70 bg-white/60 px-6 py-4">
        <p className="text-[0.6875rem] tabular-nums text-senyalita-muted">
          {words} {words === 1 ? "word" : "words"} · {value.length}/{MAX_CHARS}
          <span className="ml-2 hidden sm:inline">Ctrl+Enter to translate</span>
        </p>
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          whileTap={{ scale: 0.97 }}
          className="group inline-flex h-11 items-center gap-2 rounded-full bg-senyalita-primary px-6 text-sm font-semibold text-white shadow-lg shadow-senyalita-primary/25 transition-all hover:shadow-xl hover:shadow-senyalita-primary/35 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          {loading ? "Translating" : "Translate"}
        </motion.button>
      </div>
    </section>
  );
}

function ComposerChip({
  onClick, disabled, active, icon, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-senyalita-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${
        active
          ? "border-senyalita-primary/30 bg-senyalita-primary/10 text-senyalita-primary"
          : "border-senyalita-border bg-white text-senyalita-muted hover:-translate-y-0.5 hover:border-senyalita-primary/30 hover:text-senyalita-dark hover:shadow-sm"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
