"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import AppNav from '../components/shared/AppNav';
import { runPipeline } from '@/features/text-to-sign/pipeline';
import { AnimationLoader } from '@/features/sign-animation/loader';
import { SignAnimationPlayer } from '@/features/sign-animation/player/SignAnimationPlayer';
import { computeTranslationConfidence, getConfidenceColor } from '@/features/text-to-sign/confidenceIndicator';
import styles from './TypeToSign.module.css';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const numbers = '0123456789'.split('');

const avatarStyles = [
  { name: 'Warm',     gradient: 'linear-gradient(135deg,#C4855A,#E8B89A)', theme: 'minimal' },
  { name: 'Midnight', gradient: 'linear-gradient(135deg,#2A2035,#4A3560)', theme: 'skeleton' },
  { name: 'Ocean',    gradient: 'linear-gradient(135deg,#7EC8E3,#C8EAF5)', theme: 'flat' },
  { name: 'Ember',    gradient: 'linear-gradient(135deg,#E8A878,#F5D5B8)', theme: 'avatar2d' },
];

const quickPhrases = [
  'Hello, how are you?',
  'Thank you',
  'I need help please',
  'Nice to meet you',
  'Good morning',
  'I love you',
];

export default function TypeToSign() {
  const [message, setMessage] = useState('');
  const [translated, setTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState('Warm');
  const [clips, setClips] = useState([]);
  const [glossText, setGlossText] = useState('');
  const [confidence, setConfidence] = useState(null);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentGesture, setCurrentGesture] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = typeof window !== 'undefined' ? window.speechSynthesis : null;
  }, []);

  const translateSign = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTranslated(false);
    setClips([]);
    setConfidence(null);

    try {
      const result = runPipeline(trimmed);
      setPipelineResult(result);

      const glossArr = result.gloss.glossSequence.map((g) => g.gloss);
      setGlossText(glossArr.join(' '));

      const conf = computeTranslationConfidence(result.gloss.glossSequence, result.sequence);
      setConfidence(conf);

      const loader = new AnimationLoader();
      const loadedClips = [];
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
      setTranslated(true);

      const unknownCount = result.gloss.glossSequence.filter(
        (g) => g.strategy === 'fingerspelling'
      ).length;
      fetch('/api/text-to-sign/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_text: trimmed,
          translated_gloss: glossArr.join(' '),
          confidence_score: conf,
          processing_time_ms: result.gloss.processingTimeMs,
          unknown_token_count: unknownCount,
          model_version: 'bilstm_v2',
        }),
      }).catch(() => {});
    } catch (e) {
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
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        translateSign();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [translateSign]);

  const handleGestureChange = useCallback((gesture, current, total) => {
    setCurrentGesture(gesture);
  }, []);

  const handleComplete = useCallback(() => {
    setCurrentGesture(null);
  }, []);

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
              placeholder="Type what you want to say in English…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className={styles.controls}>
              <button className={styles.translateBtn} onClick={translateSign} disabled={loading}>
                {loading ? 'Translating…' : 'Translate to Sign'}
              </button>
              <button className={styles.speakBtn} onClick={speakText}>
                🎤 Speak
              </button>
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
                  <>
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
                  </>
                ) : loading ? (
                  <p className={styles.signingText}>Loading animations…</p>
                ) : error ? (
                  <p className={styles.signingText} style={{ color: '#ef4444' }}>{error}</p>
                ) : clips.length > 0 ? (
                  <SignAnimationPlayer
                    key={animationKey}
                    clips={clips}
                    width={320}
                    height={340}
                    speed={1}
                    theme={selectedTheme}
                    showControls={true}
                    onGestureChange={handleGestureChange}
                    onComplete={handleComplete}
                  />
                ) : (
                  <p className={styles.signingText}>No animations found for &#34;{message}&#34;</p>
                )}
              </div>
            </div>

            {/* Gloss & Confidence */}
            {translated && confidence && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>FSL Gloss:</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#60a5fa' }}>{glossText}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Confidence:</span>
                  <div style={{ flex: 1, maxWidth: 200, height: 8, background: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${confidence.overall * 100}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: getConfidenceColor(confidence.overall),
                      transition: 'width 0.5s',
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: getConfidenceColor(confidence.overall) }}>
                    {(confidence.overall * 100).toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                    ({confidence.lowConfidenceCount} low, {confidence.fingerspelledCount} fingerspelled)
                  </span>
                </div>
              </div>
            )}

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
              Type or speak what you want to say. Choose your avatar style
              and signed language below the animation. The pose engine is
              open-source — same pipeline as sign.mt.
            </p>
          </div>

          <div className={styles.sideCard}>
            <span className={styles.charLabel}>SUPPORTED CHARACTERS</span>
            <div className={styles.charSection}>
              <h4>LETTERS</h4>
              <div className={styles.charGrid}>
                {letters.map((ch) => (
                  <span key={ch} className={styles.charBadge}>{ch}</span>
                ))}
              </div>
            </div>
            <div className={styles.charSection}>
              <h4>NUMBERS</h4>
              <div className={styles.charGrid}>
                {numbers.map((ch) => (
                  <span key={ch} className={styles.charBadge}>{ch}</span>
                ))}
              </div>
            </div>
            <p className={styles.sideNote}>
              The visual animator supports all standard characters
              and common expressions.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
