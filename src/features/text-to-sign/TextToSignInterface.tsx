"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { SignAnimationPlayer } from "@/features/sign-animation/player/SignAnimationPlayer";
import type { SignAnimationPlayerHandle } from "@/features/sign-animation/player/SignAnimationPlayer";
import { AnimationLoader } from "@/features/sign-animation/loader";
import type { AnimationClip, AvatarTheme } from "@/features/sign-animation/types";
import { runPipeline } from "./pipeline";
import type { PipelineResult } from "./pipeline";
import { getTts } from "@/lib/tts";
import type { Tts, TtsVoice } from "@/lib/tts";
import type { TranslationState, TranslationResult } from "@/features/translation-result";
import { createEmptyResult } from "@/features/translation-result";
import { globalEngine } from "@/features/fsl-translation";
import type { FslTranslationResult } from "@/features/fsl-translation";
import { mapWordToGesture } from "@/features/gesture-mapping";
import { computeTranslationConfidence } from "./confidenceIndicator";
import type { TranslationConfidence } from "./confidenceIndicator";


const AUTO_SPEAK_KEY = "fsl_auto_speak";

type PipelineStatus = "idle" | "running" | "done" | "error";

interface TextToSignInterfaceProps {
  onGestureChange?: (gesture: string, current: number, total: number) => void;
}

function loadAutoSpeakPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_SPEAK_KEY) === "true";
  } catch {
    return false;
  }
}

function saveAutoSpeakPref(val: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_SPEAK_KEY, val ? "true" : "false");
  } catch {
  }
}

const supportedChars = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','Ñ','NG','O','P','Q','R','S','T','U','V','W','X','Y','Z',
];

const quickPhrases = ['ABC', 'FSL', 'Ñ', 'NG'];

const avatarStyleOptions: { name: string; gradient: string; theme: AvatarTheme }[] = [
  { name: 'Warm',     gradient: 'linear-gradient(135deg,#C4855A,#E8B89A)', theme: 'minimal' },
  { name: 'Midnight', gradient: 'linear-gradient(135deg,#2A2035,#4A3560)', theme: 'skeleton' },
  { name: 'Ocean',    gradient: 'linear-gradient(135deg,#7EC8E3,#C8EAF5)', theme: 'flat' },
  { name: 'Ember',    gradient: 'linear-gradient(135deg,#E8A878,#F5D5B8)', theme: 'avatar2d' },
];

