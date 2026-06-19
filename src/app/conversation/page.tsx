"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { UserSidebar } from "@/components/UserSidebar";
import { useRecognition } from "@/features/recognition";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getTts } from "@/lib/tts";
import { fetchAiReplies, getRuleBasedReplies } from "@/lib/ai-replies";
import { ConversationAssistant } from "@/features/assistant";
import { GestureRecommendations } from "@/components/conversation/GestureRecommendations";
import { generateSummary, formatSummary } from "@/features/conversation/conversationSummary";

type ConversationMessage = {
  id: string;
  sender_type: "signer" | "responder";
  translated_text: string;
  confidence: number | null;
  gesture_label: string | null;
  created_at: string;
};

type ReplyWithVideo = {
  text: string;
  response_video_url: string | null;
};

const COOLDOWN_MS = 2000;
const CONFIDENCE_THRESHOLD = 0.7;

function ConversationPageContent() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isProcessingRef = useRef(false);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState("initializing");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [currentTopK, setCurrentTopK] = useState<Array<{ label: string; confidence: number }>>([]);
  const [contextReplies, setContextReplies] = useState<ReplyWithVideo[]>([]);
  const lastAppendRef = useRef(0);
  const assistantRef = useRef<ConversationAssistant | null>(null);
  const [communicationScore, setCommunicationScore] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const [customReply, setCustomReply] = useState("");
  const [showVideoModal, setShowVideoModal] = useState<string | null>(null);
  const [guidedMode, setGuidedMode] = useState(false);
  const [lockedPrediction, setLockedPrediction] = useState<string | null>(null);
  const [motionActive, setMotionActive] = useState(false);
  const [textSize, setTextSize] = useState<"normal" | "large" | "extra-large">("normal");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [langTagalog, setLangTagalog] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [frequentReplies, setFrequentReplies] = useState<string[]>([]);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("fsl_frequent_replies");
    if (stored) setFrequentReplies(JSON.parse(stored));
  }, []);

  const submitCorrection = async (correctedLabel: string) => {
    try {
      await fetch("/api/predictions/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predicted_label: currentGesture,
          corrected_label: correctedLabel,
          confidence: currentConfidence,
          source: "unknown",
        }),
      });
      setCorrectionMessage("Thanks for the feedback!");
      setShowCorrection(false);
      setTimeout(() => setCorrectionMessage(""), 3000);
    } catch {
      setCorrectionMessage("Failed to submit. Try again.");
    }
  };

  const saveFrequentReply = useCallback((text: string) => {
    setFrequentReplies((prev) => {
      const next = [text, ...prev.filter((r) => r !== text)].slice(0, 5);
      localStorage.setItem("fsl_frequent_replies", JSON.stringify(next));
      return next;
    });
  }, []);

  const onPrediction = useCallback((result: any) => {
    const label = result.label;
    const confidence = result.confidence;
    setCurrentGesture(label);
    setCurrentConfidence(confidence);
    if (result.topK) setCurrentTopK(result.topK);
  }, []);

  const {
    state: recognitionState,
    appendFrame,
    bufferLength,
    bufferCap,
    minimumFrames,
    frozenPrediction,
    mode,
    setMode,
  } = useRecognition(onPrediction);

  // Initialize ConversationAssistant
  useEffect(() => {
    if (!assistantRef.current) {
      assistantRef.current = new ConversationAssistant({ language: langTagalog ? "tl" : "en" });
      sessionStartRef.current = Date.now();
    }
  }, [langTagalog]);

  useEffect(() => {
    const init = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from("conversation_sessions")
        .insert({ user_id: userData.user.id, status: "active" })
        .select()
        .single();

      if (!error && data) {
        setSessionId(data.id);
        const { data: msgs } = await supabase
          .from("conversation_messages")
          .select("*")
          .eq("session_id", data.id)
          .order("created_at", { ascending: true });
        if (msgs) setMessages(msgs);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!sessionId || !currentGesture || currentConfidence < CONFIDENCE_THRESHOLD) return;
    if (guidedMode && lockedPrediction === currentGesture) return;
    const now = Date.now();
    if (now - lastAppendRef.current < COOLDOWN_MS) return;
    lastAppendRef.current = now;

    const supabase = createSupabaseBrowserClient();
    supabase
      .from("conversation_messages")
      .insert({
        session_id: sessionId,
        sender_type: "signer",
        gesture_label: currentGesture,
        translated_text: currentGesture,
        confidence: currentConfidence,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setMessages((prev) => [...prev, data]);
          assistantRef.current?.recordGesture(currentGesture, currentGesture, currentConfidence);
          setCommunicationScore(assistantRef.current?.getQualityScore().overallScore ?? 0);
          if (ttsEnabled) getTts().speak(currentGesture.replace(/_/g, " "), { lang: langTagalog ? "fil-PH" : "en-US" });
          fetchContextReplies(currentGesture);
          if (guidedMode) setLockedPrediction(currentGesture);
        }
      });
  }, [currentGesture, currentConfidence, sessionId, guidedMode, lockedPrediction, ttsEnabled, langTagalog]);

  const fetchContextReplies = async (gesture: string) => {
    // Try AI-generated replies first (with conversation context)
    const history = messages.slice(-6).map((m) => ({
      sender: m.sender_type,
      text: m.translated_text,
    }));
    const aiResult = await fetchAiReplies({
      gesture: gesture.toUpperCase(),
      conversationHistory: history,
      language: langTagalog ? "tl" : "en",
    });
    if (aiResult.model !== "rule-based" && aiResult.model !== "rule-based-fallback" && aiResult.replies.length >= 3) {
      setContextReplies(aiResult.replies.map((text) => ({ text, response_video_url: null })));
      return;
    }

    // Fallback: DB context replies
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("gesture_reply_relationships")
      .select("suggested_reply, response_video_url")
      .eq("gesture_label", gesture.toUpperCase())
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .limit(5);
    if (data && data.length > 0) {
      setContextReplies(data.map((r) => ({ text: r.suggested_reply, response_video_url: r.response_video_url ?? null })));
    } else {
      // Fallback: rule-based + gesture_replies table
      const ruleReplies = getRuleBasedReplies(gesture, langTagalog ? "tl" : "en").slice(0, 3).map((text) => ({ text, response_video_url: null as string | null }));
      const { data: generic } = await supabase
        .from("gesture_replies")
        .select("reply_text, gesture_id")
        .in(
          "gesture_id",
          (
            await supabase
              .from("gestures")
              .select("id")
              .eq("label", gesture.toUpperCase())
          ).data?.map((g) => g.id) ?? []
        )
        .eq("is_active", true)
        .limit(3);
      const dbReplies = (generic ?? []).map((r) => ({ text: r.reply_text, response_video_url: null as string | null }));
      setContextReplies([...ruleReplies, ...dbReplies].slice(0, 5));
    }
  };

  const sendReply = async (text: string) => {
    if (!sessionId) return;
    saveFrequentReply(text);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("conversation_messages")
      .insert({
        session_id: sessionId,
        sender_type: "responder",
        translated_text: text,
        confidence: null,
      })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setContextReplies([]);
      if (ttsEnabled) getTts().speak(text, { lang: langTagalog ? "fil-PH" : "en-US" });
      if (guidedMode) { setLockedPrediction(null); setCurrentGesture(null); }
    }
  };

  const endSession = async (success?: boolean) => {
    if (!sessionId) return;
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("conversation_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString(), communication_success: success ?? null })
      .eq("id", sessionId);
    if (success != null) {
      assistantRef.current?.recordConversation(success);
    }
  };

  const exportConversation = () => {
    const lines = messages.map(
      (m) => `[${m.sender_type === "signer" ? (langTagalog ? "Bingi" : "Signer") : langTagalog ? "Tagatugon" : "Responder"}] ${m.translated_text}`
    );
    const text = `Conversation #${sessionId?.slice(0, 8)}\n${new Date().toLocaleString()}\n${"-".repeat(30)}\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${sessionId?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetGuidedLock = () => {
    setLockedPrediction(null);
    setMotionActive(false);
  };

  useEffect(() => {
    if (!guidedMode) { setLockedPrediction(null); return; }
    if (currentGesture && currentConfidence >= CONFIDENCE_THRESHOLD) setMotionActive(true);
    else setMotionActive(false);
  }, [currentGesture, currentConfidence, guidedMode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let hands: any = null;
    let camera: any = null;
    let cancelled = false;

    const setup = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const [{ Hands, HAND_CONNECTIONS }, drawingUtils, cameraUtils] = await Promise.all([
          import("@mediapipe/hands"),
          import("@mediapipe/drawing_utils"),
          import("@mediapipe/camera_utils"),
        ]);

        hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results: any) => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          const videoEl = videoRef.current;
          if (!canvas || !ctx || !videoEl) return;
          const width = videoEl.videoWidth;
          const height = videoEl.videoHeight;
          if (!width || !height) return;
          if (!lastSizeRef.current || lastSizeRef.current.width !== width || lastSizeRef.current.height !== height) {
            canvas.width = width;
            canvas.height = height;
            lastSizeRef.current = { width, height };
          }
          ctx.save();
          ctx.clearRect(0, 0, width, height);
          const landmarksList = results.multiHandLandmarks ?? [];
          const handednessList = results.multiHandedness ?? [];

          let leftHand: any = null;
          let rightHand: any = null;
          for (let i = 0; i < landmarksList.length; i++) {
            const handedness = handednessList[i]?.label ?? "";
            const landmarks = landmarksList[i].map((p: any) => ({ x: p.x, y: p.y, z: p.z }));
            if (handedness.toLowerCase().includes("left")) leftHand = { landmarks };
            else rightHand = { landmarks };
            drawingUtils.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#22c55e", lineWidth: 3 });
            drawingUtils.drawLandmarks(ctx, landmarks, { color: "#ef4444", lineWidth: 2 });
          }
          if (landmarksList.length > 0) appendFrame(leftHand, rightHand);
          ctx.restore();
        });

        camera = new cameraUtils.Camera(video, {
          onFrame: async () => {
            const currentVideo = videoRef.current;
            if (!hands || !currentVideo || isProcessingRef.current) return;
            isProcessingRef.current = true;
            try { await hands.send({ image: currentVideo }); } finally { isProcessingRef.current = false; }
          },
          width: 640,
          height: 480,
        });
        camera?.start?.();
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };

    setup();
    return () => {
      cancelled = true;
      isProcessingRef.current = false;
      camera?.stop?.();
      hands?.close?.();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [appendFrame]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "g" || e.key === "G") setGuidedMode((g) => !g);
      if (e.key === "t" || e.key === "T") setTtsEnabled((t) => !t);
      if (e.key === "e" || e.key === "E") exportConversation();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textClass = textSize === "extra-large" ? "text-xxl" : textSize === "large" ? "text-xl" : "text-md";

  return (
    <main className="page">
      <style>{`
        .text-md { font-size: 16px; }
        .text-xl { font-size: 20px; }
        .text-xxl { font-size: 28px; }
        .conv-layout { display: grid; grid-template-columns: 360px 1fr 300px; gap: 16px; height: calc(100vh - 120px); min-height: 500px; }
        .conv-panel { display: flex; flex-direction: column; overflow: hidden; }
        .conv-panel-right { overflow-y: auto; }
        .conv-messages { flex: 1; overflow-y: auto; padding: 12px 0; }
        .conv-msg { margin-bottom: 12px; padding: 12px; border-radius: 8px; border-left: 3px solid; }
        .conv-msg.signer { background: rgba(34, 197, 94, 0.08); border-color: #22c55e; }
        .conv-msg.responder { background: rgba(59, 130, 246, 0.08); border-color: #3b82f6; }
        .conv-meta { font-size: 11px; color: #888; margin-bottom: 2px; }
        .reply-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 20px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); cursor: pointer; font-size: 14px; transition: all 0.15s; }
        .reply-chip:hover { background: rgba(59, 130, 246, 0.2); }
        .video-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .video-modal video { max-width: 90vw; max-height: 80vh; border-radius: 12px; }
        .guided-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
        .guided-badge.on { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
        .guided-badge.off { background: rgba(100, 100, 100, 0.15); color: #888; }
        .text-size-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid #444; background: transparent; cursor: pointer; font-size: 12px; }
        .text-size-btn.active { background: rgba(59, 130, 246, 0.2); border-color: #3b82f6; }
        .video-btn { background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); padding: 4px 10px; border-radius: 16px; font-size: 12px; cursor: pointer; }
        .video-btn:hover { background: rgba(139, 92, 246, 0.2); }
      `}</style>

      <div className="camera-header">
        <h1>Conversation</h1>
        <span className={`status status-${status === "ready" ? "hand-2" : "waiting"}`}>
          {status === "ready" ? "Session active" : status}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`guided-badge ${guidedMode ? "on" : "off"}`}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: guidedMode ? "#22c55e" : "#888" }} />
            Guided {guidedMode ? "ON" : "OFF"}
          </span>
          <button className="button button-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setGuidedMode((g) => !g)}>
            Toggle Guided
          </button>
          <button className={`text-size-btn ${textSize === "normal" ? "active" : ""}`} onClick={() => setTextSize("normal")}>A</button>
          <button className={`text-size-btn ${textSize === "large" ? "active" : ""}`} onClick={() => setTextSize("large")}>A+</button>
          <button className={`text-size-btn ${textSize === "extra-large" ? "active" : ""}`} onClick={() => setTextSize("extra-large")}>A++</button>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
            TTS
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={langTagalog} onChange={(e) => setLangTagalog(e.target.checked)} />
            Tagalog
          </label>
          <button className="button button-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={exportConversation}>
            Export TXT
          </button>
          <button className="button button-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => endSession(true)}>
            End
          </button>
        </div>
      </div>

      <div className="conv-layout">
        {/* Left Panel: Camera */}
        <div className="conv-panel">
          <div className="video-wrap" style={{ height: 280 }}>
            <video ref={videoRef} className="video" playsInline muted />
            <canvas ref={canvasRef} className="overlay" />
          </div>
          <div className="panel" style={{ flex: 1, marginTop: 8, padding: 12, overflowY: "auto" }}>
            <p className={textClass} style={{ fontWeight: 600 }}>
              {currentGesture ?? (langTagalog ? "Walang nakitang senyas" : "No sign detected")}
            </p>
            {currentGesture && (
              <p style={{ fontSize: 13, color: currentConfidence >= CONFIDENCE_THRESHOLD ? "#22c55e" : "#eab308" }}>
                {(currentConfidence * 100).toFixed(1)}%
                {guidedMode && lockedPrediction === currentGesture ? " \u2014 locked" : currentConfidence >= CONFIDENCE_THRESHOLD ? " \u2014 auto" : " \u2014 low"}
              </p>
            )}
            {currentGesture && (
              <div style={{ marginTop: 6 }}>
                {!showCorrection ? (
                  <button
                    className="button button-secondary"
                    style={{ fontSize: 10, padding: "2px 8px" }}
                    onClick={() => setShowCorrection(true)}
                  >
                    {langTagalog ? "Mali?" : "Incorrect?"}
                  </button>
                ) : (
                  <div style={{ fontSize: 11 }}>
                    <p style={{ color: "#888", marginBottom: 4 }}>
                      {langTagalog ? "Ano ang ibig mong sabihin?" : "What did you mean?"}
                    </p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(currentTopK.length > 0 ? currentTopK.map((t) => t.label) : ["HELLO", "THANK YOU", "YES", "NO", "PLEASE", "SORRY"]).map((label) => (
                        <button
                          key={label}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 10,
                            border: "1px solid #444",
                            background: "transparent",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                          onClick={() => submitCorrection(label)}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          border: "1px solid #ef4444",
                          background: "transparent",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                        onClick={() => setShowCorrection(false)}
                      >
                        {langTagalog ? "Kanselahin" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}
                {correctionMessage && (
                  <p style={{ fontSize: 10, color: "#22c55e", marginTop: 2 }}>{correctionMessage}</p>
                )}
              </div>
            )}

            {guidedMode && motionActive && (
              <p style={{ fontSize: 12, color: "#3b82f6", marginTop: 4 }}>
                {langTagalog ? "Natutukoy ang senyas..." : "Gesture detected..."}
              </p>
            )}
            {guidedMode && lockedPrediction && (
              <button className="button button-secondary" style={{ marginTop: 8, fontSize: 12, padding: "4px 10px" }} onClick={resetGuidedLock}>
                {langTagalog ? "I-reset" : "Reset"}
              </button>
            )}
            {currentGesture && currentConfidence < 0.7 && currentConfidence > 0.3 && (
              <GestureRecommendations
                lowConfidenceLabel={currentGesture}
                topK={currentTopK}
                onSelect={(label) => {
                  setCurrentGesture(label);
                  setCurrentConfidence(0.8);
                }}
              />
            )}
            <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
              {langTagalog ? "Tagapagsalita: Bingi" : "Current speaker: Deaf/HoH"}
            </p>
          </div>
        </div>

        {/* Center Panel: Transcript */}
        <div className="conv-panel" ref={panelRef}>
          <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="conv-messages">
              {messages.length === 0 ? (
                <p style={{ textAlign: "center", color: "#666", marginTop: 48 }}>
                  {langTagalog ? "Magsagawa ng senyas upang magsimula ng usapan" : "Perform a sign to start the conversation"}
                </p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`conv-msg ${msg.sender_type}`}>
                    <div className="conv-meta">
                      {msg.sender_type === "signer" ? (langTagalog ? "Bingi" : "Deaf User") : langTagalog ? "Tagatugon" : "Hearing User"}
                      {" \u2022 "}
                      {new Date(msg.created_at).toLocaleTimeString()}
                      {msg.confidence !== null && ` \u2022 ${(msg.confidence * 100).toFixed(0)}%`}
                    </div>
                    <div className={textClass}>{msg.translated_text}</div>
                  </div>
                ))
              )}
            </div>

            {/* Reply input area */}
            <div style={{ borderTop: "1px solid #333", padding: "12px 0", marginTop: "auto" }}>
              {contextReplies.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                    {langTagalog ? "Mga mungkahing tugon:" : "Suggested replies:"}
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {contextReplies.map((reply, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <button className="reply-chip" onClick={() => sendReply(reply.text)}>
                          {reply.text}
                        </button>
                        {reply.response_video_url && (
                          <button className="video-btn" onClick={() => setShowVideoModal(reply.response_video_url!)}>
                            ▶ FSL
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {frequentReplies.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                    {langTagalog ? "Mga madalas:" : "Frequent:"}
                  </p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {frequentReplies.map((reply, i) => (
                      <button key={i} className="reply-chip" style={{ fontSize: 12, padding: "3px 10px" }} onClick={() => sendReply(reply)}>
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={customReply}
                  onChange={(e) => setCustomReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && customReply.trim()) { sendReply(customReply.trim()); setCustomReply(""); } }}
                  placeholder={langTagalog ? "Mag-type ng tugon..." : "Type a reply..."}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #444", background: "#1a1a2e", color: "#fff", fontSize: 14 }}
                />
                <button
                  className="button"
                  disabled={!customReply.trim()}
                  onClick={() => { if (customReply.trim()) { sendReply(customReply.trim()); setCustomReply(""); } }}
                >
                  {langTagalog ? "Ipadala" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Sidebar */}
        <div className="conv-panel conv-panel-right">
          <div className="panel" style={{ marginBottom: 8, padding: 12 }}>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>
              {langTagalog ? "Impormasyon ng Sesyon" : "Session Info"}
            </h2>
            <p style={{ fontSize: 12, color: "#888" }}>ID: {sessionId?.slice(0, 8) ?? "..."}</p>
            <p style={{ fontSize: 12, color: "#888" }}>
              {langTagalog ? "Mga mensahe:" : "Messages:"} {messages.length}
            </p>
            <p style={{ fontSize: 12, color: "#888" }}>
              {langTagalog ? "Tagal:" : "Duration:"} {Math.floor((Date.now() - (messages[0] ? new Date(messages[0].created_at).getTime() : Date.now())) / 60000)}m
            </p>
            <div className="communication-score" style={{ marginTop: 8, padding: "8px 12px", background: "rgba(34, 197, 94, 0.08)", borderRadius: 8, textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#888" }}>{langTagalog ? "Kalidad ng Komunikasyon" : "Communication Score"}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: communicationScore >= 70 ? "#22c55e" : communicationScore >= 40 ? "#eab308" : "#ef4444" }}>
                {communicationScore}/100
              </p>
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>
              {langTagalog ? "Mga Shortcut" : "Shortcuts"}
            </h2>
            <div style={{ fontSize: 12, color: "#888" }}>
              <p><kbd>Enter</kbd> {langTagalog ? "Ipadala ang tugon" : "Send reply"}</p>
              <p><kbd>G</kbd> {langTagalog ? "I-toggle ang guided mode" : "Toggle guided mode"}</p>
              <p><kbd>T</kbd> {langTagalog ? "I-toggle ang TTS" : "Toggle TTS"}</p>
              <p><kbd>E</kbd> {langTagalog ? "I-export" : "Export TXT"}</p>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 8, padding: 12 }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              {langTagalog ? "Tagumpay ng Komunikasyon" : "Communication Success"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button" style={{ flex: 1, fontSize: 12 }} onClick={() => endSession(true)}>
                {langTagalog ? "Oo" : "Yes"}
              </button>
              <button className="button button-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => endSession(false)}>
                {langTagalog ? "Hindi" : "No"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="video-modal" onClick={() => setShowVideoModal(null)}>
          <video controls autoPlay src={showVideoModal} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Keyboard shortcuts handled via useEffect */}
    </main>
  );
}

export default function ConversationPage() {
  return (
    <UserSidebar>
      <ConversationPageContent />
    </UserSidebar>
  );
}
