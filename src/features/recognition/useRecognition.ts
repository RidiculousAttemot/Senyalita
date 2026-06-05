"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RecognitionState, RealPredictionResult } from "./types";
import { InferenceResult } from "./model";
import { SequenceBuffer, HandData } from "./buffer";
import { PredictionSmoother } from "./smoothing";
import { translateResult } from "./translation";
import { loadModel, infer } from "./model";

const INFERENCE_INTERVAL_MS = 200;

export type RecognitionControls = {
  state: RecognitionState;
  appendFrame: (left: HandData | null, right: HandData | null) => void;
  resetRecognition: () => void;
};

export type OnPredictionCallback = (
  result: InferenceResult,
  inferenceTimeMs: number
) => void;

export const useRecognition = (
  onPrediction?: OnPredictionCallback
): RecognitionControls => {
  const [state, setState] = useState<RecognitionState>({
    stage: "loading-model"
  });

  const bufferRef = useRef<SequenceBuffer | null>(null);
  const smootherRef = useRef<PredictionSmoother | null>(null);
  const modelReadyRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const inferenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictionsRef = useRef<RealPredictionResult[]>([]);
  const latestFrameTimeRef = useRef(0);
  const onPredictionRef = useRef(onPrediction);
  onPredictionRef.current = onPrediction;

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      bufferRef.current = new SequenceBuffer();
      smootherRef.current = new PredictionSmoother();
      modelReadyRef.current = false;

      const result = await loadModel();

      if (!mounted) return;

      if (result.status === "ready") {
        modelReadyRef.current = true;
        setState({ stage: "predicting", result: null });

        inferenceTimerRef.current = setInterval(() => {
          if (!modelReadyRef.current || !bufferRef.current) return;

          const sampled = bufferRef.current.sampleTemporal();
          if (!sampled) return;

          const inferStart = performance.now();
          infer(sampled).then((inference) => {
            if (!inference || !mounted) return;
            const inferenceTimeMs = performance.now() - inferStart;

            const translated = translateResult(inference);
            const smoothed = smootherRef.current?.smooth(translated) ?? translated;

            setState({
              stage: "predicting",
              result: {
                label: smoothed.label,
                confidence: smoothed.confidence,
                topK: smoothed.topK
              }
            });

            onPredictionRef.current?.(inference, inferenceTimeMs);
          });
        }, INFERENCE_INTERVAL_MS);
      } else {
        setState({
          stage: "error",
          message: result.error ?? "Failed to load recognition model"
        });
      }
    };

    init();

    return () => {
      mounted = false;
      if (inferenceTimerRef.current !== null) {
        clearInterval(inferenceTimerRef.current);
        inferenceTimerRef.current = null;
      }
    };
  }, []);

  const appendFrame = useCallback(
    (left: HandData | null, right: HandData | null) => {
      if (bufferRef.current) {
        bufferRef.current.append(left, right);
      }
    },
    []
  );

  const resetRecognition = useCallback(() => {
    bufferRef.current?.reset();
    smootherRef.current?.reset();
    setState({ stage: "predicting", result: null });
  }, []);

  return { state, appendFrame, resetRecognition };
};
