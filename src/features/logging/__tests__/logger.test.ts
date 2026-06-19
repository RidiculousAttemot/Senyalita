import { describe, it, expect, beforeEach } from "vitest";
import {
  createSession,
  recordPrediction,
  endSession,
  getSessionAnalytics,
  getAllSessionAnalytics,
  saveTranscriptEntry,
  initializeLogging
} from "../logger";
import { getTranscripts, readQueue } from "../storage";
import { resetSyncForTests } from "./sync.test-helpers";

beforeEach(() => {
  localStorage.clear();
  resetSyncForTests();
});

describe("logger — local-only flow (guest mode)", () => {
  it("createSession returns a unique id", () => {
    const a = createSession();
    const b = createSession();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^session_/);
  });

  it("recordPrediction returns a log entry with the session id prefix", () => {
    const sessionId = createSession();
    const entry = recordPrediction({
      sessionId,
      predictedLabel: "a",
      confidence: 0.9,
      topK: [{ label: "a", confidence: 0.9 }],
      smoothingEnabled: true,
      inferenceTimeMs: 5,
      fps: 30
    });
    expect(entry.id.startsWith(sessionId)).toBe(true);
  });

  it("endSession computes aggregate metrics from local logs", () => {
    const sessionId = createSession();
    recordPrediction({
      sessionId,
      predictedLabel: "a",
      confidence: 0.8,
      topK: [],
      smoothingEnabled: true,
      inferenceTimeMs: 4,
      fps: 30
    });
    recordPrediction({
      sessionId,
      predictedLabel: "b",
      confidence: 0.6,
      topK: [],
      smoothingEnabled: true,
      inferenceTimeMs: 6,
      fps: 30
    });
    const session = endSession(sessionId, new Date().toISOString());
    expect(session.totalPredictions).toBe(2);
    expect(session.averageConfidence).toBeCloseTo(0.7, 5);
    expect(session.averageInferenceTime).toBeCloseTo(5, 5);
  });

  it("endSession returns zeros for a session with no logs", () => {
    const sessionId = createSession();
    const session = endSession(sessionId, new Date().toISOString());
    expect(session.totalPredictions).toBe(0);
    expect(session.averageConfidence).toBe(0);
    expect(session.averageInferenceTime).toBe(0);
    expect(session.averageFps).toBe(0);
  });

  it("getSessionAnalytics picks the most-recognized label", () => {
    const sessionId = createSession();
    for (let i = 0; i < 5; i += 1) {
      recordPrediction({
        sessionId,
        predictedLabel: "a",
        confidence: 0.7,
        topK: [],
        smoothingEnabled: true,
        inferenceTimeMs: 4,
        fps: 30
      });
    }
    recordPrediction({
      sessionId,
      predictedLabel: "b",
      confidence: 0.5,
      topK: [],
      smoothingEnabled: true,
      inferenceTimeMs: 4,
      fps: 30
    });
    const analytics = getSessionAnalytics(sessionId);
    expect(analytics.mostRecognizedLabel).toBe("a");
    expect(analytics.totalPredictions).toBe(6);
  });

  it("getSessionAnalytics handles unknown session (no session record)", () => {
    const analytics = getSessionAnalytics("missing_session");
    expect(analytics.totalPredictions).toBe(0);
    expect(analytics.sessionDurationMs).toBe(0);
    expect(analytics.lowestConfidence).toBe(0);
    expect(analytics.highestConfidence).toBe(0);
  });

  it("getAllSessionAnalytics aggregates across all sessions", () => {
    const s1 = createSession();
    const s2 = createSession();
    recordPrediction({ sessionId: s1, predictedLabel: "a", confidence: 0.8, topK: [], smoothingEnabled: true, inferenceTimeMs: 4, fps: 30 });
    recordPrediction({ sessionId: s2, predictedLabel: "b", confidence: 0.6, topK: [], smoothingEnabled: true, inferenceTimeMs: 6, fps: 30 });
    endSession(s1, new Date().toISOString());
    endSession(s2, new Date().toISOString());
    const all = getAllSessionAnalytics();
    expect(all.totalSessions).toBe(2);
    expect(all.totalPredictions).toBe(2);
    expect(all.averageConfidence).toBeCloseTo(0.7, 5);
  });

  it("getAllSessionAnalytics handles empty state", () => {
    const all = getAllSessionAnalytics();
    expect(all.totalSessions).toBe(0);
    expect(all.totalPredictions).toBe(0);
    expect(all.averageConfidence).toBe(0);
    expect(all.totalDurationMs).toBe(0);
  });

  it("saveTranscriptEntry stores a label-keyed entry", () => {
    const sessionId = createSession();
    saveTranscriptEntry({ sessionId, label: "ABC" });
    saveTranscriptEntry({ sessionId, label: "ABCD" });
    const entries = getTranscripts(sessionId);
    expect(entries.length).toBe(2);
  });

  it("saveTranscriptEntry respects a provided timestamp", () => {
    const sessionId = createSession();
    const ts = "2024-01-01T00:00:00.000Z";
    const entry = saveTranscriptEntry({ sessionId, label: "X", timestamp: ts });
    expect(entry.timestamp).toBe(ts);
  });
});

describe("logger — authenticated hybrid flow", () => {
  it("recordPrediction queues the prediction when authenticated", () => {
    initializeLogging(true);
    const sessionId = createSession();
    recordPrediction({
      sessionId,
      predictedLabel: "a",
      confidence: 0.8,
      topK: [],
      smoothingEnabled: true,
      inferenceTimeMs: 4,
      fps: 30
    });
    expect(readQueue().length).toBe(1);
    expect(readQueue()[0].kind).toBe("prediction");
  });

  it("recordPrediction does NOT queue when guest", () => {
    initializeLogging(false);
    const sessionId = createSession();
    recordPrediction({
      sessionId,
      predictedLabel: "a",
      confidence: 0.8,
      topK: [],
      smoothingEnabled: true,
      inferenceTimeMs: 4,
      fps: 30
    });
    expect(readQueue().length).toBe(0);
  });

  it("endSession queues an end-session op when authenticated", () => {
    initializeLogging(true);
    const sessionId = createSession();
    recordPrediction({
      sessionId,
      predictedLabel: "a",
      confidence: 0.8,
      topK: [],
      smoothingEnabled: true,
      inferenceTimeMs: 4,
      fps: 30
    });
    endSession(sessionId, new Date().toISOString());
    const q = readQueue();
    const endOps = q.filter((o) => o.kind === "end-session");
    expect(endOps.length).toBe(1);
  });

  it("saveTranscriptEntry queues a transcript op when authenticated", () => {
    initializeLogging(true);
    const sessionId = createSession();
    saveTranscriptEntry({ sessionId, label: "HI" });
    const q = readQueue();
    const tOps = q.filter((o) => o.kind === "transcript");
    expect(tOps.length).toBe(1);
  });

  it("endSession does not queue end-session op for guest", () => {
    initializeLogging(false);
    const sessionId = createSession();
    endSession(sessionId, new Date().toISOString());
    expect(readQueue().length).toBe(0);
  });
});
