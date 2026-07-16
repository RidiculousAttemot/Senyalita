"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
// @ts-expect-error - .jsx file, no TS declaration
import AppNav from '@/components/shared/AppNav';
import { globalPipeline } from '@/features/translation-pipeline';
import { AnimationLoader } from '@/features/sign-animation/loader';
import { SignAnimationPlayer } from '@/features/sign-animation/player/SignAnimationPlayer';
import type { AnimationClip, AvatarTheme } from '@/features/sign-animation/types';
import styles from './TypeToSignExperience.module.css';

const supportedChars = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','Ñ','NG','O','P','Q','R','S','T','U','V','W','X','Y','Z',
];

const avatarStyles: { name: string; gradient: string; theme: AvatarTheme }[] = [
  { name: 'Warm',     gradient: 'linear-gradient(135deg,#C4855A,#E8B89A)', theme: 'minimal' },
  { name: 'Midnight', gradient: 'linear-gradient(135deg,#2A2035,#4A3560)', theme: 'skeleton' },
  { name: 'Ocean',    gradient: 'linear-gradient(135deg,#7EC8E3,#C8EAF5)', theme: 'flat' },
  { name: 'Ember',    gradient: 'linear-gradient(135deg,#E8A878,#F5D5B8)', theme: 'avatar2d' },
];

const quickPhrases = ['ABC', 'FSL', 'Ñ', 'NG'];