export function TextToSignInterface({ onGestureChange }: TextToSignInterfaceProps) {
  const [inputText, setInputText] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [state, setState] = useState<TranslationState>("idle");
  const [translationResult, setTranslationResult] = useState<TranslationResult>(createEmptyResult());
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(loadAutoSpeakPref);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [queueTotal, setQueueTotal] = useState(0);
  const translatedRef = useRef(false);
  const autoSpeakRef = useRef(autoSpeak);
  const [fslResult, setFslResult] = useState<FslTranslationResult | null>(null);
  const [confidence, setConfidence] = useState<TranslationConfidence | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 320, height: 340 });
  const animationPanelRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<SignAnimationPlayerHandle | null>(null);
  autoSpeakRef.current = autoSpeak;

  const [selectedAvatar, setSelectedAvatar] = useState('Warm');
  const [avatarMode, setAvatarMode] = useState('human');
  const [viewMode, setViewMode] = useState<'human' | 'skeleton' | 'split'>('skeleton');
  const [showDebug, setShowDebug] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentGestureIndex, setCurrentGestureIndex] = useState(0);
  const [totalClips, setTotalClips] = useState(0);
  const totalClipsRef = useRef(0);

  const ttsRef = useRef<Tts | null>(null);

  useEffect(() => {
    const tts = getTts();
    ttsRef.current = tts;
    setSelectedVoice(null);
    setSpeechRate(tts.rate);
    tts.listVoicesAsync().then((v) => setVoices(v));
    const unsub = tts.onVoicesChanged(() => {
      setVoices(tts.getVoices());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const el = animationPanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setPreviewSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleVoiceChange = useCallback((uri: string) => {
    const tts = ttsRef.current;
    if (!tts) return;
    tts.setVoice(uri);
    setSelectedVoice(uri);
  }, []);

  const handleRateChange = useCallback((rate: number) => {
    const tts = ttsRef.current;
    if (!tts) return;
    tts.setRate(rate);
    setSpeechRate(rate);
  }, []);

  const handleTranslate = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setError("Please enter text to translate");
      return;
    }

    setState("translating");
    setPipelineStatus("running");
    setError(null);
    setCurrentQueueIndex(-1);
    setQueueTotal(0);
    translatedRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentGestureIndex(0);
    setTotalClips(0);

    try {
      const startTime = performance.now();
      const result = runPipeline(trimmed);
      const elapsed = performance.now() - startTime;

      if (elapsed < 300) {
        setState("generating-sign-sequence");
      }

      setPipelineResult(result);

      const glossArr = result.gloss.glossSequence.map((g) => g.gloss);

      const fsl = globalEngine.translate(trimmed, {
        useGrammar: true,
        useContext: false,
      });
      setFslResult(fsl);

      const conf = computeTranslationConfidence(result.gloss.glossSequence, result.sequence);
      setConfidence(conf);

      setTranslationResult({
        originalText: result.input,
        translatedText: glossArr.join(" "),
        gloss: glossArr,
        gestures: [],
        animationQueue: [],
        language: result.normalized.language,
        confidence: result.animations.length > 0 ? 1 : 0,
      });

      setPipelineStatus("done");
      setState("generating-sign-sequence");
      setLoadingClips(true);

      const loader = new AnimationLoader();
      const loadedClips: AnimationClip[] = [];
      const unavailableGlosses: string[] = [];
      for (let i = 0; i < glossArr.length; i++) {
        const asset = await loader.load(glossArr[i]);
        if (asset) {
          loadedClips.push({
            id: `anim-${glossArr[i]}-${i}-${Date.now()}`,
            gesture: glossArr[i],
            asset,
          });
        } else {
          unavailableGlosses.push(glossArr[i]);
        }
      }
      setClips(loadedClips);
      if (unavailableGlosses.length > 0) {
        setError(`Animation unavailable: ${[...new Set(unavailableGlosses)].join(", ")}.`);
      }
      setAnimationKey((prev) => prev + 1);
      setCurrentGesture(loadedClips[0]?.gesture ?? null);
      setCurrentQueueIndex(0);
      setQueueTotal(loadedClips.length);
      setTotalClips(loadedClips.length);
      totalClipsRef.current = loadedClips.length;
      setCurrentGestureIndex(0);
      setLoadingClips(false);
      setState("animating");
      setIsPlaying(true);

      if (autoSpeakRef.current && glossArr.length > 0) {
        const tts = ttsRef.current;
        if (tts && tts.isSupported()) {
          tts.speak(glossArr.join(" "));
        }
      }
    } catch (e) {
      setPipelineStatus("error");
      setState("error");
      setLoadingClips(false);
      const message = e instanceof Error ? e.message : "Translation failed";
      setError(message);
      setTranslationResult((prev) => ({
        ...prev,
        error: message,
      }));
    }
  }, [inputText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleTranslate();
      }
    },
    [handleTranslate],
  );

  const handleGestureChange = useCallback(
    (gesture: string, current: number, total: number) => {
      setCurrentGesture(gesture);
      setCurrentQueueIndex(current);
      setQueueTotal(total);
      setIsPlaying(true);
      setIsPaused(false);
      setCurrentGestureIndex(current);
      setTotalClips(total);
      totalClipsRef.current = total;
      onGestureChange?.(gesture, current, total);
    },
    [onGestureChange],
  );

  const handleComplete = useCallback(() => {
    setCurrentGesture(null);
    setCurrentQueueIndex(-1);
    setState("completed");
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentGestureIndex(totalClipsRef.current);
  }, []);

  const handleClear = useCallback(() => {
    setInputText("");
    setPipelineResult(null);
    setClips([]);
    setLoadingClips(false);
    setCurrentGesture(null);
    setError(null);
    setPipelineStatus("idle");
    setState("idle");
    setTranslationResult(createEmptyResult());
    setFslResult(null);
    setCurrentQueueIndex(-1);
    setQueueTotal(0);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentGestureIndex(0);
    setTotalClips(0);
    translatedRef.current = false;
  }, []);

  const handleAutoSpeakToggle = useCallback(() => {
    setAutoSpeak((prev) => {
      const next = !prev;
      saveAutoSpeakPref(next);
      return next;
    });
  }, []);

  const handleSpeakNow = useCallback(() => {
    const text = translationResult.translatedText || inputText;
    if (!text.trim()) return;
    const tts = ttsRef.current;
    if (tts && tts.isSupported()) {
      tts.speak(text, { rate: speechRate });
    } else {
      setError("Text-to-speech is not supported in this browser");
    }
  }, [translationResult.translatedText, inputText, speechRate]);

  const handleReplay = useCallback(() => {
    playerRef.current?.replay();
    setIsPaused(false);
    setIsPlaying(true);
  }, []);

  const handlePausePlay = useCallback(() => {
    if (isPaused) {
      playerRef.current?.play();
      setIsPaused(false);
    } else {
      playerRef.current?.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const handleStop = useCallback(() => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentGestureIndex(0);
  }, []);

  const handleChipClick = useCallback((phrase: string) => {
    setInputText(phrase);
  }, []);

  const glossDisplay = useMemo(() => {
    if (!pipelineResult) return [];
    return pipelineResult.gloss.glossSequence.map((g) => {
      const mapping = mapWordToGesture(g.gloss.toLowerCase());
      return {
        original: g.original,
        gloss: g.gloss,
        hasAnimation: mapping.hasAnimation,
      };
    });
  }, [pipelineResult]);

  const canTranslate = useMemo(
    () => inputText.trim().length > 0 && pipelineStatus !== "running",
    [inputText, pipelineStatus],
  );

  const progressPercent = totalClips > 0
    ? Math.min(100, (currentGestureIndex / totalClips) * 100)
    : 0;

  const selectedTheme = avatarStyleOptions.find((a) => a.name === selectedAvatar)?.theme ?? 'minimal';

  const translating = state === "translating" || state === "generating-sign-sequence";
  const animating = state === "animating";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>

      {/* Progress indicator */}
      {(translating || animating) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 6, fontSize: 12,
          background: translating ? "#1e3a5f" : "#1e293b",
          color: "#93c5fd",
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            border: "2px solid #60a5fa",
            borderTopColor: "transparent",
            animation: translating ? "sp_cta 0.6s linear infinite" : "none",
          }} />
          <span>
            {state === "translating" && "Translating..."}
            {state === "generating-sign-sequence" && "Generating sign sequence..."}
            {state === "animating" && "Animating..."}
          </span>
          <style>{`@keyframes sp_cta { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "10px 14px", background: "#451a1a", border: "1px solid #ef4444",
          borderRadius: 8, color: "#fca5a5", fontSize: 13,
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 12, background: "none", border: "1px solid #ef4444",
              color: "#fca5a5", borderRadius: 4, padding: "2px 8px",
              fontSize: 11, cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input card */}
      <div style={{ background: "#1e293b", borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0, marginBottom: 8 }}>
          Your message
        </p>
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (state === "error") setState("typing");
            else if (state === "idle" && e.target.value.trim()) setState("typing");
            else if (state === "typing" && !e.target.value.trim()) setState("idle");
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type letters or text to sign in FSL..."
          className="input"
          rows={3}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 14,
            resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
            background: "#0f172a", border: "1px solid #334155",
            borderRadius: 8, color: "#e2e8f0",
          }}
          disabled={pipelineStatus === "running"}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={handleTranslate}
            style={{
              padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap",
              background: "#3b82f6", color: "#fff", border: "none",
              borderRadius: 6, fontWeight: 600, cursor: canTranslate ? "pointer" : "not-allowed",
              opacity: canTranslate ? 1 : 0.5,
            }}
            disabled={!canTranslate}
          >
            {pipelineStatus === "running" ? "Translating\u2026" : "Translate to Sign"}
          </button>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 10px", borderRadius: 6, fontSize: 12,
            background: "#1e3a5f", color: "#93c5fd", fontWeight: 500,
          }}>
            FSL — Filipino Sign Language
          </span>
          <button
            onClick={handleSpeakNow}
            style={{
              padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap",
              background: "transparent", color: "#94a3b8", border: "1px solid #475569",
              borderRadius: 6, cursor: "pointer",
            }}
            disabled={!inputText.trim() && !translationResult.translatedText}
          >
            🎤 Speak
          </button>
          <span style={{ fontSize: 11, color: "#64748b", marginLeft: "auto" }}>
            Ctrl+Enter to submit
          </span>
        </div>
      </div>

      {/* Chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {quickPhrases.map((phrase) => (
          <button
            key={phrase}
            onClick={() => handleChipClick(phrase)}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500,
              background: "#1e293b", color: "#94a3b8", border: "1px solid #334155",
              borderRadius: 999, cursor: "pointer",
            }}
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div
        ref={animationPanelRef}
        style={{
          width: "100%", minHeight: 420, height: "auto",
          background: "#f5f0eb", borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}
      >
        {loadingClips ? (
          <div style={{
            width: "100%", height: 420, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "#f5f0eb", borderRadius: 12,
          }}>
            <p style={{ color: "#9C9189", fontSize: 14 }}>Loading animations...</p>
          </div>
        ) : clips.length > 0 ? (
          <div style={{ width: "100%", height: 420 }}>
            <SignAnimationPlayer
              ref={playerRef}
              key={animationKey}
              clips={clips}
              width={previewSize.width}
              height={420}
              speed={1}
              backgroundColor="#f5f0eb"
              theme={selectedTheme}
              onGestureChange={handleGestureChange}
              onComplete={handleComplete}
              viewMode={viewMode}
              showDebug={showDebug}
            />
          </div>
        ) : (
          <div style={{
            textAlign: "center", color: "#9C9189", padding: 40,
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}>
              <path d="M15.5 3.5A2.5 2.5 0 0 1 13 6h-2a2.5 2.5 0 0 1-2.5-2.5v0A2.5 2.5 0 0 1 11 1h2a2.5 2.5 0 0 1 2.5 2.5v0Z" />
              <path d="M12 21v-6" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              <path d="M6 21h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Z" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Sign preview</p>
            <p style={{ fontSize: 13, margin: 0 }}>Type a message and press Translate</p>
          </div>
        )}
      </div>

      {/* Playback controls */}
      {clips.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "#1e293b", borderRadius: 8,
        }}>
          <button onClick={handleReplay} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "4px 8px" }} title="Replay">
            ↺
          </button>
          <button onClick={handlePausePlay} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "4px 8px" }} title={isPaused ? "Play" : "Pause"}>
            {isPaused ? "▶" : "⏸"}
          </button>
          <button onClick={handleStop} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "4px 8px" }} title="Stop">
            ⏹
          </button>
          <div style={{ flex: 1, height: 6, background: "#0f172a", borderRadius: 3, margin: "0 8px", overflow: "hidden" }}>
            <div style={{ width: `${progressPercent}%`, height: "100%", background: "#3b82f6", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 12, color: "#64748b", minWidth: 50, textAlign: "right" }}>
            {currentGestureIndex}/{totalClips}
          </span>
        </div>
      )}

      {/* View Mode */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          View Mode
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setViewMode('human')}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500,
              background: viewMode === 'human' ? '#3b82f6' : '#1e293b',
              color: viewMode === 'human' ? '#fff' : '#94a3b8',
              border: `1px solid ${viewMode === 'human' ? '#3b82f6' : '#334155'}`,
              borderRadius: 6, cursor: "pointer",
            }}
          >
            Human
          </button>
          <button
            onClick={() => setViewMode('skeleton')}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500,
              background: viewMode === 'skeleton' ? '#3b82f6' : '#1e293b',
              color: viewMode === 'skeleton' ? '#fff' : '#94a3b8',
              border: `1px solid ${viewMode === 'skeleton' ? '#3b82f6' : '#334155'}`,
              borderRadius: 6, cursor: "pointer",
            }}
          >
            Skeleton
          </button>
          <button
            onClick={() => setViewMode('split')}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 500,
              background: viewMode === 'split' ? '#3b82f6' : '#1e293b',
              color: viewMode === 'split' ? '#fff' : '#94a3b8',
              border: `1px solid ${viewMode === 'split' ? '#3b82f6' : '#334155'}`,
              borderRadius: 6, cursor: "pointer",
            }}
          >
            Split
          </button>
        </div>
      </div>

      {/* Debug Overlay */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Debug
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
            />
            Show Frame Info
          </label>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            (Frame / FPS / Drift)
          </span>
        </div>
      </div>

      {/* Debug Panel — Admin Only */}
      <DebugPanel
        pipelineResult={pipelineResult}
        clips={clips}
        fslResult={fslResult}
        confidence={confidence}
        currentGestureIndex={currentGestureIndex}
        totalClips={totalClips}
        animating={animating}
        loadingClips={loadingClips}
      />

      {/* Avatar Style */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Avatar Style
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {avatarStyleOptions.map((style) => (
            <button
              key={style.name}
              onClick={() => setSelectedAvatar(style.name)}
              style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 500,
                background: selectedAvatar === style.name ? style.gradient : '#1e293b',
                color: selectedAvatar === style.name ? '#fff' : '#94a3b8',
                border: selectedAvatar === style.name ? 'none' : '1px solid #334155',
                borderRadius: 6, cursor: "pointer",
              }}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

function DebugPanel({
  pipelineResult,
  clips,
  fslResult,
  confidence,
  currentGestureIndex,
  totalClips,
  animating,
  loadingClips,
}: {
  pipelineResult: PipelineResult | null;
  clips: AnimationClip[];
  fslResult: FslTranslationResult | null;
  confidence: TranslationConfidence | null;
  currentGestureIndex: number;
  totalClips: number;
  animating: boolean;
  loadingClips: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/animation-analytics")
      .then((r) => { if (r.ok) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  const steps = [
    { label: "Input Text", done: !!pipelineResult, active: false },
    { label: "Normalized Text", done: !!pipelineResult, active: false },
    { label: "Gloss Sequence", done: !!pipelineResult?.gloss, active: false },
    { label: "Matched Animation", done: clips.length > 0, active: loadingClips },
    { label: "Playing", done: animating && !loadingClips, active: animating && !loadingClips },
    { label: "Completed", done: !animating && clips.length > 0, active: false },
  ];

  const glossSteps = pipelineResult?.gloss.glossSequence ?? [];
  const totalDuration = pipelineResult?.totalDuration ?? 0;

  return (
    <div style={{
      background: "#0c1929", border: "1px solid #1e3a5f", borderRadius: 10,
      overflow: "hidden", fontSize: 12, fontFamily: "monospace",
    }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%", padding: "10px 14px", background: "none", border: "none",
          color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8, textAlign: "left",
        }}
      >
        <span style={{ opacity: 0.5 }}>⎔</span>
        Translation Debug Panel (Admin)
        <span style={{ marginLeft: "auto", opacity: 0.5 }}>{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px", display: "grid", gap: 12 }}>
          {/* Pipeline steps */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 4, fontSize: 10,
                background: step.done ? "#14532d" : step.active ? "#1e3a5f" : "#1e293b",
                color: step.done ? "#86efac" : step.active ? "#93c5fd" : "#475569",
              }}>
                <span>{step.done ? "✓" : step.active ? "○" : "·"}</span>
                {step.label}
              </div>
            ))}
          </div>

          {/* Gloss sequence */}
          {glossSteps.length > 0 && (
            <div>
              <div style={{ color: "#64748b", marginBottom: 4 }}>Gloss Sequence</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {glossSteps.map((g, i) => (
                  <span key={i} style={{
                    padding: "2px 8px", background: "#1e293b", borderRadius: 4,
                    color: "#94a3b8", fontSize: 11,
                  }}>
                    {g.gloss}
                    <span style={{ color: "#475569", marginLeft: 4 }}>
                      ({g.confidence.toFixed(2)})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {[
              { label: "Total Duration", value: `${totalDuration.toFixed(1)}s` },
              { label: "Animation Clips", value: `${clips.length}` },
              { label: "Current Index", value: `${currentGestureIndex}/${totalClips}` },
              { label: "Playing", value: animating ? "Yes" : "No" },
              { label: "Loading", value: loadingClips ? "Yes" : "No" },
              { label: "Confidence", value: confidence ? `${(confidence.overall * 100).toFixed(0)}%` : "—" },
              { label: "FSL Strategy", value: "—" },
              { label: "Language", value: pipelineResult?.normalized.language ?? "—" },
            ].map((stat, i) => (
              <div key={i} style={{ background: "#1e293b", borderRadius: 6, padding: "6px 10px" }}>
                <div style={{ color: "#64748b", fontSize: 9, textTransform: "uppercase" }}>{stat.label}</div>
                <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Missing animations */}
          {pipelineResult && (
            <div>
              <div style={{ color: "#64748b", marginBottom: 4 }}>Animation Resolution</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pipelineResult.animations.map((a, i) => (
                  <span key={i} style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 10,
                    background: a.clip ? "#1e293b" : "#2d1a1a",
                    color: a.clip ? "#94a3b8" : "#f87171",
                  }}>
                    {a.gesture}
                    <span style={{ color: "#475569", marginLeft: 4 }}>({a.strategy})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Loader stats */}
          <div style={{ fontSize: 10, color: "#475569", borderTop: "1px solid #1e293b", paddingTop: 8 }}>
            Load from: Published API → Legacy /animations/*.json
          </div>
        </div>
      )}
    </div>
  );
}
