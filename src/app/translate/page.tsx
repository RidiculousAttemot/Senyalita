"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRecognition, translateLabel } from "@/features/recognition";
import { getTts } from "@/lib/tts";
import { TextToSignInterface } from "@/features/text-to-sign/TextToSignInterface";
import styles from "./Translate.module.css";

const DEBUG = true;

type Status = "waiting" | "active" | "no-hand" | "error";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const numbers = "0123456789".split("");

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
];

export default function TranslatePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>("waiting");
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [translatedText, setTranslatedText] = useState("");
  const handLandmarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const ttsRef = useRef<ReturnType<typeof getTts> | null>(null);
  const lastLeftRef = useRef<any>(null);
  const lastRightRef = useRef<any>(null);
  const lastQueriedLabelRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<"camera" | "text">("camera");

  // Sign → Text state
  const [outputText, setOutputText] = useState("");
  const [speakOn, setSpeakOn] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("fsl_speak_on") !== "false";
    } catch { return true; }
  });
  const outputTextRef = useRef(outputText);
  outputTextRef.current = outputText;
  const lastAppendedRef = useRef<string | null>(null);
  const appendCooldownRef = useRef(0);

  const onPrediction = useCallback(async (result: any, inferenceTimeMs: number) => {
    if (DEBUG) console.log(`[PIPELINE:onPrediction] label="${result?.label}" conf=${result?.confidence?.toFixed(3)}`);
    if (!result?.label) return;
    setCurrentLabel(result.label);
    setCurrentConfidence(result.confidence);
    setTranslatedText(translateLabel(result.label));

    if (result.label !== lastQueriedLabelRef.current) {
      lastQueriedLabelRef.current = result.label;
    }
  }, []);

  const recognition = useRecognition(onPrediction);
  const recognitionRef = useRef(recognition);
  recognitionRef.current = recognition;

  // Auto-append when frozenPrediction changes (stable ~1s hold, confidence >= 0.6)
  useEffect(() => {
    const fp = recognition.frozenPrediction;
    if (!fp) return;
    const display = translateLabel(fp.label);
    if (display.length !== 1) return;
    if (display === lastAppendedRef.current) return;
    const now = Date.now();
    if (now - appendCooldownRef.current < 800) return;
    if (DEBUG) console.log(`[PIPELINE:AutoAppend] frozen="${fp.label}" → "${display}"`);
    lastAppendedRef.current = display;
    appendCooldownRef.current = now;
    setOutputText((prev) => prev + display);
  }, [recognition.frozenPrediction]);

  useEffect(() => {
    ttsRef.current = getTts();
    const appendFrame = recognitionRef.current.appendFrame;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("active");

        const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        handLandmarkerRef.current = handLandmarker;

        const drawLandmarks = (landmarks: Array<{x: number; y: number; z: number}>, color: string) => {
          const canvas = landmarkCanvasRef.current;
          if (!canvas || !videoRef.current) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const w = canvas.width;
          const h = canvas.height;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          for (const [i, j] of HAND_CONNECTIONS) {
            const a = landmarks[i];
            const b = landmarks[j];
            if (a && b) {
              ctx.beginPath();
              ctx.moveTo(a.x * w, a.y * h);
              ctx.lineTo(b.x * w, b.y * h);
              ctx.stroke();
            }
          }

          ctx.fillStyle = color;
          for (const p of landmarks) {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        };

        const processFrame = () => {
          try {
            const video = videoRef.current;
            const canvas = landmarkCanvasRef.current;
            if (video && canvas) {
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
            }
            if (video && handLandmarkerRef.current) {
              const timestamp = performance.now();
              const results = handLandmarkerRef.current.detectForVideo(
                video,
                timestamp
              );
                if (DEBUG) console.log(`[PIPELINE:Camera] Frame - hands=${results.landmarks?.length ?? 0}`);

                const ctx = canvas?.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, canvas!.width, canvas!.height);

                if (results.landmarks && results.landmarks.length > 0) {
                  const numHands = results.landmarks.length;
                  const leftIdx = results.handedness?.findIndex(
                    (h: any) => h[0]?.categoryName === "Left"
                  );
                  const rightIdx = results.handedness?.findIndex(
                    (h: any) => h[0]?.categoryName === "Right"
                  );

                  const left = typeof leftIdx === "number" && leftIdx >= 0 && leftIdx < numHands
                    ? { landmarks: results.landmarks[leftIdx] }
                    : null;
                  const right = typeof rightIdx === "number" && rightIdx >= 0 && rightIdx < numHands
                    ? { landmarks: results.landmarks[rightIdx] }
                    : null;

                  if (DEBUG) {
                    console.log(`[HANDS] leftIdx=${leftIdx} rightIdx=${rightIdx} numHands=${numHands}`);
                    console.log(`[HANDS] left=${left ? "filled" : "null"} right=${right ? "filled" : "null"}`);
                  }

                  if (left && typeof leftIdx === "number" && leftIdx >= 0 && leftIdx < numHands) {
                    drawLandmarks(results.landmarks[leftIdx], "#C0593A");
                  }
                  if (right && typeof rightIdx === "number" && rightIdx >= 0 && rightIdx < numHands) {
                    drawLandmarks(results.landmarks[rightIdx], "#60A5FA");
                  }

                  lastLeftRef.current = left;
                  lastRightRef.current = right;
                  appendFrame(left, right);
                  setStatus("active");
              } else {
                setStatus("no-hand");
              }
            }
          } catch (err) {
            console.warn("[PIPELINE:processFrame] Error in frame loop:", err);
          }
          animationFrameRef.current = requestAnimationFrame(processFrame);
        };
        processFrame();
      } catch (e) {
        console.error("Camera initialization failed:", e);
        setStatus("error");
      }
    };
    if (activeTab === "camera") {
      startCamera();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
      try {
        handLandmarkerRef.current?.close();
      } catch {}
    };
  }, [activeTab]);

  const addSpace = () => setOutputText((prev) => prev + " ");
  const backspace = () => setOutputText((prev) => prev.slice(0, -1));
  const clearOutput = () => setOutputText("");
  const lastSpokenRef = useRef("");

  useEffect(() => {
    if (!speakOn || !outputText.trim()) return;
    if (outputText === lastSpokenRef.current) return;
    lastSpokenRef.current = outputText;
    ttsRef.current?.speak(outputText);
  }, [outputText, speakOn]);

  const speakNow = useCallback(() => {
    if (!outputText.trim()) return;
    ttsRef.current?.speak(outputText);
  }, [outputText]);

  const toggleSpeak = () => {
    setSpeakOn((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("fsl_speak_on", next ? "true" : "false");
        } catch {}
      }
      return next;
    });
  };

  return (
    <div className={styles.page}>
      {/* Top Nav */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.backBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <Link href="/" className={styles.brand}>SIGNWITHUS</Link>
        </div>

        <div className={styles.navCenter}>
          <button
            className={`${styles.navTab} ${activeTab === "text" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("text")}
          >
            Type → Sign
          </button>
          <button
            className={`${styles.navTab} ${activeTab === "camera" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("camera")}
          >
            Sign → Text
          </button>
        </div>

        <div className={styles.navRight}>
          {activeTab === "camera" && status === "active" && (
            <button className={styles.stopCameraBtn}>Stop camera</button>
          )}
        </div>
      </nav>

      {/* Two-column layout */}
      <div className={styles.layout}>
        {/* Main panel */}
        <div className={styles.main}>
          {activeTab === "camera" ? (
            <>
              {/* Camera viewport */}
              <div className={styles.cameraBox}>
                <video
                  ref={videoRef}
                  className={styles.cameraVideo}
                  playsInline
                  muted
                />
                <canvas
                  ref={landmarkCanvasRef}
                  className={styles.landmarkCanvas}
                />
                {status === "waiting" && (
                  <div className={styles.cameraPlaceholder}>
                    <div className={styles.cameraPlaceholderIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <p className={styles.cameraPlaceholderText}>
                      Start the camera, then sign{" "}
                      <em>letters (A–Z)</em>
                      {" "}— hold each sign steady.
                    </p>
                    <p className={styles.cameraPlaceholderSub}>
                      Hand and face tracking run locally on your device.
                    </p>
                  </div>
                )}
                {status === "no-hand" && (
                  <div className={styles.overlay}>No hands detected. Position your hands in frame.</div>
                )}
                {status === "error" && (
                  <div className={styles.overlay}>Camera access denied. Please grant camera permission.</div>
                )}
              </div>

              {/* Detected sign info */}
              {currentLabel && (
                <div className={styles.sideCard}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "0.8rem", color: "#9C9189", margin: "0 0 4px" }}>Detected Sign</p>
                    <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#1C1A17", margin: "0 0 8px" }}>
                      {currentLabel}
                    </h2>
                    <div style={{ height: 6, background: "#E8E0D8", borderRadius: 3, marginBottom: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${currentConfidence * 100}%`, background: "#C0593A", borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "#9C9189", margin: "0 0 8px" }}>
                      Confidence: {(currentConfidence * 100).toFixed(0)}%
                    </p>
                    <p style={{ fontSize: "1.1rem", color: "#C0593A", fontStyle: "italic", margin: 0 }}>
                      &ldquo;{translatedText}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* Recognised Characters bar */}
              <div className={styles.recogBar}>
                <div className={styles.recogTop}>
                  <span className={styles.recogLabel}>RECOGNISED CHARACTERS</span>
                  <div className={styles.recogActions}>
                    <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={toggleSpeak}>
                      {speakOn ? "🔊 Speak: on" : "🔇 Speak: off"}
                    </button>
                    <button className={styles.actionBtn} onClick={speakNow}>Speak now</button>
                    <button className={`${styles.actionBtn} ${styles.actionBtnPrimary} ${styles.actionBtnBold}`} onClick={addSpace}>
                      [Space]
                    </button>
                    <button className={styles.actionBtn} onClick={backspace}>Backspace</button>
                    <button className={styles.actionBtn} onClick={clearOutput}>Clear</button>
                  </div>
                </div>
                <div className={styles.outputArea}>
                  {!outputText ? (
                    <p className={styles.outputPlaceholder}>
                      Sign letters (A–Z) to type words here… Use [Space] to separate.
                    </p>
                  ) : (
                    <p className={styles.outputText}>{outputText}</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <TextToSignInterface />
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {activeTab === "camera" ? (
            <>
              <div className={styles.sideCard}>
                <h3>🧏 For Deaf signers</h3>
                <p>
                  Fingerspell words using letters A to Z.
                  Hold each sign about 1.0 second. Use the [Space] button on the
                  controls to insert spaces between words.
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
                  Fingerspell in good lighting with hands centered in the camera frame.
                </p>
              </div>
            </>
          ) : (
            <>
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
                  The visual animator supports all standard characters and common expressions.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
