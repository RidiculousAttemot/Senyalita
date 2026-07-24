"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Settings, Loader2, Volume2, Info, SpellCheck } from "lucide-react";
import { globalPipeline } from '@/features/translation-pipeline';
import { AnimationLoader } from '@/features/sign-animation/loader';
import { SignAnimationPlayer } from '@/features/sign-animation/player/SignAnimationPlayer';
import { FingerspellingEngine } from '@/features/sign-animation/player/FingerspellingEngine';
import type { AnimationClip, AvatarTheme } from '@/features/sign-animation/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const avatarStyles: { name: string; gradient: string; theme: AvatarTheme }[] = [
    { name: 'Warm',     gradient: 'linear-gradient(135deg,#C4855A,#E8B89A)', theme: 'minimal' },
    { name: 'Midnight', gradient: 'linear-gradient(135deg,#2A2035,#4A3560)', theme: 'skeleton' },
    { name: 'Ocean',    gradient: 'linear-gradient(135deg,#7EC8E3,#C8EAF5)', theme: 'flat' },
    { name: 'Ember',    gradient: 'linear-gradient(135deg,#E8A878,#F5D5B8)', theme: 'avatar2d' },
];

const quickPhrases = ['Kamusta ka?', 'Salamat', 'Paalam', 'Mahal kita'];

