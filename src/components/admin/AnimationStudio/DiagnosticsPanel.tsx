"use client";

import { Camera, Activity, Monitor, Hand, Eye, Layers, Clock, BarChart3, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface DiagnosticsData {
  cameraReady: boolean;
  holisticReady: boolean;
  holisticLoading: boolean;
  fps: number;
  poseDetected: boolean;
  leftHandDetected: boolean;
  rightHandDetected: boolean;
  faceDetected: boolean;
  totalFrames: number;
  recordingDuration: number;
  landmarkCount: number;
  extractionProgress: number;
  processingTime: number;
}

interface DiagnosticsPanelProps {
  data: DiagnosticsData;
}

export function DiagnosticsPanel({ data }: DiagnosticsPanelProps) {
  const items = [
    { icon: Monitor, label: "Camera", value: data.cameraReady ? "Ready" : "Off", ok: data.cameraReady },
    { icon: Activity, label: "Holistic", value: data.holisticReady ? "Ready" : data.holisticLoading ? "Loading..." : "Off", ok: data.holisticReady },
    { icon: Camera, label: "FPS", value: `${data.fps}`, ok: data.fps >= 15 },
    { icon: Eye, label: "Pose", value: data.poseDetected ? "Detected" : "None", ok: data.poseDetected },
    { icon: Eye, label: "Face", value: data.faceDetected ? "Detected" : "None", ok: data.faceDetected },
    { icon: Hand, label: "Left Hand", value: data.leftHandDetected ? "Detected" : "None", ok: data.leftHandDetected },
    { icon: Hand, label: "Right Hand", value: data.rightHandDetected ? "Detected" : "None", ok: data.rightHandDetected },
    { icon: Layers, label: "Frames", value: `${data.totalFrames}`, ok: data.totalFrames > 0 },
    { icon: Clock, label: "Duration", value: `${data.recordingDuration.toFixed(1)}s`, ok: data.recordingDuration > 0 },
    { icon: BarChart3, label: "Landmarks", value: `${data.landmarkCount}/frame`, ok: data.landmarkCount > 100 },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
      gap: 6,
      padding: 10,
      background: "#0f172a",
      borderRadius: 10,
      border: "1px solid #1e293b",
    }}>
      {items.map((item) => (
        <div key={item.label} style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderRadius: 6,
          background: "rgba(30,41,59,0.5)",
          fontSize: 11,
        }}>
          <item.icon size={14} style={{ color: item.ok ? "#4ade80" : "#64748b", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#64748b", fontSize: 10, lineHeight: "12px" }}>{item.label}</div>
            <div style={{
              color: item.ok ? "#e2e8f0" : "#94a3b8",
              fontWeight: 600,
              fontSize: 12,
              lineHeight: "16px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>{item.value}</div>
          </div>
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>
            {item.ok ? (
              <CheckCircle2 size={12} color="#4ade80" />
            ) : (
              <XCircle size={12} color="#64748b" />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
