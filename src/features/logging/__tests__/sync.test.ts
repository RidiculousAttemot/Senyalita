import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueOperation,
  readQueue,
  clearQueue,
  hasImportedHistory,
  markHistoryImported,
  getLocalDataForImport
} from "../storage";
import {
  setTransport,
  resetTransport,
  type SyncTransport
} from "../transport";
import {
  initSync,
  setAuthenticated,
  getSyncStatus,
  subscribeSync,
  queuePrediction,
  queueTranscript,
  queueEndSession,
  flushQueue,
  importLocalHistoryIfNeeded,
  deduplicateLocalLogs,
  clearPendingQueue,
  isAuthenticated
} from "../sync";
import { resetSyncForTests } from "./sync.test-helpers";
import type { LogEntry, Session } from "../types";

const makeLog = (id: string, ts: string, label = "a"): LogEntry => ({
  id,
  timestamp: ts,
  predictedLabel: label,
  confidence: 0.9,
  topK: [],
  smoothingEnabled: true,
  inferenceTimeMs: 5,
  fps: 30
});

const makeSession = (sessionId: string, startedAt: string, endedAt: string): Session => ({
  sessionId,
  startedAt,
  endedAt,
  totalPredictions: 0,
  averageConfidence: 0,
  averageInferenceTime: 0,
  averageFps: 0
});

const installMockTransport = (overrides: Partial<SyncTransport> = {}) => {
  const transport: SyncTransport = {
    logPrediction: vi.fn(async () => ({ success: true as const })),
    saveTranscript: vi.fn(async () => ({ success: true as const, id: "x" })),
    finalizeTranslationSession: vi.fn(async () => ({ success: true as const })),
    importLocalHistory: vi.fn(async () => ({ success: true as const, imported: 1 })),
    ...overrides
  };
  setTransport(transport);
  return transport;
};

