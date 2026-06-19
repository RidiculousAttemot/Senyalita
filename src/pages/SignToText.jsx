import { useState, useRef, useCallback } from 'react';
import AppNav from '../components/shared/AppNav';
import styles from './SignToText.module.css';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const numbers = '0123456789'.split('');

export default function SignToText() {
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [outputText, setOutputText] = useState('');
  const [speakOn, setSpeakOn] = useState(true);
  const videoRef = useRef(null);

  const toggleCamera = useCallback(async () => {
    if (cameraActive) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setStream(null);
      setCameraActive(false);
    } else {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access denied:', err);
      }
    }
  }, [cameraActive, stream]);

  const addSpace = () => setOutputText((prev) => prev + ' ');
  const backspace = () => setOutputText((prev) => prev.slice(0, -1));
  const clearOutput = () => setOutputText('');
  const speakNow = useCallback(() => {
    if (!outputText.trim()) return;
    const utterance = new SpeechSynthesisUtterance(outputText);
    window.speechSynthesis.speak(utterance);
  }, [outputText]);
  const toggleSpeak = () => setSpeakOn((prev) => !prev);

  return (
    <div className={styles.page}>
      <AppNav
        activePage="sign-to-text"
        showCameraBtn={true}
        cameraActive={cameraActive}
        onCameraToggle={toggleCamera}
      />
      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.card}>
            {/* Camera Section */}
            <div className={styles.cameraBox}>
              {!cameraActive ? (
                <>
                  <div className={styles.cameraPlaceholderIcon}>
                    <svg viewBox="0 0 24 24">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <p className={styles.cameraPlaceholderText}>
                    Start the camera, then sign{' '}
                    <em>letters (A–Z) or numbers (0–9)</em>
                    — hold each sign steady.
                  </p>
                  <p className={styles.cameraPlaceholderSub}>
                    Hand and face tracking run locally on your device.
                  </p>
                </>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={styles.video}
                />
              )}
            </div>

            {/* Recognised Characters */}
            <div className={styles.recogBar}>
              <div className={styles.recogTop}>
                <span className={styles.recogLabel}>RECOGNISED CHARACTERS</span>
                <div className={styles.recogActions}>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                    onClick={toggleSpeak}
                  >
                    {speakOn ? '🔊 Speak: on' : '🔇 Speak: off'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={speakNow}
                  >
                    Speak now
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${styles.actionBtnBold}`}
                    onClick={addSpace}
                  >
                    [Space]
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={backspace}
                  >
                    Backspace
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={clearOutput}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className={styles.outputArea}>
                {!outputText ? (
                  <p className={styles.outputPlaceholder}>
                    Sign characters (A–Z, 0–9) to type words here…
                    Use [Space] to separate.
                  </p>
                ) : (
                  <p className={styles.outputText}>{outputText}</p>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h3>🧏 For Deaf signers</h3>
            <p>
              Fingerspell words using letters A to Z and numbers 0 to 9.
              Hold each sign about 1.0 second. Use the [Space] button on the
              controls to insert spaces between words.
            </p>
          </div>

          <div className={styles.warnCard}>
            <div className={styles.warnHeader}>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className={styles.warnTitle}>Select Sign Language</span>
            </div>
            <p>
              You can change your communicating sign language via the dropdown
              inside the camera view overlay. Local hand recognition maps
              gestures to standard alphabets and digits.
            </p>
          </div>

          <div className={styles.sideCard}>
            <h3>📝 Live transcript</h3>
            <div className={styles.transcriptBox}>
              {!outputText ? (
                <p className={styles.transcriptPlaceholder}>
                  Spelled characters and numbers will appear here…
                </p>
              ) : (
                <p className={styles.transcriptText}>{outputText}</p>
              )}
            </div>
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
              Fingerspell in good lighting with hands centered
              in the camera frame.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
