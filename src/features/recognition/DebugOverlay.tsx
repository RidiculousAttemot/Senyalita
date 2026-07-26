"use client";

import { useEffect, useState, useRef } from "react";
import { RecognitionState } from "./types";

type Props = {
  recognitionState: RecognitionState;
  mediapipeFps: number;
  /** Rate landmarks enter the buffer; must sit near 30 to match training. */
  captureFps?: number;
  inferenceTimeMs: number;
  bufferLength: number;
  bufferCap: number;
  minimumFrames: number;
};

export const DebugOverlay = ({
  recognitionState,
  mediapipeFps,
  captureFps = 0,
  inferenceTimeMs,
  bufferLength,
  bufferCap,
  minimumFrames,
}: Props) => {
  const [visible, setVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const framesRef = useRef(0);
  const lastSecRef = useRef(performance.now());
  const [inferenceFps, setInferenceFps] = useState(0);

  useEffect(() => {
    const check = () => {
      const params = new URLSearchParams(window.location.search);
      const ls = typeof localStorage !== "undefined" && localStorage.getItem("debugRecognition");
      setVisible(params.has("debug") || ls === "true");
    };
    check();
    window.addEventListener("popstate", check);
    return () => window.removeEventListener("popstate", check);
  }, []);

  useEffect(() => {
    if (!visible) return;
    framesRef.current += 1;
    const now = performance.now();
    if (now - lastSecRef.current >= 1000) {
      setInferenceFps(Math.round((framesRef.current * 1000) / (now - lastSecRef.current)));
      framesRef.current = 0;
      lastSecRef.current = now;
    }
  }, [visible]);

  if (!visible) return null;

  const result = recognitionState.stage === "predicting" ? recognitionState.result : null;
  const bufferFill = bufferCap > 0 ? Math.round((bufferLength / bufferCap) * 100) : 0;
  const isPredicting = recognitionState.stage === "predicting";
  const isReady = result !== null;
  const showCount = showAll ? result?.topK.length ?? 0 : 3;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: 6,
        lineHeight: 1.6,
        minWidth: 260,
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#fff" }}>
        ⚙ Recognition Debug
      </div>
      <table style={{ width: "100%" }}>
        <tbody>
          <tr>
            <td style={{ color: "#aaa" }}>MediaPipe FPS</td>
            <td style={{ textAlign: "right" }}>{mediapipeFps}</td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Capture FPS</td>
            {/* Amber when the buffer is being fed at a rate training never saw. */}
            <td style={{ textAlign: "right", color: captureFps > 0 && Math.abs(captureFps - 30) > 4 ? "#fb0" : undefined }}>
              {captureFps} <span style={{ color: "#666" }}>/ 30</span>
            </td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Inference FPS</td>
            <td style={{ textAlign: "right" }}>{inferenceFps}</td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Buffer</td>
            <td style={{ textAlign: "right" }}>
              {bufferLength} / {bufferCap} ({bufferFill}%)
            </td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Min frames</td>
            <td style={{ textAlign: "right" }}>{minimumFrames}</td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Stage</td>
            <td style={{ textAlign: "right" }}>{recognitionState.stage}</td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Inference time</td>
            <td style={{ textAlign: "right" }}>{inferenceTimeMs.toFixed(1)}ms</td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Prediction</td>
            <td
              style={{
                textAlign: "right",
                color: isReady ? "#0f0" : "#ff0",
                fontWeight: 700,
              }}
            >
              {isReady ? result!.label : isPredicting ? "collecting..." : "—"}
            </td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Category</td>
            <td style={{ textAlign: "right" }}>
              {isReady ? (result as any).category ?? "—" : "—"}
            </td>
          </tr>
          <tr>
            <td style={{ color: "#aaa" }}>Confidence</td>
            <td style={{ textAlign: "right" }}>
              {isReady ? `${(result!.confidence * 100).toFixed(1)}%` : "—"}
            </td>
          </tr>
          {isReady && result!.topK.length > 0 && (
            <tr>
              <td style={{ color: "#aaa", verticalAlign: "top" }}>
                Top-{showCount}
                <br />
                <button
                  onClick={() => setShowAll((v) => !v)}
                  style={{
                    background: "none",
                    border: "1px solid #555",
                    color: "#0f0",
                    cursor: "pointer",
                    fontSize: 10,
                    marginTop: 2,
                    padding: "1px 4px",
                    borderRadius: 3,
                  }}
                >
                  {showAll ? "3" : "5"}
                </button>
              </td>
              <td style={{ textAlign: "right", fontSize: 11 }}>
                {result!.topK.slice(0, showCount).map((s, i) => (
                  <div key={s.label}>
                    {i + 1}. {s.label} ({(s.confidence * 100).toFixed(0)}%)
                  </div>
                ))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{ marginTop: 6, color: "#666", fontSize: 10 }}>
        toggle: ?debug=1 | localStorage.debugRecognition=true
      </div>
    </div>
  );
};
