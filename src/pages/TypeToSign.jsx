import { useState, useEffect, useCallback } from 'react';
import AppNav from '../components/shared/AppNav';
import styles from './TypeToSign.module.css';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const numbers = '0123456789'.split('');

const avatarStyles = [
  { name: 'Warm',     gradient: 'linear-gradient(135deg,#C4855A,#E8B89A)' },
  { name: 'Midnight', gradient: 'linear-gradient(135deg,#2A2035,#4A3560)' },
  { name: 'Ocean',    gradient: 'linear-gradient(135deg,#7EC8E3,#C8EAF5)' },
  { name: 'Ember',    gradient: 'linear-gradient(135deg,#E8A878,#F5D5B8)' },
];

const quickPhrases = [
  'Hello, how are you?',
  'Thank you',
  'I need help please',
  'Nice to meet you',
];

export default function TypeToSign() {
  const [message, setMessage] = useState('');
  const [translated, setTranslated] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('Warm');
  const [language, setLanguage] = useState('🇺🇸 American Sign Language');

  const translateSign = useCallback(() => {
    if (message.trim()) {
      setTranslated(true);
    }
  }, [message]);

  const speakText = useCallback(() => {
    if (!message.trim()) return;
    const utterance = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(utterance);
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

  return (
    <div className={styles.page}>
      <AppNav activePage="type-to-sign" />
      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.card}>
            {/* Message Input */}
            <p className={styles.sectionLabel}>Your message</p>
            <textarea
              className={styles.textarea}
              placeholder="Type what you want to say in English…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            {/* Controls */}
            <div className={styles.controls}>
              <button className={styles.translateBtn} onClick={translateSign}>
                Translate to Sign
              </button>

              <select
                className={styles.langSelect}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>🇺🇸 American Sign Language</option>
                <option>🇵🇭 Filipino Sign Language</option>
                <option>🇬🇧 British Sign Language</option>
              </select>

              <button className={styles.speakBtn} onClick={speakText}>
                🎤 Speak
              </button>

              <span className={styles.hint}>Ctrl+Enter to submit</span>
            </div>

            {/* Quick Phrase Chips */}
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

            {/* Sign Animation Preview */}
            <div className={styles.previewSection}>
              <p className={styles.previewLabel}>Sign animation</p>
              <div className={styles.previewBox}>
                {!translated ? (
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
                ) : (
                  <p className={styles.signingText}>
                    Signing: &ldquo;{message}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Avatar Style */}
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
