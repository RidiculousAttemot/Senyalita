"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { SignAnimationPlayer } from "@/features/sign-animation/player/SignAnimationPlayer";
import { AnimationLoader } from "@/features/sign-animation/loader";
import type { AnimationClip } from "@/features/sign-animation/types";
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

export function TextToSignInterface({ onGestureChange }: TextToSignInterfaceProps) {
  const [inputText, setInputText] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [state, setState] = useState<TranslationState>("idle");
  const [translationResult, setTranslationResult] = useState<TranslationResult>(createEmptyResult());
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "tl">("en");
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
  const [showGlossToggle, setShowGlossToggle] = useState(true);
  const [showGestureLabels, setShowGestureLabels] = useState(true);
  const [showQueuePanel, setShowQueuePanel] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  autoSpeakRef.current = autoSpeak;

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

    try {
      const startTime = performance.now();
      const result = runPipeline(trimmed);
      const elapsed = performance.now() - startTime;

      if (elapsed < 300) {
        setState("generating-sign-sequence");
      }

      setPipelineResult(result);

      const glossArr = result.gloss.glossSequence.map((g) => g.gloss);

      // Run FSL translation engine for enhanced result
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
      for (let i = 0; i < glossArr.length; i++) {
        const asset = await loader.load(glossArr[i]);
        if (asset) {
          loadedClips.push({
            id: `anim-${glossArr[i]}-${i}-${Date.now()}`,
            gesture: glossArr[i],
            asset,
          });
        }
      }
      setClips(loadedClips);
      setAnimationKey((prev) => prev + 1);
      setCurrentGesture(loadedClips[0]?.gesture ?? null);
      setCurrentQueueIndex(0);
      setQueueTotal(loadedClips.length);
      setLoadingClips(false);
      setState("animating");

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
      if (e.key === "Enter" && !e.shiftKey) {
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
      onGestureChange?.(gesture, current, total);
    },
    [onGestureChange],
  );

  const handleComplete = useCallback(() => {
    setCurrentGesture(null);
    setCurrentQueueIndex(-1);
    setState("completed");
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

  const queueItems = useMemo(() => {
    if (!pipelineResult) return [];
    return pipelineResult.animations.map((item, i) => ({
      index: i,
      gesture: item.gesture,
      original: item.original,
      isActive: i === currentQueueIndex,
      isPast: i < currentQueueIndex,
      isFuture: i > currentQueueIndex,
    }));
  }, [pipelineResult, currentQueueIndex]);

  const canTranslate = useMemo(
    () => inputText.trim().length > 0 && pipelineStatus !== "running",
    [inputText, pipelineStatus],
  );

  const inputPlaceholder = useMemo(() => {
    if (language === "tl") {
      return "Mag-type ng pangungusap upang isalin sa sign language...";
    }
    return "Type a sentence to translate to sign language...";
  }, [language]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 640 }}>
      {/* Translation progress indicator */}
      {state !== "idle" && state !== "completed" && state !== "error" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 6, fontSize: 12,
          background: (state === "translating" || state === "generating-sign-sequence")
            ? "#1e3a5f" : "#1e293b",
          color: "#93c5fd",
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            border: "2px solid #60a5fa",
            borderTopColor: "transparent",
            animation: (state === "translating" || state === "generating-sign-sequence")
              ? "spin 0.6s linear infinite" : "none",
          }} />
          <span>
            {state === "translating" && "Translating..."}
            {state === "generating-sign-sequence" && "Generating sign sequence..."}
            {state === "animating" && "Playing sign animation..."}
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Input row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as "en" | "tl");
            setError(null);
          }}
          className="input"
          style={{ width: 100, padding: "6px 8px", fontSize: 13 }}
          aria-label="Language"
          disabled={pipelineStatus === "running"}
        >
          <option value="en">English</option>
          <option value="tl">Tagalog</option>
        </select>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (state === "error") setState("typing");
              else if (state === "idle" && e.target.value.trim()) setState("typing");
              else if (state === "typing" && !e.target.value.trim()) setState("idle");
            }}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            className="input"
            style={{ width: "100%", padding: "8px 12px", fontSize: 14 }}
            disabled={pipelineStatus === "running"}
          />
        </div>
        <button
          onClick={handleTranslate}
          className="button button-primary"
          style={{ padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap" }}
          disabled={!canTranslate}
        >
          {pipelineStatus === "running" ? "..." : "Translate"}
        </button>
        {inputText && (
          <button
            onClick={handleClear}
            className="button button-secondary"
            style={{ padding: "8px 12px", fontSize: 13 }}
            title="Clear"
          >
            ×
          </button>
        )}
      </div>

      {/* Speech controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={handleAutoSpeakToggle}
            style={{ accentColor: "#3b82f6" }}
          />
          Auto Speak
        </label>
        {voices.length > 0 && (
          <select
            value={selectedVoice ?? ""}
            onChange={(e) => handleVoiceChange(e.target.value || "")}
            style={{ padding: "4px 6px", fontSize: 11, maxWidth: 160 }}
            className="input"
            aria-label="Voice"
          >
            <option value="">Default voice</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8" }}>
          Speed:
          <input
            type="range"
            min={0.25}
            max={2.0}
            step={0.25}
            value={speechRate}
            onChange={(e) => handleRateChange(parseFloat(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={{ minWidth: 32 }}>{speechRate.toFixed(2)}×</span>
        </label>
        <button
          onClick={handleSpeakNow}
          className="button button-secondary"
          style={{ padding: "4px 10px", fontSize: 11 }}
          disabled={!inputText.trim() && !translationResult.translatedText}
        >
          Speak
        </button>
      </div>

      {/* Error state */}
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

      {/* Empty state */}
      {state === "idle" && !error && (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "#64748b" }}>
          <p style={{ fontSize: 14 }}>Enter text above and click Translate to see sign language animation</p>
          <p style={{ fontSize: 12, marginTop: 8, color: "#475569" }}>
            Example: I need help please → I NEED HELP PLEASE
          </p>
        </div>
      )}

      {/* Display toggles */}
      {(state === "animating" || state === "completed") && pipelineResult && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={showGlossToggle} onChange={() => setShowGlossToggle((p) => !p)} style={{ accentColor: "#3b82f6" }} />
            Show Gloss
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={showGestureLabels} onChange={() => setShowGestureLabels((p) => !p)} style={{ accentColor: "#3b82f6" }} />
            Show Gesture Labels
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={showQueuePanel} onChange={() => setShowQueuePanel((p) => !p)} style={{ accentColor: "#3b82f6" }} />
            Show Queue
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={showConfidence} onChange={() => setShowConfidence((p) => !p)} style={{ accentColor: "#3b82f6" }} />
            Show Confidence
          </label>
        </div>
      )}

      {/* Main content — shown when we have a result */}
      {(state === "translating" || state === "generating-sign-sequence" || state === "animating" || state === "completed") && pipelineResult && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {/* Animation panel */}
          <div style={{ flex: "0 0 auto" }}>
            {loadingClips ? (
              <div style={{ width: 320, height: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", borderRadius: 8 }}>
                <p style={{ color: "#64748b", fontSize: 13 }}>Loading animations...</p>
              </div>
            ) : (
              <SignAnimationPlayer
                key={animationKey}
                clips={clips}
                width={320}
                height={400}
                speed={1}
                onGestureChange={handleGestureChange}
                onComplete={handleComplete}
              />
            )}
          </div>

          {/* Info panel */}
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Original text */}
            <div style={{ padding: "12px", background: "#1e293b", borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Original</p>
              <p style={{ fontSize: 14, color: "#e2e8f0" }}>{`\u201C${pipelineResult.input}\u201D`}</p>
            </div>

            {/* Detected language (from FSL engine) */}
            {fslResult && (
              <div style={{ padding: "12px", background: "#1e293b", borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Detected Language</p>
                <p style={{ fontSize: 14, color: "#fbbf24", fontWeight: 600 }}>
                  {fslResult.detectedLanguage.language.toUpperCase()}
                  <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 12 }}>
                    ({(fslResult.detectedLanguage.confidence * 100).toFixed(0)}% confidence)
                  </span>
                </p>
              </div>
            )}

            {/* Gloss translation */}
            {showGlossToggle && (
              <div style={{ padding: "12px", background: "#1e293b", borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>FSL Gloss</p>
                <p style={{ fontSize: 16, color: "#60a5fa", fontWeight: 600 }}>
                  {translationResult.translatedText}
                </p>
              </div>
            )}

            {/* Animation queue */}
            {showQueuePanel && (
              <div style={{ padding: "12px", background: "#1e293b", borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                  Animation Queue
                  {queueTotal > 0 && (
                    <span style={{ marginLeft: 8, color: "#64748b" }}>
                      ({currentQueueIndex + 1}/{queueTotal})
                    </span>
                  )}
                </p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {glossDisplay.map((item, i) => {
                    const fslWord = fslResult?.glossSequence[i];
                    const strategy = fslWord?.resolution.strategy ?? "direct";
                    const colorMap: Record<string, string> = {
                      direct: "#3b82f6",
                      synonym: "#f59e0b",
                      related: "#ef4444",
                      fingerspelling: "#8b5cf6",
                    };
                    return (
                      <span
                        key={i}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: 12,
                          background: i === currentQueueIndex
                            ? "#3b82f6"
                            : i < currentQueueIndex
                              ? "#1e3a5f"
                              : strategy === "direct"
                                ? "#1e3a5f"
                                : strategy === "synonym"
                                  ? "#422006"
                                  : strategy === "related"
                                    ? "#451a1a"
                                    : "#1e1b4b",
                          color: i === currentQueueIndex
                            ? "#fff"
                            : i < currentQueueIndex
                              ? "#6b8cbe"
                              : colorMap[strategy] ?? "#9ca3af",
                          transition: "all 0.3s",
                          opacity: i < currentQueueIndex ? 0.6 : 1,
                          cursor: showGestureLabels ? "default" : undefined,
                        }}
                        title={showGestureLabels ? `${item.gloss} (${strategy})` : undefined}
                      >
                        {showGestureLabels ? item.gloss : item.gloss.length > 3 ? item.gloss.slice(0, 3) + "..." : item.gloss}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confidence indicator */}
            {showConfidence && confidence && (
              <div style={{ padding: "12px", background: "#1e293b", borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Translation Confidence</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: "#0f172a",
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${confidence.overall * 100}%`,
                      height: "100%",
                      borderRadius: 4,
                      background: confidence.overall >= 0.9 ? "#22c55e"
                        : confidence.overall >= 0.7 ? "#eab308"
                        : confidence.overall >= 0.5 ? "#f97316" : "#ef4444",
                      transition: "width 0.5s",
                    }} />
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 600, minWidth: 40,
                    color: confidence.overall >= 0.9 ? "#bbf7d0"
                      : confidence.overall >= 0.7 ? "#fde68a"
                      : confidence.overall >= 0.5 ? "#fed7aa" : "#fca5a5",
                  }}>
                    {(confidence.overall * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                  {confidence.lowConfidenceCount > 0 && (
                    <span style={{ color: "#f97316" }}>Low: {confidence.lowConfidenceCount}</span>
                  )}
                  {confidence.fingerspelledCount > 0 && (
                    <span style={{ color: "#8b5cf6" }}>Fingerspelled: {confidence.fingerspelledCount}</span>
                  )}
                  {confidence.unresolvedCount > 0 && (
                    <span style={{ color: "#ef4444" }}>Unresolved: {confidence.unresolvedCount}</span>
                  )}
                  {confidence.lowConfidenceCount === 0 && confidence.unresolvedCount === 0 && (
                    <span style={{ color: "#22c55e" }}>All words recognized</span>
                  )}
                </div>
              </div>
            )}

            {/* Current gesture */}
            {showGestureLabels && (
              <div style={{ padding: "12px", background: "#1e293b", borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Current Gesture</p>
                <p style={{ fontSize: 18, color: "#fbbf24", fontWeight: 700 }}>
                  {currentGesture || "—"}
                </p>
              </div>
            )}

            {/* Success state */}
            {state === "completed" && (
              <div style={{
                padding: "10px 14px", background: "#14532d", border: "1px solid #22c55e",
                borderRadius: 8, color: "#bbf7d0", fontSize: 12, textAlign: "center",
              }}>
                Translation complete
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
