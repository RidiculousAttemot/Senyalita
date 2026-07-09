"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CaptureState = "idle" | "countdown" | "recording" | "saved" | "error";

export default function AdminDatasetCapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [gestureLabel, setGestureLabel] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [recentCaptures, setRecentCaptures] = useState<Array<{ label: string; video_url: string }>>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load recent captures
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("gesture_captures")
      .select("label, video_url")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecentCaptures(data as Array<{ label: string; video_url: string }>);
      });
  }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch {
      setStatusMessage("Camera access denied.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = () => {
    if (!stream || !gestureLabel.trim()) return;
    setCaptureState("countdown");
    setCountdown(3);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setChunks([]);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          beginRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const beginRecording = () => {
    if (!stream) return;
    setCaptureState("recording");
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const c: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) c.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(c, { type: "video/webm" });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setCaptureState("saved");
    };

    setMediaRecorder(recorder);
    recorder.start();

    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 4000);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
  };

  const saveRecording = async () => {
    if (!recordedBlob || !gestureLabel.trim()) return;
    setIsSubmitting(true);
    setStatusMessage("Uploading...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const fileName = `capture_${Date.now()}_${gestureLabel.replace(/\s+/g, "_")}.webm`;
      const filePath = `dataset/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("gesture-videos")
        .upload(filePath, recordedBlob, { contentType: "video/webm" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("gesture-videos")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("gesture_captures").insert({
        label: gestureLabel.toUpperCase(),
        video_url: urlData?.publicUrl,
        captured_by: user.user.id,
        status: "pending_review",
      });

      if (dbError) throw dbError;

      setStatusMessage("Saved! Awaiting review.");
      setRecordedBlob(null);
      setPreviewUrl(null);
      setCaptureState("idle");

      // Refresh recent
      const { data } = await supabase
        .from("gesture_captures")
        .select("label, video_url")
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setRecentCaptures(data as Array<{ label: string; video_url: string }>);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Dataset Capture (Admin Only)</h2>
      <p className="panel-note">
        Record gesture samples for future model improvement. Each recording is 4 seconds.
        Submissions require admin review before being added to the training dataset.
      </p>

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="video-wrap" style={{ height: 360 }}>
            <video ref={videoRef} className="video" playsInline muted />
            {captureState === "countdown" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.6)",
                  fontSize: 72,
                  fontWeight: 700,
                  color: "#22c55e",
                }}
              >
                {countdown}
              </div>
            )}
            {captureState === "recording" && (
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(239,68,68,0.8)",
                  padding: "4px 12px",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
                REC
              </div>
            )}
          </div>

          {previewUrl && (
            <div className="panel" style={{ marginTop: 8, padding: 8 }}>
              <video src={previewUrl} controls style={{ width: "100%", borderRadius: 8 }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="text"
              value={gestureLabel}
              onChange={(e) => setGestureLabel(e.target.value.toUpperCase())}
              placeholder="Gesture label (e.g. HELLO)"
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "#1a1a2e",
                color: "#fff",
                fontSize: 14,
              }}
              list="gesture-suggestions"
            />
            <datalist id="gesture-suggestions">
              {["HELLO", "THANK YOU", "GOOD MORNING", "HOW ARE YOU", "YES", "NO", "HELP", "GOODBYE", "PLEASE", "SORRY"].map(
                (g) => (
                  <option key={g} value={g} />
                )
              )}
            </datalist>

            {captureState === "idle" && (
              <button className="button" disabled={!gestureLabel.trim() || !stream} onClick={startRecording}>
                Record
              </button>
            )}
            {captureState === "recording" && (
              <button className="button button-secondary" onClick={stopRecording}>
                Stop
              </button>
            )}
            {captureState === "saved" && (
              <button className="button" disabled={isSubmitting} onClick={saveRecording}>
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            )}
            {captureState === "saved" && (
              <button className="button button-secondary" onClick={() => { setCaptureState("idle"); setRecordedBlob(null); setPreviewUrl(null); }}>
                Discard
              </button>
            )}
          </div>

          {statusMessage && (
            <p className="panel-note" style={{ marginTop: 8, color: statusMessage.startsWith("Error") ? "#ef4444" : "#22c55e" }}>
              {statusMessage}
            </p>
          )}
        </div>

        <div className="panel panel-secondary" style={{ flex: 1, maxHeight: "80vh", overflowY: "auto" }}>
          <h3>Recent Captures</h3>
          {recentCaptures.length === 0 ? (
            <p className="panel-note">No captures yet.</p>
          ) : (
            recentCaptures.map((c, i) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, border: "1px solid #333", borderRadius: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</p>
                {c.video_url && (
                  <video src={c.video_url} controls style={{ width: "100%", borderRadius: 4, marginTop: 4 }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