export default function TypeToSignExperience() {
  const [message, setMessage] = useState('');
  const [translated, setTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState('Warm');
  const [avatarMode, setAvatarMode] = useState('human');
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 320, height: 340 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentGestureIndex, setCurrentGestureIndex] = useState(0);
  const [totalClips, setTotalClips] = useState(0);
  const audioRef = useRef<SpeechSynthesis | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const totalClipsRef = useRef(0);

  useEffect(() => {
    audioRef.current = typeof window !== 'undefined' ? (window.speechSynthesis ?? null) : null;
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

  const translateSign = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTranslated(false);
    setClips([]);

    try {
      const pipelineResult = globalPipeline.translate(trimmed);
      const glossKeys = pipelineResult.animationPlan.items
        .filter((item) => !item.fallbackUsed)
        .map((item) => item.animationKey);

      const uniqueKeys = [...new Set(glossKeys)].filter(Boolean);

      const loader = new AnimationLoader();
      const loadedClips = [];

      const assetMap = new Map<string, any>();
      for (const key of uniqueKeys) {
        const asset = await loader.load(key);
        if (asset) {
          assetMap.set(key, asset);
        }
      }

      for (const item of pipelineResult.animationPlan.items) {
        if (item.fallbackUsed) continue;
        const asset = assetMap.get(item.animationKey);
        if (asset) {
          loadedClips.push({
            id: `anim-${item.animationKey}-${loadedClips.length}-${Date.now()}`,
            gesture: item.gloss,
            asset,
          });
        }
      }

      setClips(loadedClips);
      setAnimationKey((prev) => prev + 1);
      setTranslated(true);

      const unknownCount = pipelineResult.unknownGlosses.length;
      fetch('/api/text-to-sign/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_text: trimmed,
          translated_gloss: pipelineResult.glossSequence.map((g) => g.gloss).join(' '),
          processing_time_ms: pipelineResult.totalProcessingTimeMs,
          unknown_token_count: unknownCount,
          model_version: 'pipeline_v2',
        }),
      }).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const speakText = useCallback(() => {
    if (!message.trim()) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(message);
    synth.speak(utterance);
  }, [message]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        translateSign();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [translateSign]);

  const handleGestureChange = useCallback((gesture: string, current: number, total: number) => {
    setCurrentGesture(gesture);
    setIsPlaying(true);
    setIsPaused(false);
    setCurrentGestureIndex(current);
    setTotalClips(total);
    totalClipsRef.current = total;
  }, []);

  const handleComplete = useCallback(() => {
    setCurrentGesture(null);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentGestureIndex(totalClipsRef.current);
  }, []);

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

  const progressPercent = totalClips > 0
    ? Math.min(100, (currentGestureIndex / totalClips) * 100)
    : 0;

  const selectedTheme = avatarStyles.find((a) => a.name === selectedAvatar)?.theme ?? 'minimal';

  return (
    <div className={styles.page}>
      <AppNav activePage="type-to-sign" />
      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.card}>
            <p className={styles.sectionLabel}>Your message</p>
            <textarea
              className={styles.textarea}
              placeholder="Type letters or text to sign in FSL..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className={styles.controls}>
              <button className={styles.translateBtn} onClick={translateSign} disabled={loading}>
                {loading ? 'Translating\u2026' : 'Translate to Sign'}
              </button>
              <button className={styles.speakBtn} onClick={speakText}>
                🎤 Speak
              </button>
              <span className={styles.langBadge}>FSL — Filipino Sign Language</span>
              <span className={styles.hint}>Ctrl+Enter to submit</span>
            </div>

            <div className={styles.chips}>
              {quickPhrases.map((phrase) => (
                <button
                  key={phrase}
                  className={styles.chip}
                  onClick={() => setMessage(phrase)}
                >
                  {phrase}
                </button>
              ))}
            </div>

            <div className={styles.previewSection}>
              <p className={styles.previewLabel}>Sign animation</p>
              <div className={styles.previewBox}>
                {!translated && !loading && !error ? (
                  <div className={styles.previewEmptyState}>
                    <div className={styles.previewIconWrap}>
                      <svg viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                    </div>
                    <p className={styles.previewTitle}>Sign preview</p>
                    <p className={styles.previewSub}>
                      Type a message and press Translate to see the avatar sign it.
                    </p>
                  </div>
                ) : loading ? (
                  <p className={styles.signingText}>Loading animations…</p>
                ) : error ? (
                  <p className={styles.signingText} style={{ color: '#ef4444' }}>{error}</p>
                ) : clips.length > 0 ? (
                  <div className={styles.previewBoxPlayerWrap} ref={previewRef}>
                    <SignAnimationPlayer
                      ref={playerRef}
                      key={animationKey}
                      clips={clips}
                      width={previewSize.width}
                      height={previewSize.height}
                      speed={1}
                      theme={selectedTheme}
                      showControls={false}
                      backgroundColor="#f5f0eb"
                      onGestureChange={handleGestureChange}
                      onComplete={handleComplete}
                    />
                  </div>
                ) : (
                  <p className={styles.signingText}>No animations found for &ldquo;{message}&rdquo;</p>
                )}
              </div>
            </div>

            {translated && (
              <div className={styles.playbackControls}>
                <button className={styles.playBtn} onClick={handleReplay} title="Restart">↺</button>
                <button className={styles.playBtn} onClick={handlePausePlay} disabled={!isPlaying && !isPaused} title={isPaused ? 'Play' : 'Pause'}>
                  {isPaused ? '▶' : '⏸'}
                </button>
                <button className={styles.playBtn} onClick={handleStop} disabled={!isPlaying && !isPaused} title="Stop">⏹</button>
                <div className={styles.progressTrack}>
                  <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
                </div>
                <span className={styles.progressLabel}>
                  {isPlaying || isPaused ? `${Math.min(currentGestureIndex + 1, totalClips)}/${totalClips}` : `${currentGestureIndex}/${totalClips}`}
                </span>
              </div>
            )}

            <div className={styles.avatarSection}>
              <p className={styles.sectionLabel}>Avatar Mode</p>
              <div className={styles.avatarModeGrid}>
                <div
                  className={`${styles.avatarModeCard} ${avatarMode === 'human' ? styles.avatarModeCardActive : ''}`}
                  onClick={() => setAvatarMode('human')}
                >
                  <span className={styles.avatarModeIcon}>🧑</span>
                  <span className={styles.avatarModeLabel}>Human</span>
                </div>
                <div className={`${styles.avatarModeCard} ${styles.avatarModeCardDisabled}`}>
                  <span className={styles.avatarModeIcon}>🦴</span>
                  <span className={styles.avatarModeLabel}>Skeleton</span>
                  <span className={styles.comingSoonBadge}>Coming soon</span>
                </div>
              </div>
            </div>

            <div className={styles.avatarSection}>
              <p className={styles.sectionLabel}>Avatar Style</p>
              <div className={styles.avatarGrid}>
                {avatarStyles.map((av) => (
                  <div
                    key={av.name}
                    className={`${styles.avatarCard} ${selectedAvatar === av.name ? styles.avatarCardActive : ''}`}
                    onClick={() => setSelectedAvatar(av.name)}
                  >
                    <div className={styles.swatch} style={{ background: av.gradient }} />
                    <div className={styles.avatarName}>{av.name}</div>
                  </div>
                ))}
              </div>
            </div>
            </div>
        </main>

        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h3>For hearing partners</h3>
            <p>
              Type or speak what you want to say, then choose an avatar style
              below the animation preview. This tool translates English text into
              Filipino Sign Language (FSL) signs in real time.
            </p>
          </div>

          <div className={styles.sideCard}>
            <span className={styles.charLabel}>SUPPORTED CHARACTERS</span>
            <div className={styles.charSection}>
              <h4>LETTERS</h4>
              <div className={styles.charGrid}>
                {supportedChars.map((ch) => (
                  <span key={ch} className={styles.charBadge}>{ch}</span>
                ))}
              </div>
            </div>
            <p className={styles.sideNote}>
              Letters and common FSL vocabulary are fingerspelled by the sign animation engine.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
