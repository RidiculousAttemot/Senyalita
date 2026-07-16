"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Circle, Clock3, Save, Trash2, Video } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CaptureState = "idle" | "countdown" | "recording" | "saved" | "error";

export default function AdminDatasetCapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [gestureLabel, setGestureLabel] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [recentCaptures, setRecentCaptures] = useState<Array<{ label: string; video_url: string }>>([]);
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

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch {
      setStatusMessage("Camera access denied.");
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [startCamera]);

  const startRecording = () => {
    if (!stream || !gestureLabel.trim()) return;
    setCaptureState("countdown");
    setCountdown(3);
    setRecordedBlob(null);
    setPreviewUrl(null);

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
    <div className="admin-capture-workspace">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-overline">Recognition data</p>
          <h1>Dataset capture</h1>
          <p className="admin-dashboard-subtitle">
            Record labelled gesture samples for model improvement. Every submission enters review before it can join the training dataset.
          </p>
        </div>
      </header>

      <section className="admin-capture-facts" aria-label="Capture workflow facts">
        <div><Clock3 size={16} aria-hidden="true" /><span><strong>4 seconds</strong><small>Recording window</small></span></div>
        <div><Circle size={16} aria-hidden="true" /><span><strong>Review required</strong><small>Samples remain pending until approved</small></span></div>
        <div><Video size={16} aria-hidden="true" /><span><strong>WebM output</strong><small>Stored in the gesture video library</small></span></div>
      </section>

      <div className="admin-capture-grid">
        <section className="admin-panel admin-capture-camera-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-overline">Live camera</p>
              <h2>Record a labelled sample</h2>
            </div>
            <span className={`admin-status ${stream ? "admin-status-healthy" : "admin-status-unknown"}`}>
              <span className="admin-status-dot" aria-hidden="true" />
              {stream ? "Camera ready" : "Waiting for camera"}
            </span>
          </div>

          <div className="admin-capture-video-wrap">
            <video ref={videoRef} className="admin-capture-video" playsInline muted />
            {captureState === "countdown" && (
              <div className="admin-capture-countdown" aria-live="polite">{countdown}</div>
            )}
            {captureState === "recording" && (
              <span className="admin-capture-recording"><span aria-hidden="true" />REC</span>
            )}
          </div>

          {previewUrl && (
            <div className="admin-capture-preview">
              <video src={previewUrl} controls />
            </div>
          )}

          <div className="admin-capture-controls">
            <label className="admin-capture-label" htmlFor="gesture-label">Gesture label</label>
            <div className="admin-capture-input-row">
              <input
                id="gesture-label"
                type="text"
                value={gestureLabel}
                onChange={(event) => setGestureLabel(event.target.value.toUpperCase())}
                placeholder="Gesture label (e.g. HELLO)"
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
              <button className="admin-capture-button admin-capture-button-primary" disabled={!gestureLabel.trim() || !stream} onClick={startRecording}>
                <Camera size={16} aria-hidden="true" />Record
              </button>
            )}
            {captureState === "recording" && (
              <button className="admin-capture-button" onClick={stopRecording}>
                <Circle size={16} aria-hidden="true" />Stop
              </button>
            )}
            {captureState === "saved" && (
              <button className="admin-capture-button admin-capture-button-primary" disabled={isSubmitting} onClick={saveRecording}>
                <Save size={16} aria-hidden="true" />{isSubmitting ? "Saving..." : "Save"}
              </button>
            )}
            {captureState === "saved" && (
              <button className="admin-capture-button" onClick={() => { setCaptureState("idle"); setRecordedBlob(null); setPreviewUrl(null); }}>
                <Trash2 size={16} aria-hidden="true" />Discard
              </button>
            )}
            </div>
          </div>

          {statusMessage && (
            <p className={`admin-capture-status ${statusMessage.startsWith("Error") ? "is-error" : "is-success"}`} role="status">
              {statusMessage}
            </p>
          )}
        </section>

        <aside className="admin-panel admin-capture-recent-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-overline">Queue</p>
              <h2>Recent captures</h2>
            </div>
            <span className="admin-period-tag">Latest 10</span>
          </div>
          {recentCaptures.length === 0 ? (
            <p className="admin-empty-state">No captures yet.</p>
          ) : (
            <div className="admin-capture-recent-list">
            {recentCaptures.map((capture, index) => (
              <article key={`${capture.label}-${index}`}>
                <p>{capture.label}</p>
                {capture.video_url && (
                  <video src={capture.video_url} controls />
                )}
              </article>
            ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