export function TypeToSignInterface() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 500, height: 500 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentGestureIndex, setCurrentGestureIndex] = useState(0);
  const [selectedAvatarTheme, setSelectedAvatarTheme] = useState<AvatarTheme>('minimal');
  const [fallbackWords, setFallbackWords] = useState<string[]>([]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const fingerspellingEngineRef = useRef(new FingerspellingEngine());

  const handleGestureChange = useCallback((g: string, index: number) => {
    setCurrentGesture(g);
    setCurrentGestureIndex(index);
  }, []);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setPreviewSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleTranslate = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setClips([]);
    setIsPlaying(false);
    setIsPaused(false);
    setFallbackWords([]);

    try {
      const pipelineResult = globalPipeline.translate(trimmed);
      const glossKeys = pipelineResult.animationPlan.items
        .filter((item) => !item.fallbackUsed)
        .map((item) => item.animationKey);

      const uniqueKeys = [...new Set(glossKeys)].filter(Boolean);

      const loader = new AnimationLoader();
      const loadedClips: AnimationClip[] = [];
      const fallbackUsed: string[] = [];

      const assetMap = new Map<string, any>();
      for (const key of uniqueKeys) {
        const asset = await loader.load(key);
        if (asset) {
          assetMap.set(key, asset);
        }
      }

      const fsEngine = fingerspellingEngineRef.current;

      for (let i = 0; i < pipelineResult.animationPlan.items.length; i++) {
        const item = pipelineResult.animationPlan.items[i];
        if (item.fallbackUsed) {
          if (fsEngine.isFingerspellable(item.gloss)) {
            const fsAsset = fsEngine.generateFingerspellingAsset(item.gloss);
            loadedClips.push({
              id: `fs-${item.gloss}-${i}-${Date.now()}`,
              gesture: item.gloss,
              asset: fsAsset,
            });
            fallbackUsed.push(item.gloss);
          }
          continue;
        }
        const asset = assetMap.get(item.animationKey);
        if (asset) {
          loadedClips.push({
            id: `anim-${item.animationKey}-${i}-${Date.now()}`,
            gesture: item.gloss,
            asset,
          });
        } else {
          if (fsEngine.isFingerspellable(item.gloss)) {
            const fsAsset = fsEngine.generateFingerspellingAsset(item.gloss);
            loadedClips.push({
              id: `fs-${item.gloss}-${i}-${Date.now()}`,
              gesture: item.gloss,
              asset: fsAsset,
            });
            fallbackUsed.push(item.gloss);
          }
        }
      }

      setClips(loadedClips);
      setFallbackWords(fallbackUsed);
      if (fallbackUsed.length > 0) {
        setError(`Resolved by Fingerspelling: ${fallbackUsed.join(", ")}`);
      }
      setAnimationKey((prev) => prev + 1);
      if (loadedClips.length > 0) {
        setIsPlaying(true);
      }
    } catch (e) {
      setError("An unexpected error occurred during translation.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [message]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPaused(true);
    } else {
      playerRef.current?.play();
      setIsPaused(false);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    playerRef.current?.reset();
    setIsPlaying(true);
    setIsPaused(false);
  };
  
  const handleSpeak = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis && message) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'tl-PH';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 max-w-[1160px] mx-auto">
      {/* Left Panel: Input & Controls */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#fffdfa] shadow-[0_10px_28px_rgba(69,45,28,0.08)]">
        <Card className="rounded-b-none border-0 bg-transparent shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 font-display text-base font-semibold">Your message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Type what you want to say in English or Tagalog..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="resize-none h-[100px] min-h-[100px] text-base bg-white border-stone-200 focus-visible:ring-1 focus-visible:ring-stone-400 placeholder:text-stone-400 focus-visible:ring-offset-0 rounded-xl px-4 py-3"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={handleTranslate} 
                disabled={loading || !message.trim()} 
                className="bg-[#d88567] hover:bg-[#bc6d53] text-white rounded-lg px-5 py-2.5 h-auto text-sm font-medium shadow-none transition-colors border-0"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Translate to Sign
              </Button>
              
              <div className="px-4 py-2 border border-stone-200 rounded-lg bg-white text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-gray-500">ph</span> Filipino Sign Language
              </div>

              <Button 
                variant="outline"
                onClick={handleSpeak}
                disabled={!message}
                className="rounded-lg px-4 py-2 h-auto text-sm font-medium border-stone-200 text-stone-600 hover:bg-stone-50 bg-white shadow-none"
              >
                <Volume2 className="h-4 w-4 mr-2" /> Speak
              </Button>

              <span className="text-xs text-stone-400 font-medium ml-auto hidden md:inline-block">Ctrl+Enter to submit</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
                {quickPhrases.map(phrase => (
                    <button 
                      key={phrase} 
                      className="px-3 py-1.5 rounded-full border border-stone-200 bg-white text-sm text-stone-600 hover:border-[#d88567] hover:text-[#a85e48] transition-colors"
                      onClick={() => setMessage(phrase)}
                    >
                        {phrase}
                    </button>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Animation Preview Container */}
        <Card className="rounded-t-none border-x-0 border-b-0 border-t border-stone-200 bg-transparent shadow-none flex-grow">
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-gray-900 font-display text-base font-semibold">Sign animation</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div ref={previewRef} className="relative h-[400px] md:h-[470px] w-full bg-transparent rounded-xl flex items-center justify-center dashed-border-pattern">
              {clips.length > 0 ? (
                <div className="absolute inset-0 bg-white/50 rounded-xl overflow-hidden border border-stone-200/60 shadow-inner">
                  <SignAnimationPlayer
                    key={animationKey}
                    ref={playerRef}
                    clips={clips}
                    width={previewSize.width}
                    height={previewSize.height}
                    theme={selectedAvatarTheme}
                    onGestureChange={handleGestureChange}
                  />
                  
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400 px-6 text-center border-2 border-dashed border-stone-300/60 rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-[#f3e5e1] flex items-center justify-center mb-6 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A59A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-gray-800 mb-2">Sign preview</h3>
                  <p className="max-w-[280px] leading-relaxed text-[15px]">Type a message and press Translate to see the avatar sign it.</p>
                </div>
              )}
            </div>

            {clips.length > 0 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button aria-label="Replay animation" onClick={handleReset} className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:border-[#d88567] hover:text-[#a85e48] transition-colors">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button aria-label={isPlaying && !isPaused ? "Pause animation" : "Play animation"} onClick={handlePlayPause} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d88567] text-white shadow-sm hover:bg-[#bc6d53] transition-colors">
                  {isPlaying && !isPaused ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <span className="min-w-[96px] text-center text-xs font-medium text-stone-500">
                  {currentGesture || "..."} · {currentGestureIndex + 1}/{clips.length}
                  {fallbackWords.length > 0 && <span className="ml-1 text-amber-500">(FS)</span>}
                </span>
              </div>
            )}
            
            {/* Avatar Style Selector underneath */}
            <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3">
              <h4 className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase mb-3 px-1">Avatar Style</h4>
              <div className="grid grid-cols-4 gap-3">
                {avatarStyles.map(style => (
                  <button 
                    key={style.name}
                    onClick={() => setSelectedAvatarTheme(style.theme)}
                    className={`flex flex-col rounded-xl border p-2 transition-all group overflow-hidden ${
                      selectedAvatarTheme === style.theme 
                      ? 'border-[#d88567] bg-[#fff3ee] ring-1 ring-[#d88567]/30' 
                      : 'border-stone-200 bg-white hover:border-[#d88567]/50 hover:bg-stone-50'
                    }`}
                  >
                    <div className="h-10 w-full rounded-md mb-2 opacity-80 group-hover:opacity-100 transition-opacity relative" style={{ background: style.gradient }}>
                        {selectedAvatarTheme === style.theme && (
                            <div className="absolute inset-0 ring-2 ring-white/50 rounded-md ring-inset pointer-events-none" />
                        )}
                    </div>
                    <span className={`text-xs font-semibold text-center w-full ${
                      selectedAvatarTheme === style.theme ? 'text-[#a85e48]' : 'text-stone-500'
                    }`}>
                      {style.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar */}
      <div className="flex flex-col gap-4">
        <Card className="rounded-2xl bg-white border-stone-200 shadow-[0_8px_20px_rgba(69,45,28,0.06)]">
          <CardContent className="p-6">
            <h3 className="font-display text-gray-900 font-bold mb-3 text-lg">For hearing partners</h3>
            <p className="text-[15px] text-stone-500 leading-relaxed">
              Type or speak what you want to say, then translate it into a clear FSL animation. The signing preview runs locally in your browser.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-white border-stone-200 shadow-[0_8px_20px_rgba(69,45,28,0.06)]">
          <CardContent className="p-6">
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-stone-400 uppercase mb-5">Supported Characters</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase mb-3">Letters</h4>
                <div className="flex flex-wrap gap-1.5">
                  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                    <span key={letter} className="w-6 h-6 flex items-center justify-center bg-[#fdf5f3] text-[#a26859] rounded text-xs font-bold font-mono">
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase mb-3">Numbers</h4>
                <div className="flex flex-wrap gap-1.5">
                  {'0123456789'.split('').map(num => (
                    <span key={num} className="w-6 h-6 flex items-center justify-center bg-[#f4f6f8] text-stone-600 rounded text-xs font-bold font-mono">
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[13px] text-stone-400 mt-6 leading-relaxed">
              The visual animator supports all standard characters and common expressions.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl bg-white border-stone-200 shadow-[0_8px_20px_rgba(69,45,28,0.06)]">
          <CardContent className="p-5">
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-stone-400 uppercase mb-3">Translation status</h3>
            <p className="text-sm leading-5 text-stone-500">
              {loading ? "Preparing your FSL sign sequence..." : error ? error : clips.length > 0 ? `${clips.length} sign${clips.length === 1 ? "" : "s"} ready.` : "Enter a message to generate a signing preview."}
            </p>
            {fallbackWords.length > 0 && (
              <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <SpellCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800">
                  <span className="font-semibold">Fallback: Alphabet Fingerspelling</span>
                  <p className="mt-1 text-amber-700">
                    {fallbackWords.join(", ")} — will be fingerspelled letter by letter.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
