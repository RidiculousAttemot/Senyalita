export type DashboardRecognitionSample = {
  confidence: number;
  createdAt: string;
  inferenceTimeMs: number | null;
};

type RecognitionLog = {
  confidence: number | null;
  created_at: string;
  inference_time_ms: number | null;
};

type RecognitionTelemetryEvent = {
  event_type: string;
  confidence: number | null;
  created_at: string;
  event_data: Record<string, unknown>;
};

const telemetryInferenceTime = (eventData: Record<string, unknown>): number | null => {
  const value = eventData.inference_time_ms;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const getDashboardRecognitionSamples = ({
  logs,
  telemetryEvents,
}: {
  logs: RecognitionLog[];
  telemetryEvents: RecognitionTelemetryEvent[];
}): { source: "translation logs" | "telemetry" | "none"; samples: DashboardRecognitionSample[] } => {
  const logSamples = logs.flatMap((log) => log.confidence === null ? [] : [{
    confidence: log.confidence,
    createdAt: log.created_at,
    inferenceTimeMs: log.inference_time_ms,
  }]);

  if (logSamples.length) return { source: "translation logs", samples: logSamples };

  const telemetrySamples = telemetryEvents
    .filter((event) => event.event_type === "recognition_success" && event.confidence !== null)
    .map((event) => ({
      confidence: event.confidence as number,
      createdAt: event.created_at,
      inferenceTimeMs: telemetryInferenceTime(event.event_data),
    }));

  return telemetrySamples.length
    ? { source: "telemetry", samples: telemetrySamples }
    : { source: "none", samples: [] };
};