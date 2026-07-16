import { describe, expect, it } from "vitest";
import { getDashboardRecognitionSamples } from "@/lib/admin/dashboardRecognition";

describe("getDashboardRecognitionSamples", () => {
  it("prefers persisted translation logs when they are available", () => {
    const result = getDashboardRecognitionSamples({
      logs: [{ confidence: 0.91, created_at: "2026-07-15T09:00:00.000Z", inference_time_ms: 12 }],
      telemetryEvents: [{
        event_type: "recognition_success",
        confidence: 0.52,
        created_at: "2026-07-15T10:00:00.000Z",
        event_data: { inference_time_ms: 16 },
      }],
    });

    expect(result.source).toBe("translation logs");
    expect(result.samples).toEqual([{ confidence: 0.91, createdAt: "2026-07-15T09:00:00.000Z", inferenceTimeMs: 12 }]);
  });

  it("uses recognition telemetry when translation logs have no activity", () => {
    const result = getDashboardRecognitionSamples({
      logs: [],
      telemetryEvents: [{
        event_type: "recognition_success",
        confidence: 0.84,
        created_at: "2026-07-15T10:00:00.000Z",
        event_data: { inference_time_ms: 15.5 },
      }],
    });

    expect(result.source).toBe("telemetry");
    expect(result.samples).toEqual([{ confidence: 0.84, createdAt: "2026-07-15T10:00:00.000Z", inferenceTimeMs: 15.5 }]);
  });

  it("excludes unrelated telemetry from recognition statistics", () => {
    const result = getDashboardRecognitionSamples({
      logs: [],
      telemetryEvents: [{
        event_type: "gesture_used",
        confidence: 0.95,
        created_at: "2026-07-15T10:00:00.000Z",
        event_data: {},
      }],
    });

    expect(result.samples).toEqual([]);
  });
});