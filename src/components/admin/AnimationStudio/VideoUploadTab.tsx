"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Camera, Film, X, AlertCircle, Wand2, Monitor, RefreshCw, Check, Activity } from "lucide-react";
import type { VideoMetadata } from "./types";
import type { AnimationFrame, GestureAnimationAsset, LandmarkPoint } from "@/features/sign-animation/types";
import { HAND_CONNECTIONS } from "@/features/sign-animation/types";
import { drawFullPose, drawStylizedFace, drawFullHand } from "@/features/sign-animation/renderer/renderUtils";

interface VideoUploadTabProps {
  onVideoReady: (meta: VideoMetadata) => void;
}

type UploadSource = "file" | "webcam";
type RecordPhase = "idle" | "streaming" | "recording" | "done";

export function VideoUploadTab({ onVideoReady }: VideoUploadTabProps) {
  const [dragOver, setDragOver] = useState(false);
  const [source, setSource] = useState<UploadSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState("");
  const [webcamActive, setWebcamActive] = useState(false);
  const [recordPhase, setRecordPhase] = useState<RecordPhase>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordDuration, setRecordDuration] = useState(0);
  const [mirrored, setMirrored] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);

  // Holistic live overlay state
  const [holisticLoading, setHolisticLoading] = useState(false);
  const [holisticReady, setHolisticReady] = useState(false);
  const [holisticError, setHolisticError] = useState("");
  const [showSkeletonOverlay, setShowSkeletonOverlay] = useState(true);
  const [diagFrameCount, setDiagFrameCount] = useState(0);
  const [diagFps, setDiagFps] = useState(0);
  const [diagPoseDetected, setDiagPoseDetected] = useState(false);
  const [diagLeftHandDetected, setDiagLeftHandDetected] = useState(false);
  const [diagRightHandDetected, setDiagRightHandDetected] = useState(false);
  const [recordedLandmarkCount, setRecordedLandmarkCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holisticLandmarkerRef = useRef<any>(null);
  const holAnimFrameRef = useRef<number | null>(null);
  const recordedFramesRef = useRef<AnimationFrame[]>([]);
  const holFpsTimestampsRef = useRef<number[]>([]);
  const recordedAssetRef = useRef<GestureAnimationAsset | null>(null);
  const recordPhaseRef = useRef<RecordPhase>("idle");

  const MAX_DURATION = 60;
  const MAX_SIZE = 524288000;

  const stopHolistic = useCallback(() => {
    if (holAnimFrameRef.current !== null) {
      cancelAnimationFrame(holAnimFrameRef.current);
      holAnimFrameRef.current = null;
    }
    if (holisticLandmarkerRef.current) {
      try { holisticLandmarkerRef.current.close(); } catch {}
      holisticLandmarkerRef.current = null;
    }
    setHolisticReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevPoseLandmarksRef = useRef<LandmarkPoint[] | null>(null);
  const prevFaceLandmarksRef = useRef<LandmarkPoint[] | null>(null);
  const prevLeftHandRef = useRef<LandmarkPoint[] | null>(null);
  const prevRightHandRef = useRef<LandmarkPoint[] | null>(null);

  const lerpLandmarks = (current: LandmarkPoint[] | null | undefined, previous: LandmarkPoint[] | null): LandmarkPoint[] | null => {
    if (!current) return previous;
    if (!previous || current.length !== previous.length) return current;
    const t = 0.3;
    return current.map((p, i) => ({
      x: previous[i].x * (1 - t) + p.x * t,
      y: previous[i].y * (1 - t) + p.y * t,
      z: (previous[i].z ?? 0) * (1 - t) + (p.z ?? 0) * t,
    }));
  };

  const drawSkeleton = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, frame: AnimationFrame) => {
    ctx.clearRect(0, 0, w, h);

    const style = {
      bodyColor: "#94a3b8",
      jointColor: "#cbd5e1",
      faceColor: "rgba(251,191,36,0.08)",
      faceFeatureColor: "#fbbf24",
      leftHandColor: "#C0593A",
      rightHandColor: "#60A5FA",
      lineWidth: 2,
      jointRadius: 2.5,
    };

    if (frame.poseLandmarks && frame.poseLandmarks.length > 0) {
      const smoothed = lerpLandmarks(frame.poseLandmarks, prevPoseLandmarksRef.current);
      prevPoseLandmarksRef.current = frame.poseLandmarks;
      drawFullPose(ctx, smoothed ?? frame.poseLandmarks, w, h, style);
    }

    if (frame.faceLandmarks && frame.faceLandmarks.length > 0) {
      const smoothed = lerpLandmarks(frame.faceLandmarks, prevFaceLandmarksRef.current);
      prevFaceLandmarksRef.current = frame.faceLandmarks;
      drawStylizedFace(ctx, smoothed ?? frame.faceLandmarks, w, h, style);
    }

    for (const hand of frame.landmarks) {
      const color = hand.side === "left" ? style.leftHandColor : style.rightHandColor;
      let landmarks = hand.landmarks;
      if (hand.side === "left") {
        const smoothed = lerpLandmarks(hand.landmarks, prevLeftHandRef.current);
        prevLeftHandRef.current = hand.landmarks;
        if (smoothed) landmarks = smoothed;
      } else {
        const smoothed = lerpLandmarks(hand.landmarks, prevRightHandRef.current);
        prevRightHandRef.current = hand.landmarks;
        if (smoothed) landmarks = smoothed;
      }
      drawFullHand(ctx, landmarks, color, w, h, style.lineWidth, style.jointRadius);
    }
  }, []);

  const startHolisticDetection = useCallback(async () => {
    const video = webcamVideoRef.current;
    const canvas = skeletonCanvasRef.current;
    if (!video || !canvas) return;

    setHolisticLoading(true);
    try {
      const { FilesetResolver, HolisticLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );
      const landmarker = await HolisticLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
      });
      holisticLandmarkerRef.current = landmarker;
      setHolisticReady(true);
      setHolisticLoading(false);
      setHolisticError("");

      const ctx = canvas.getContext("2d")!;

      const detectLoop = (timestamp: number) => {
        if (!holisticLandmarkerRef.current || !video || video.readyState < 2) {
          holAnimFrameRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          const rect = video.getBoundingClientRect();
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
          }
        }

        const result = holisticLandmarkerRef.current.detectForVideo(video, timestamp);
        const poseLm = result.poseLandmarks?.[0] ?? [];
        const faceLm = result.faceLandmarks?.[0] ?? [];
        const leftHand = result.leftHandLandmarks?.[0] ?? [];
        const rightHand = result.rightHandLandmarks?.[0] ?? [];

        setDiagPoseDetected(poseLm.length >= 11);
        setDiagLeftHandDetected(leftHand.length >= 21);
        setDiagRightHandDetected(rightHand.length >= 21);

        // FPS tracking
        holFpsTimestampsRef.current.push(timestamp);
        const oneSecAgo = timestamp - 1000;
        holFpsTimestampsRef.current = holFpsTimestampsRef.current.filter(t => t > oneSecAgo);
        if (holFpsTimestampsRef.current.length > 1) {
          setDiagFps(holFpsTimestampsRef.current.length);
        }

        const frame: AnimationFrame = {
          timestamp,
          landmarks: [
            ...(leftHand.length >= 21 ? [{ landmarks: leftHand.map((p: any) => ({ x: p.x, y: p.y, z: p.z })), side: "left" as const }] : []),
            ...(rightHand.length >= 21 ? [{ landmarks: rightHand.map((p: any) => ({ x: p.x, y: p.y, z: p.z })), side: "right" as const }] : []),
          ],
          poseLandmarks: poseLm.map((p: any) => ({ x: p.x, y: p.y, z: p.z })),
          faceLandmarks: faceLm.map((p: any) => ({ x: p.x, y: p.y, z: p.z })),
        };

        if (recordPhaseRef.current === "recording") {
          recordedFramesRef.current.push(frame);
          setDiagFrameCount(recordedFramesRef.current.length);
        }

        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          drawSkeleton(ctx, w, h, frame);
        }

        holAnimFrameRef.current = requestAnimationFrame(detectLoop);
      };

      holAnimFrameRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      setHolisticError(err instanceof Error ? err.message : "Failed to load Holistic model");
      setHolisticLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSkeleton]);

  useEffect(() => { recordPhaseRef.current = recordPhase; }, [recordPhase]);

  // Camera diagnostics — logs video state every second while webcam is active
  useEffect(() => {
    if (source !== "webcam" || !webcamActive) return;
    const diagInterval = setInterval(() => {
      const v = webcamVideoRef.current;
      if (!v) return;
      console.log(`[Camera Diag] ${JSON.stringify({
        readyState: v.readyState,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        paused: v.paused,
        ended: v.ended,
        hasSrcObject: !!v.srcObject,
        srcObjectType: v.srcObject ? (v.srcObject as MediaStream)?.getVideoTracks?.()?.length ?? 'unknown' : 'none',
        hasHolistic: !!holisticLandmarkerRef.current,
        holisticReady: holisticReady,
        recordPhase: recordPhaseRef.current,
        framesCaptured: recordedFramesRef.current.length,
      })}`, v.srcObject ? {
        tracks: (v.srcObject as MediaStream).getVideoTracks().map((t: MediaStreamTrack) => ({
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState,
        }))
      } : 'no stream');
    }, 1000);
    return () => clearInterval(diagInterval);
  }, [source, webcamActive, holisticReady]);

  // Bind stream to video element AFTER source triggers the <video> to mount.
  // This fixes the race where the ref is null because setSource() hasn't run yet.
  useEffect(() => {
    if (source !== "webcam" || !streamRef.current) return;
    const video = webcamVideoRef.current;
    if (!video) return;

    console.log("[Webcam] Binding stream to video element");
    video.srcObject = streamRef.current;

    const startPipeline = async () => {
      try {
        if (video.readyState < 1) {
          await new Promise<void>((resolve) => { video.onloadedmetadata = () => resolve(); });
        }
        console.log("[Webcam] Metadata loaded:", { videoWidth: video.videoWidth, videoHeight: video.videoHeight });
        await video.play();
        console.log("[Webcam] Video playing");
        startHolisticDetection();
      } catch (err) {
        console.error("[Webcam] Failed to start video pipeline:", err);
      }
    };
    startPipeline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoInputs);
      if (videoInputs.length > 0) setSelectedCamera(videoInputs[0].deviceId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      stopHolistic();
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      stopWebcam();
    };
  }, [videoUrl, recordedUrl]);

  const stopWebcam = useCallback(() => {
    stopHolistic();
    if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
      webcamVideoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
    setRecordPhase("idle");
    setDiagFrameCount(0);
    setDiagFps(0);
    setDiagPoseDetected(false);
    setDiagLeftHandDetected(false);
    setDiagRightHandDetected(false);
    recordedFramesRef.current = [];
    recordedAssetRef.current = null;
    setRecordedLandmarkCount(0);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, [stopHolistic]);

  const startWebcam = useCallback(async (deviceId?: string) => {
    setError("");
    setCameraLoading(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 1280, height: 720 }
          : { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!stream || !stream.active) {
        throw new Error("Camera stream is not active");
      }
      console.log("[Webcam] Stream obtained:", {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        trackLabels: stream.getVideoTracks().map((t: MediaStreamTrack) => t.label),
      });
      streamRef.current = stream;
      setWebcamActive(true);
      setRecordPhase("streaming");
      // Set source NOW so the <video> element renders on next tick
      setSource("webcam");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera access denied or unavailable.");
    } finally {
      setCameraLoading(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    const v = webcamVideoRef.current;
    console.log("[Recording] Starting. Pre-recording video state:", {
      readyState: v?.readyState,
      videoWidth: v?.videoWidth,
      videoHeight: v?.videoHeight,
      paused: v?.paused,
      hasSrcObject: !!v?.srcObject,
      streamTracks: streamRef.current.getVideoTracks().length,
      trackStates: streamRef.current.getVideoTracks().map((t: MediaStreamTrack) => ({ enabled: t.enabled, readyState: t.readyState })),
    });
    setError("");
    setRecordPhase("recording");
    setRecordDuration(0);
    recordedFramesRef.current = [];
    setDiagFrameCount(0);
    setRecordedLandmarkCount(0);
    const chunks: BlobPart[] = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setRecordPhase("done");
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    };

    recorder.start(100);
    const v2 = webcamVideoRef.current;
    if (v2) {
      setTimeout(() => {
        console.log("[Recording] Post-recording video state (500ms after start):", {
          readyState: v2.readyState,
          videoWidth: v2.videoWidth,
          videoHeight: v2.videoHeight,
          paused: v2.paused,
          hasSrcObject: !!v2.srcObject,
          streamTracks: streamRef.current?.getVideoTracks().length,
          trackStates: streamRef.current?.getVideoTracks().map((t: MediaStreamTrack) => ({ enabled: t.enabled, readyState: t.readyState })),
        });
      }, 500);
    }
    const startTime = Date.now();
    recordTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setRecordDuration(elapsed);
      if (elapsed >= MAX_DURATION) {
        stopRecording();
      }
    }, 100);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleRecordedConfirm = useCallback(() => {
    if (!recordedBlob || !recordedUrl) return;
    const recordedFile = new File([recordedBlob], `webcam-recording-${Date.now()}.webm`, {
      type: "video/webm",
    });
    setFile(recordedFile);
    setVideoUrl(recordedUrl);
    setSource("file");

    // Generate asset from recorded landmark frames
    const frames = recordedFramesRef.current;

    stopWebcam();

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_DURATION) {
        setError(`Recording exceeds ${MAX_DURATION}-second limit (${Math.round(video.duration)}s).`);
        URL.revokeObjectURL(recordedUrl);
        setFile(null);
        setVideoUrl("");
        return;
      }

      const buildMeta = (preAsset: GestureAnimationAsset | null) => {
        const meta: VideoMetadata = {
          file: recordedFile,
          url: recordedUrl,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          fps: 30,
          fileSize: recordedBlob.size,
          preExtractedAsset: preAsset ?? undefined,
        };
        setMetadata(meta);
      };

      if (frames.length > 10) {
        import("@/features/sign-animation/processing").then((mod) => {
          const repaired = mod.repairMissingFrames(frames);
          const normalized = mod.normalizeFrameSequence(repaired, 30);
          const asset = mod.createGestureAnimationAsset({
            frames: normalized,
            fps: 30,
            label: `WEBCAM-${Date.now()}`,
            language: "FSL",
            source: "animation-studio-webcam",
          });
          recordedAssetRef.current = asset;
          setRecordedLandmarkCount(asset.frames.length);
          buildMeta(asset);
        }).catch((err) => {
          console.error("[Video] Failed to process webcam landmark frames:", err);
          buildMeta(null);
        });
      } else {
        buildMeta(null);
      }
    };
    video.onerror = () => setError("Could not read recorded video.");
    video.src = recordedUrl;
  }, [recordedBlob, recordedUrl, stopWebcam]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, []);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  }, []);

  const processFile = useCallback((f: File) => {
    setError("");
    const allowedExts = ["mp4", "mov", "webm", "avi"];
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !allowedExts.includes(ext)) {
      setError("Unsupported format. Use MP4, MOV, or WebM.");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError(`File exceeds 500 MB limit (${(f.size / 1048576).toFixed(1)} MB).`);
      return;
    }
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(95, prev + Math.random() * 10));
    }, 200);
    const url = URL.createObjectURL(f);
    setFile(f);
    setVideoUrl(url);
    setSource("file");
    analyzeVideo(f, url, () => {
      clearInterval(progressInterval);
      setUploadProgress(100);
    });
  }, []);

  const analyzeVideo = useCallback((f: File, url: string, onDone?: () => void) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > MAX_DURATION) {
        setError(`Video exceeds ${MAX_DURATION}-second limit (${Math.round(video.duration)}s).`);
        URL.revokeObjectURL(url);
        setFile(null);
        setVideoUrl("");
        onDone?.();
        return;
      }
      const meta: VideoMetadata = {
        file: f,
        url,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30,
        fileSize: f.size,
      };
      setMetadata(meta);
      onDone?.();
    };
    video.onerror = () => {
      setError("Could not read video file.");
      onDone?.();
    };
    video.src = url;
  }, []);

  const handleExtract = useCallback(() => {
    if (metadata) onVideoReady(metadata);
  }, [metadata, onVideoReady]);

  const handleReset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setFile(null);
    setVideoUrl("");
    setMetadata(null);
    setError("");
    setSource(null);
    setRecordedBlob(null);
    setRecordedUrl("");
    setRecordDuration(0);
    setUploadProgress(0);
    setRecordedLandmarkCount(0);
    recordedFramesRef.current = [];
    recordedAssetRef.current = null;
    stopWebcam();
  }, [videoUrl, recordedUrl]);

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div style={{ color: "#e2e8f0" }}>
      <style>{`
        .vupload-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          min-height: 460px;
        }
        @media (max-width: 900px) {
          .vupload-grid { grid-template-columns: 1fr; }
        }
        .vupload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 420px;
          border: 2px dashed #334155;
          border-radius: 16px;
          padding: 40px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #0f172a;
        }
        .vupload-zone:hover {
          border-color: #60a5fa;
          background: rgba(96,165,250,0.06);
        }
        .vupload-zone.drag-over {
          border-color: #60a5fa;
          background: rgba(96,165,250,0.12);
          border-style: solid;
        }
        .vupload-zone-icon {
          width: 64px;
          height: 64px;
          color: #475569;
        }
        .vupload-zone h3 {
          color: #e2e8f0;
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .vupload-zone p {
          color: #64748b;
          font-size: 13px;
          margin: 0;
        }
        .vupload-zone .vupload-formats {
          color: #475569;
          font-size: 12px;
          margin-top: 4px;
        }
        .vupload-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border: 1px solid #334155;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          background: #1e293b;
          color: #e2e8f0;
          transition: all 0.15s;
        }
        .vupload-btn:hover:not(:disabled) { background: #334155; }
        .vupload-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .vupload-btn-primary {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .vupload-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .vupload-btn-danger {
          background: #dc2626;
          border-color: #dc2626;
          color: #fff;
        }
        .vupload-btn-danger:hover:not(:disabled) { background: #b91c1c; }
        .vupload-btn-success {
          background: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .vupload-btn-success:hover:not(:disabled) { background: #15803d; }
        .vupload-btn svg { width: 18px; height: 18px; }
        .vupload-webcam-wrapper {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .vupload-webcam-video {
          width: 100%;
          display: block;
        }
        .vupload-webcam-video.mirrored {
          transform: scaleX(-1);
        }
        .vupload-recording-indicator {
          position: absolute;
          top: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0,0,0,0.7);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          color: #fca5a5;
        }
        .vupload-recording-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          animation: vupload-pulse 1s ease-in-out infinite;
        }
        @keyframes vupload-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .vupload-timer {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0,0,0,0.7);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          font-family: monospace;
        }
        .vupload-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .vupload-recorded-preview {
          display: flex;
          gap: 16px;
          margin-top: 12px;
          align-items: flex-start;
        }
        .vupload-recorded-preview video {
          width: 200px;
          border-radius: 8px;
          background: #000;
        }
        .vupload-video-section {
          margin-top: 0;
        }
        .vupload-video-section video {
          width: 100%;
          max-height: 400px;
          border-radius: 12px;
          background: #000;
        }
        .vupload-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-top: 16px;
          padding: 16px;
          background: #0f172a;
          border-radius: 10px;
          border: 1px solid #1e293b;
        }
        .vupload-meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .vupload-meta-item .vlabel {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .vupload-meta-item .vvalue {
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .vupload-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          justify-content: flex-end;
        }
        .vupload-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
          margin-top: 16px;
        }
        .vupload-error svg { width: 18px; height: 18px; flex-shrink: 0; }
        .vupload-camera-select {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #94a3b8;
        }
        .vupload-camera-select select {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #e2e8f0;
          padding: 4px 8px;
          font-size: 12px;
        }
        .vupload-progress-bar {
          width: 100%;
          height: 4px;
          background: #1e293b;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 12px;
        }
        .vupload-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #60a5fa);
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .vupload-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #1e293b;
          border-top-color: #60a5fa;
          border-radius: 50%;
          animation: vupload-spin 0.8s linear infinite;
        }
        @keyframes vupload-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* INITIAL STATE — two large cards */}
      {!source && !file && (
        <div className="vupload-grid">
          {/* Left: Drag & drop upload */}
          <div
            className={`vupload-zone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={handleBrowse}
          >
            <Upload className="vupload-zone-icon" />
            <h3>Upload a video</h3>
            <p>Drag & drop or click to browse</p>
            <div className="vupload-formats">MP4 &middot; MOV &middot; WebM (max 60s, 500MB)</div>
            <button
              className="vupload-btn vupload-btn-primary"
              onClick={(e) => { e.stopPropagation(); handleBrowse(); }}
              style={{ marginTop: 8 }}
            >
              <Upload size={16} /> Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {/* Right: Webcam */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
              Record with webcam
            </h3>
            {cameraLoading ? (
              <div className="vupload-webcam-wrapper" style={{ flexDirection: "column", gap: 12 }}>
                <div className="vupload-spinner" />
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Initializing camera...</p>
              </div>
            ) : (
              <div
                className="vupload-zone"
                onClick={() => startWebcam(selectedCamera || undefined)}
                style={{ minHeight: 420, cursor: "pointer" }}
              >
                <Camera className="vupload-zone-icon" />
                <h3>Start webcam</h3>
                <p>Record a sign language video directly</p>
                <div className="vupload-formats">Up to {MAX_DURATION} seconds</div>
                {cameras.length > 0 && (
                  <div
                    className="vupload-camera-select"
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: 8 }}
                  >
                    <Monitor size={14} />
                    <select
                      value={selectedCamera}
                      onChange={(e) => setSelectedCamera(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {cameras.map((cam) => (
                        <option key={cam.deviceId} value={cam.deviceId}>
                          {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <button
                      className="vupload-btn"
                      style={{ padding: "4px 8px", fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        startWebcam(selectedCamera || undefined);
                      }}
                      title="Start with selected camera"
                    >
                      <Camera size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WEBCAM LIVE VIEW */}
      {source === "webcam" && (
        <>
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", width: "100%", minHeight: 420 }}>
            <video
              ref={webcamVideoRef}
              className={`vupload-webcam-video ${mirrored ? "mirrored" : ""}`}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "auto", display: "block", position: "relative", zIndex: 1 }}
            />
            {showSkeletonOverlay && (
              <canvas
                ref={skeletonCanvasRef}
                width={400}
                height={400}
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  display: "block", zIndex: 2,
                  pointerEvents: "none",
                }}
              />
            )}
            {recordPhase === "recording" && (
              <div className="vupload-recording-indicator" style={{ zIndex: 3 }}>
                <span className="vupload-recording-dot" />
                REC
              </div>
            )}
            {recordPhase !== "idle" && (
              <div className="vupload-timer" style={{ zIndex: 3 }}>
                {formatDuration(recordDuration)}
              </div>
            )}
            {!holisticReady && !holisticLoading && (
              <div style={{ position: "absolute", zIndex: 3, bottom: 8, left: 8, fontSize: 11, color: "#94a3b8", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: 4 }}>
                Holistic: {holisticError || "not started"}
              </div>
            )}
            {holisticLoading && (
              <div style={{ position: "absolute", zIndex: 3, bottom: 8, left: 8, fontSize: 11, color: "#60a5fa", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: 4 }}>
                Loading Holistic...
              </div>
            )}
            {holisticReady && showSkeletonOverlay && (
              <div style={{ position: "absolute", zIndex: 3, bottom: 8, left: 8, display: "flex", gap: 6, fontSize: 10 }}>
                {[
                  { label: "Pose", on: diagPoseDetected },
                  { label: "L Hand", on: diagLeftHandDetected },
                  { label: "R Hand", on: diagRightHandDetected },
                ].map((d) => (
                  <span key={d.label} style={{
                    padding: "2px 6px", borderRadius: 3,
                    background: d.on ? "rgba(74,222,128,0.2)" : "rgba(100,116,139,0.2)",
                    color: d.on ? "#86efac" : "#64748b",
                  }}>{d.label}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, padding: "6px 10px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", fontSize: 11, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: webcamActive ? "#4ade80" : "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: webcamActive ? "#4ade80" : "#64748b" }} />
              Camera {webcamActive ? "Ready" : "Off"}
            </span>
            <span style={{ color: holisticReady ? "#4ade80" : holisticLoading ? "#60a5fa" : "#64748b" }}>
              Holistic: {holisticReady ? "Ready" : holisticLoading ? "Loading..." : "Off"}
            </span>
            {holisticReady && (
              <>
                <span style={{ color: "#94a3b8" }}>{diagFps} FPS</span>
                <span style={{ color: "#94a3b8" }}>{diagFrameCount} frames</span>
              </>
            )}
            {recordPhase === "recording" && (
              <span style={{ color: "#fca5a5" }}>Recording {formatDuration(recordDuration)}</span>
            )}
          </div>

          <div className="vupload-controls">
            {recordPhase === "streaming" && (
              <button className="vupload-btn vupload-btn-danger" onClick={startRecording}>
                <Camera /> Start Recording
              </button>
            )}
            {recordPhase === "recording" && (
              <button className="vupload-btn vupload-btn-danger" onClick={stopRecording}>
                <Film /> Stop ({formatDuration(recordDuration)})
              </button>
            )}
            <button className="vupload-btn" onClick={handleReset}>
              <X /> Cancel
            </button>
            <button
              className="vupload-btn"
              onClick={() => setMirrored(!mirrored)}
              title="Toggle mirror"
              style={{ padding: "8px 10px" }}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="vupload-btn"
              onClick={() => setShowSkeletonOverlay((s) => !s)}
              title="Toggle skeleton overlay"
              style={{ padding: "8px 10px", color: showSkeletonOverlay ? "#60a5fa" : "#64748b" }}
            >
              <Activity size={16} />
            </button>
            {cameras.length > 1 && (
              <select
                value={selectedCamera}
                onChange={(e) => {
                  setSelectedCamera(e.target.value);
                  stopWebcam();
                  setTimeout(() => startWebcam(e.target.value), 300);
                }}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  color: "#e2e8f0",
                  padding: "6px 8px",
                  fontSize: 12,
                }}
              >
                {cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Diagnostics Panel */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 4, marginTop: 8,
            padding: 8,
            background: "#0f172a",
            borderRadius: 8,
            border: "1px solid #1e293b",
            fontSize: 11,
          }}>
            {[
              { label: "Camera Stream", ok: webcamActive && !!streamRef.current },
              { label: "Video Playing", ok: webcamActive },
              { label: "Video Width", ok: (webcamVideoRef.current?.videoWidth ?? 0) > 0 },
              { label: "Video Height", ok: (webcamVideoRef.current?.videoHeight ?? 0) > 0 },
              { label: "Holistic Ready", ok: holisticReady },
              { label: "FPS", ok: diagFps >= 15 },
              { label: "Pose Detected", ok: diagPoseDetected },
              { label: "Left Hand", ok: diagLeftHandDetected },
              { label: "Right Hand", ok: diagRightHandDetected },
              { label: "Recording", ok: recordPhase === "recording" },
            ].map((d) => (
              <div key={d.label} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 6px", borderRadius: 4,
                background: "rgba(30,41,59,0.5)",
              }}>
                <span style={{ color: d.ok ? "#4ade80" : "#64748b", fontSize: 13 }}>
                  {d.ok ? "✅" : "❌"}
                </span>
                <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{d.label}</span>
              </div>
            ))}
          </div>

          {recordPhase === "done" && recordedBlob && (
            <div className="vupload-recorded-preview">
              <video ref={previewVideoRef} src={recordedUrl} controls />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Recording: {formatDuration(recordDuration)} &middot;{" "}
                  {formatSize(recordedBlob.size)}
                </p>
                {recordedLandmarkCount > 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "#4ade80" }}>
                    {recordedLandmarkCount} landmark frames captured
                  </p>
                )}
                {recordedFramesRef.current.length > 0 && recordedLandmarkCount === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "#fde68a" }}>
                    Processing landmarks...
                  </p>
                )}
                <button className="vupload-btn vupload-btn-success" onClick={handleRecordedConfirm}>
                  <Check size={16} /> Use This Video
                </button>
                <button
                  className="vupload-btn"
                  onClick={() => {
                    setRecordedBlob(null);
                    URL.revokeObjectURL(recordedUrl);
                    setRecordedUrl("");
                    setRecordDuration(0);
                    setRecordPhase("streaming");
                  }}
                >
                  <X size={16} /> Retake
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ERROR */}
      {error && (
        <div className="vupload-error">
          <AlertCircle />
          <span>{error}</span>
        </div>
      )}

      {/* UPLOAD PROGRESS */}
      {source === "file" && uploadProgress > 0 && uploadProgress < 100 && !metadata && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
            Processing video... {Math.round(uploadProgress)}%
          </p>
          <div className="vupload-progress-bar">
            <div className="vupload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* VIDEO PREVIEW */}
      {file && videoUrl && metadata && (
        <div className="vupload-video-section">
          <video ref={videoRef} src={videoUrl} controls preload="metadata" />
          <div className="vupload-meta">
            <div className="vupload-meta-item">
              <span className="vlabel">Filename</span>
              <span className="vvalue">{file.name}</span>
            </div>
            <div className="vupload-meta-item">
              <span className="vlabel">Duration</span>
              <span className="vvalue">{formatDuration(metadata.duration)}</span>
            </div>
            <div className="vupload-meta-item">
              <span className="vlabel">Resolution</span>
              <span className="vvalue">{metadata.width}&times;{metadata.height}</span>
            </div>
            <div className="vupload-meta-item">
              <span className="vlabel">FPS</span>
              <span className="vvalue">{metadata.fps}</span>
            </div>
            <div className="vupload-meta-item">
              <span className="vlabel">File Size</span>
              <span className="vvalue">{formatSize(metadata.fileSize)}</span>
            </div>
          </div>
          <div className="vupload-actions">
            <button className="vupload-btn" onClick={handleReset}>
              <X /> Remove
            </button>
            <button className="vupload-btn vupload-btn-primary" onClick={handleExtract}>
              <Wand2 /> Extract Pose
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
