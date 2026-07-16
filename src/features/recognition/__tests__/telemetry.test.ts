import { describe, expect, it } from "vitest";
import { buildRecognitionTelemetryEvents } from "../telemetry";

describe("buildRecognitionTelemetryEvents", () => {
  it("records a recognized gesture against the anonymous browser session", () => {
    expect(buildRecognitionTelemetryEvents({
      gestureLabel: "HELLO",
      confidence: 0.91,
      sessionToken: "anon_session",
    })).toEqual([
      expect.objectContaining({
        event_type: "recognition_success",
        gesture_label: "HELLO",
        confidence: 0.91,
        session_token: "anon_session",
      }),
      expect.objectContaining({
        event_type: "gesture_used",
        gesture_label: "HELLO",
        confidence: 0.91,
        session_token: "anon_session",
      }),
    ]);
  });

  it("adds a low-confidence event for a recognition below the threshold", () => {
    const events = buildRecognitionTelemetryEvents({
      gestureLabel: "THANK YOU",
      confidence: 0.42,
      sessionToken: "anon_session",
    });

    expect(events).toContainEqual(expect.objectContaining({
      event_type: "low_confidence",
      event_data: { threshold: 0.5 },
    }));
  });

  it("honors a caller-provided low-confidence decision", () => {
    const events = buildRecognitionTelemetryEvents({
      gestureLabel: "GOOD MORNING",
      confidence: 0.76,
      sessionToken: "anon_session",
      isLowConfidence: true,
    });

    expect(events).toContainEqual(expect.objectContaining({ event_type: "low_confidence" }));
  });

  it("does not create events without a recognized gesture", () => {
    expect(buildRecognitionTelemetryEvents({
      gestureLabel: null,
      confidence: 0.8,
      sessionToken: "anon_session",
    })).toEqual([]);
  });
});