beforeEach(() => {
  localStorage.clear();
  clearQueue();
  clearPendingQueue();
  resetTransport();
  resetSyncForTests();
  // ensure online
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("sync — auth + online state", () => {
  it("initSync stores the authenticated flag", () => {
    initSync({ authenticated: true });
    expect(isAuthenticated()).toBe(true);
    setAuthenticated(false);
    expect(isAuthenticated()).toBe(false);
  });

  it("getSyncStatus returns the current snapshot", () => {
    initSync({ authenticated: true });
    const status = getSyncStatus();
    expect(status.online).toBe(true);
    expect(status.queueLength).toBe(0);
  });

  it("subscribeSync notifies listeners when state changes", () => {
    initSync({ authenticated: false });
    const listener = vi.fn();
    const unsubscribe = subscribeSync(listener);
    setAuthenticated(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

describe("sync — queue operations", () => {
  it("queuePrediction adds an operation and reports queue length", () => {
    initSync({ authenticated: true });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    expect(getSyncStatus().queueLength).toBe(1);
  });

  it("queueTranscript and queueEndSession add their own operations", () => {
    initSync({ authenticated: true });
    queueTranscript({ sessionId: "s1", content: "ABC" });
    queueEndSession({ sessionId: "s1" });
    expect(readQueue().length).toBe(2);
  });
});

describe("sync — flushQueue", () => {
  it("does nothing when not authenticated", async () => {
    initSync({ authenticated: false });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    const result = await flushQueue();
    expect(result.attempted).toBe(0);
  });

  it("flushes predictions via the transport", async () => {
    initSync({ authenticated: true });
    const transport = installMockTransport();
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    const result = await flushQueue();
    expect(result.succeeded).toBe(1);
    expect(transport.logPrediction).toHaveBeenCalledTimes(1);
  });

  it("flushes transcripts and end-session operations", async () => {
    initSync({ authenticated: true });
    const transport = installMockTransport();
    queueTranscript({ sessionId: "s1", content: "AB" });
    queueEndSession({ sessionId: "s1" });
    const result = await flushQueue();
    expect(result.succeeded).toBe(2);
    expect(transport.saveTranscript).toHaveBeenCalledTimes(1);
    expect(transport.finalizeTranslationSession).toHaveBeenCalledTimes(1);
  });

  it("stops on the first error and keeps failed items in the queue", async () => {
    initSync({ authenticated: true });
    installMockTransport({
      logPrediction: vi.fn(async () => ({ error: "server error" }))
    });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "b",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    const result = await flushQueue();
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.error).toBe("server error");
    expect(readQueue().length).toBe(2);
  });

  it("handles a thrown network error and uses its message", async () => {
    initSync({ authenticated: true });
    installMockTransport({
      logPrediction: vi.fn(async () => {
        throw new Error("connection refused");
      })
    });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    const result = await flushQueue();
    expect(result.failed).toBe(1);
    expect(result.error).toBe("connection refused");
  });

  it("handles a thrown non-Error value", async () => {
    initSync({ authenticated: true });
    installMockTransport({
      logPrediction: vi.fn(async () => {
        throw "string error";
      })
    });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    const result = await flushQueue();
    expect(result.error).toBe("Network error");
  });

  it("reports import errors gracefully", async () => {
    initSync({ authenticated: true });
    installMockTransport({
      importLocalHistory: vi.fn(async () => ({ error: "import failed" }))
    });
    const { saveSession, saveLog } = await import("../storage");
    saveSession(makeSession("s1", "2024-01-01T00:00:00Z", "2024-01-01T00:01:00Z"));
    saveLog(makeLog("s1_1", "2024-01-01T00:00:30Z"));
    const result = await importLocalHistoryIfNeeded();
    expect(result.error).toBe("import failed");
    expect(result.cleared).toBe(false);
  });

  it("skips flush when offline", async () => {
    initSync({ authenticated: true });
    const transport = installMockTransport();
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    // simulate going offline
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    const result = await flushQueue();
    expect(result.error).toBe("offline");
    expect(transport.logPrediction).not.toHaveBeenCalled();
  });
});

describe("sync — importLocalHistoryIfNeeded", () => {
  it("does nothing when not authenticated", async () => {
    initSync({ authenticated: false });
    const transport = installMockTransport();
    const result = await importLocalHistoryIfNeeded();
    expect(result.importedSessions).toBe(0);
    expect(transport.importLocalHistory).not.toHaveBeenCalled();
  });

  it("does nothing when already imported", async () => {
    initSync({ authenticated: true });
    markHistoryImported();
    const transport = installMockTransport();
    const result = await importLocalHistoryIfNeeded();
    expect(result.importedSessions).toBe(0);
    expect(transport.importLocalHistory).not.toHaveBeenCalled();
  });

  it("does nothing when there is no local data", async () => {
    initSync({ authenticated: true });
    const transport = installMockTransport();
    const result = await importLocalHistoryIfNeeded();
    expect(result.importedSessions).toBe(0);
    expect(transport.importLocalHistory).not.toHaveBeenCalled();
    expect(hasImportedHistory()).toBe(true);
  });

  it("imports sessions + logs and marks complete on success", async () => {
    initSync({ authenticated: true });
    const transport = installMockTransport();
    const s1 = makeSession("s1", "2024-01-01T00:00:00Z", "2024-01-01T00:01:00Z");
    const log1 = makeLog("s1_1", "2024-01-01T00:00:30Z");
    // stash them via storage layer
    const { saveSession, saveLog } = await import("../storage");
    saveSession(s1);
    saveLog(log1);
    const result = await importLocalHistoryIfNeeded();
    expect(result.importedSessions).toBe(1);
    expect(result.cleared).toBe(true);
    expect(transport.importLocalHistory).toHaveBeenCalledTimes(1);
    expect(hasImportedHistory()).toBe(true);
  });
});

describe("sync — deduplicateLocalLogs", () => {
  it("removes duplicates by (id, timestamp, label)", () => {
    const a = makeLog("s1_1", "t", "a");
    const b = makeLog("s1_2", "t", "a");
    const out = deduplicateLocalLogs([a, { ...a }, b]);
    expect(out.length).toBe(2);
  });
});

describe("sync — clearPendingQueue", () => {
  it("removes everything from the queue", () => {
    initSync({ authenticated: true });
    queuePrediction({
      sessionId: "s1",
      predictedLabel: "a",
      confidence: 0.5,
      topK: [],
      inferenceTimeMs: 5
    });
    expect(readQueue().length).toBe(1);
    clearPendingQueue();
    expect(readQueue().length).toBe(0);
    expect(getSyncStatus().queueLength).toBe(0);
  });
});

describe("sync — getLocalDataForImport shape", () => {
  it("returns the current sessions and logs from localStorage", async () => {
    const { saveSession, saveLog } = await import("../storage");
    saveSession(makeSession("s1", "2024-01-01T00:00:00Z", "2024-01-01T00:01:00Z"));
    saveLog(makeLog("s1_1", "2024-01-01T00:00:30Z"));
    const data = getLocalDataForImport();
    expect(data.sessions.length).toBe(1);
    expect(data.logs.length).toBe(1);
  });
});
