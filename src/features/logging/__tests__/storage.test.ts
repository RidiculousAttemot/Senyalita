import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveLog,
  getLogs,
  getAllLogs,
  saveSession,
  getSessions,
  deleteSession,
  clearAll,
  saveTranscriptLocal,
  enqueueOperation,
  readQueue,
  dequeueOperations,
  clearQueue,
  hasImportedHistory,
  markHistoryImported,
  getLocalDataForImport
} from "../storage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeLog = (sessionId: string, n: number) => ({
  id: `${sessionId}_${n}`,
  timestamp: new Date(2024, 0, 1, 0, 0, n).toISOString(),
  predictedLabel: "a",
  confidence: 0.9,
  topK: [],
  smoothingEnabled: true,
  inferenceTimeMs: 5,
  fps: 30
});

describe("storage — local sessions and logs", () => {
  it("saves and reads logs filtered by session id", () => {
    saveLog(makeLog("s1", 1));
    saveLog(makeLog("s1", 2));
    saveLog(makeLog("s2", 1));
    expect(getLogs("s1").length).toBe(2);
    expect(getLogs("s2").length).toBe(1);
    expect(getAllLogs().length).toBe(3);
  });

  it("saves and replaces sessions by id", () => {
    saveSession({
      sessionId: "s1",
      startedAt: "2024-01-01T00:00:00Z",
      endedAt: "2024-01-01T00:01:00Z",
      totalPredictions: 0,
      averageConfidence: 0,
      averageInferenceTime: 0,
      averageFps: 0
    });
    saveSession({
      sessionId: "s1",
      startedAt: "2024-01-01T00:00:00Z",
      endedAt: "2024-01-01T00:02:00Z",
      totalPredictions: 0,
      averageConfidence: 0,
      averageInferenceTime: 0,
      averageFps: 0
    });
    expect(getSessions().length).toBe(1);
  });

  it("deletes a session and its logs", () => {
    saveLog(makeLog("s1", 1));
    saveLog(makeLog("s1", 2));
    saveLog(makeLog("s2", 1));
    saveSession({
      sessionId: "s1",
      startedAt: "2024-01-01T00:00:00Z",
      endedAt: "2024-01-01T00:01:00Z",
      totalPredictions: 0,
      averageConfidence: 0,
      averageInferenceTime: 0,
      averageFps: 0
    });
    deleteSession("s1");
    expect(getLogs("s1").length).toBe(0);
    expect(getSessions().length).toBe(0);
    expect(getAllLogs().length).toBe(1);
  });

  it("clears all local data", () => {
    saveLog(makeLog("s1", 1));
    saveTranscriptLocal({ sessionId: "s1", label: "A", timestamp: "2024-01-01T00:00:00Z" });
    clearAll();
    expect(getAllLogs().length).toBe(0);
  });
});

describe("storage — pending queue", () => {
  it("enqueues operations in order", () => {
    enqueueOperation({
      kind: "prediction",
      id: "1",
      enqueuedAt: "t",
      sessionId: "s",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    enqueueOperation({ kind: "end-session", id: "2", enqueuedAt: "t", sessionId: "s" });
    expect(readQueue().length).toBe(2);
  });

  it("deduplicates operations by id", () => {
    const op = {
      kind: "prediction" as const,
      id: "1",
      enqueuedAt: "t",
      sessionId: "s",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    };
    enqueueOperation(op);
    enqueueOperation(op);
    expect(readQueue().length).toBe(1);
  });

  it("dequeues operations by id", () => {
    enqueueOperation({ kind: "end-session", id: "1", enqueuedAt: "t", sessionId: "s" });
    enqueueOperation({ kind: "end-session", id: "2", enqueuedAt: "t", sessionId: "s" });
    dequeueOperations(["1"]);
    const remaining = readQueue();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe("2");
  });

  it("clears the queue", () => {
    enqueueOperation({ kind: "end-session", id: "1", enqueuedAt: "t", sessionId: "s" });
    clearQueue();
    expect(readQueue().length).toBe(0);
  });
});

describe("storage — import flow", () => {
  it("marks import complete and reports via hasImportedHistory", () => {
    expect(hasImportedHistory()).toBe(false);
    markHistoryImported();
    expect(hasImportedHistory()).toBe(true);
  });

  it("returns the current local data for import", () => {
    saveLog(makeLog("s1", 1));
    saveSession({
      sessionId: "s1",
      startedAt: "2024-01-01T00:00:00Z",
      endedAt: "2024-01-01T00:01:00Z",
      totalPredictions: 0,
      averageConfidence: 0,
      averageInferenceTime: 0,
      averageFps: 0
    });
    const data = getLocalDataForImport();
    expect(data.sessions.length).toBe(1);
    expect(data.logs.length).toBe(1);
  });
});
