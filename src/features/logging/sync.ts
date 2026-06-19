// Sync layer. Sits between the logger (which is sync) and the
// Supabase server actions (which are async). Responsibilities:
//   - track online state
//   - retry queued operations when online
//   - import local history the first time an authenticated user opens
//     the camera page
//   - deduplicate predictions by (sessionId, predictedLabel, timestamp)
//
// This file is browser-only; it never runs on the server.

import {
  enqueueOperation,
  dequeueOperations,
  readQueue,
  clearQueue,
  readSyncMeta,
  writeSyncMeta,
  hasImportedHistory,
  markHistoryImported,
  getLocalDataForImport,
  type PendingOperation
} from "./storage";
import { getTransport } from "./transport";
import type { LogEntry, Session } from "./types";
import type { ImportSessionInput } from "@/lib/supabase/queries/translations";

type SyncListener = (status: SyncStatus) => void;

export interface SyncStatus {
  online: boolean;
  queueLength: number;
  lastSyncAt: string | null;
  lastError: string | null;
  flushing: boolean;
  authenticated: boolean;
}

let listeners: SyncListener[] = [];
let currentStatus: SyncStatus = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  queueLength: 0,
  lastSyncAt: null,
  lastError: null,
  flushing: false,
  authenticated: false
};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initDone = false;

const notify = () => {
  for (const l of listeners) l(currentStatus);
};

const updateStatus = (patch: Partial<SyncStatus>) => {
  currentStatus = { ...currentStatus, ...patch };
  notify();
};

const computeQueueLength = () => readQueue().length;

export const getSyncStatus = (): SyncStatus => ({ ...currentStatus });

export const subscribeSync = (cb: SyncListener): (() => void) => {
  listeners.push(cb);
  cb(currentStatus);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};

const persistMeta = () => {
  const meta = readSyncMeta();
  updateStatus({
    lastSyncAt: meta.lastSyncAt,
    lastError: meta.lastError
  });
};

export const initSync = (opts: { authenticated: boolean }) => {
  if (typeof window === "undefined") return;
  if (initDone) {
    updateStatus({ authenticated: opts.authenticated });
    return;
  }
  initDone = true;
  updateStatus({
    authenticated: opts.authenticated,
    online: navigator.onLine,
    queueLength: computeQueueLength()
  });
  persistMeta();

  window.addEventListener("online", () => {
    updateStatus({ online: true });
    scheduleFlush();
  });
  window.addEventListener("offline", () => {
    updateStatus({ online: false });
  });
};

export const setAuthenticated = (authenticated: boolean) => {
  updateStatus({ authenticated });
  if (authenticated) scheduleFlush();
};

const generateId = (): string => {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const logDedupeKey = (log: Pick<LogEntry, "id" | "timestamp" | "predictedLabel">) =>
  `${log.id}|${log.timestamp}|${log.predictedLabel}`;

export const queuePrediction = (input: {
  sessionId: string;
  predictedLabel: string;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
  inferenceTimeMs: number;
  startedAt?: string;
}): string => {
  const op: PendingOperation = {
    kind: "prediction",
    id: generateId(),
    enqueuedAt: new Date().toISOString(),
    sessionId: input.sessionId,
    predictedLabel: input.predictedLabel,
    confidence: input.confidence,
    topK: input.topK,
    inferenceTimeMs: input.inferenceTimeMs,
    startedAt: input.startedAt
  };
  enqueueOperation(op);
  updateStatus({ queueLength: computeQueueLength() });
  scheduleFlush();
  return op.id;
};

export const queueTranscript = (input: {
  sessionId: string;
  content: string;
  startedAt?: string;
}): string => {
  const op: PendingOperation = {
    kind: "transcript",
    id: generateId(),
    enqueuedAt: new Date().toISOString(),
    sessionId: input.sessionId,
    content: input.content,
    startedAt: input.startedAt
  };
  enqueueOperation(op);
  updateStatus({ queueLength: computeQueueLength() });
  scheduleFlush();
  return op.id;
};

export const queueEndSession = (input: { sessionId: string }): string => {
  const op: PendingOperation = {
    kind: "end-session",
    id: generateId(),
    enqueuedAt: new Date().toISOString(),
    sessionId: input.sessionId
  };
  enqueueOperation(op);
  updateStatus({ queueLength: computeQueueLength() });
  scheduleFlush();
  return op.id;
};

const scheduleFlush = (delayMs = 250) => {
  if (typeof window === "undefined") return;
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delayMs);
};

const logToServer = async (op: Extract<PendingOperation, { kind: "prediction" }>) => {
  const transport = getTransport();
  return transport.logPrediction({
    sessionId: op.sessionId,
    gestureLabel: op.predictedLabel,
    confidence: op.confidence,
    inferenceTimeMs: op.inferenceTimeMs,
    startedAt: op.startedAt
  });
};

const transcriptToServer = async (op: Extract<PendingOperation, { kind: "transcript" }>) => {
  const transport = getTransport();
  return transport.saveTranscript({
    sessionId: op.sessionId,
    content: op.content,
    startedAt: op.startedAt
  });
};

const endSessionToServer = async (op: Extract<PendingOperation, { kind: "end-session" }>) => {
  const transport = getTransport();
  return transport.finalizeTranslationSession({ sessionId: op.sessionId });
};

export interface FlushResult {
  attempted: number;
  succeeded: number;
  failed: number;
  error: string | null;
}

export const flushQueue = async (): Promise<FlushResult> => {
  if (typeof window === "undefined") {
    return { attempted: 0, succeeded: 0, failed: 0, error: null };
  }
  if (currentStatus.flushing) {
    return { attempted: 0, succeeded: 0, failed: 0, error: null };
  }
  if (!currentStatus.authenticated) {
    return { attempted: 0, succeeded: 0, failed: 0, error: null };
  }
  if (!currentStatus.online) {
    return { attempted: 0, succeeded: 0, failed: 0, error: "offline" };
  }

  const queue = readQueue();
  if (queue.length === 0) {
    updateStatus({ queueLength: 0 });
    return { attempted: 0, succeeded: 0, failed: 0, error: null };
  }

  updateStatus({ flushing: true });
  let succeeded = 0;
  let failed = 0;
  let firstError: string | null = null;
  const succeededIds: string[] = [];

  for (const op of queue) {
    try {
      const result =
        op.kind === "prediction"
          ? await logToServer(op)
          : op.kind === "transcript"
          ? await transcriptToServer(op)
          : await endSessionToServer(op);
      if ("error" in result && result.error) {
        failed += 1;
        if (firstError === null) firstError = result.error;
        break;
      }
      succeededIds.push(op.id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      if (firstError === null) {
        firstError = err instanceof Error ? err.message : "Network error";
      }
      break;
    }
  }

  dequeueOperations(succeededIds);
  const now = new Date().toISOString();
  writeSyncMeta({ lastSyncAt: now, lastFlushCount: succeeded, lastError: firstError });
  updateStatus({
    flushing: false,
    queueLength: computeQueueLength(),
    lastSyncAt: now,
    lastError: firstError
  });

  return { attempted: queue.length, succeeded, failed, error: firstError };
};

const buildImportPayload = (sessions: Session[], logs: LogEntry[]) => {
  const logsBySession = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const sessionId = log.id.split("_")[0] ?? "unknown";
    const list = logsBySession.get(sessionId) ?? [];
    list.push(log);
    logsBySession.set(sessionId, list);
  }
  return sessions.map<ImportSessionInput>((session) => {
    const sessionLogs = logsBySession.get(session.sessionId) ?? [];
    const startedAtMs = new Date(session.startedAt).getTime();
    const endedAtMs = new Date(session.endedAt).getTime();
    return {
      id: session.sessionId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: Number.isFinite(endedAtMs - startedAtMs) ? endedAtMs - startedAtMs : session.totalPredictions > 0 ? endedAtMs - startedAtMs : 0,
      logs: sessionLogs.map((l) => ({
        sessionId: session.sessionId,
        gestureLabel: l.predictedLabel,
        confidence: l.confidence,
        inferenceTimeMs: l.inferenceTimeMs,
        createdAt: l.timestamp
      }))
    };
  });
};

export interface ImportResult {
  importedSessions: number;
  importedLogs: number;
  cleared: boolean;
  error: string | null;
}

export const importLocalHistoryIfNeeded = async (): Promise<ImportResult> => {
  if (typeof window === "undefined") {
    return { importedSessions: 0, importedLogs: 0, cleared: false, error: null };
  }
  if (!currentStatus.authenticated) {
    return { importedSessions: 0, importedLogs: 0, cleared: false, error: "not authenticated" };
  }
  if (hasImportedHistory()) {
    return { importedSessions: 0, importedLogs: 0, cleared: false, error: null };
  }
  const data = getLocalDataForImport();
  if (data.sessions.length === 0 && data.logs.length === 0) {
    markHistoryImported();
    return { importedSessions: 0, importedLogs: 0, cleared: false, error: null };
  }
  const payload = buildImportPayload(data.sessions, data.logs);
  const transport = getTransport();
  const result = await transport.importLocalHistory(payload);
  if ("error" in result && result.error) {
    return { importedSessions: 0, importedLogs: 0, cleared: false, error: result.error };
  }
  markHistoryImported();
  return {
    importedSessions: result.imported ?? 0,
    importedLogs: data.logs.length,
    cleared: true,
    error: null
  };
};

export const deduplicateLocalLogs = (logs: LogEntry[]): LogEntry[] => {
  const seen = new Set<string>();
  const out: LogEntry[] = [];
  for (const log of logs) {
    const key = logDedupeKey(log);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(log);
  }
  return out;
};

export const clearPendingQueue = (): void => {
  clearQueue();
  updateStatus({ queueLength: 0 });
};

export const isAuthenticated = (): boolean => currentStatus.authenticated;

export const __resetSyncForTests = (): void => {
  listeners = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  currentStatus = {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    queueLength: 0,
    lastSyncAt: null,
    lastError: null,
    flushing: false,
    authenticated: false
  };
  initDone = false;
};
