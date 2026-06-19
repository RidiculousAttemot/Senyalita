import { LogEntry, Session, TranscriptEntry } from "./types";

const LOGS_KEY = "fsl_recognition_logs";
const SESSIONS_KEY = "fsl_recognition_sessions";
const TRANSCRIPTS_KEY = "fsl_transcripts";
const QUEUE_KEY = "fsl_pending_queue";
const SYNC_META_KEY = "fsl_sync_meta";
const IMPORTED_FLAG_KEY = "fsl_history_imported";

export type PendingOperation =
  | {
      kind: "prediction";
      id: string;
      enqueuedAt: string;
      sessionId: string;
      predictedLabel: string;
      confidence: number;
      topK: Array<{ label: string; confidence: number }>;
      inferenceTimeMs: number;
      startedAt?: string;
    }
  | {
      kind: "transcript";
      id: string;
      enqueuedAt: string;
      sessionId: string;
      content: string;
      startedAt?: string;
    }
  | {
      kind: "end-session";
      id: string;
      enqueuedAt: string;
      sessionId: string;
    };

export type SyncMeta = {
  lastSyncAt: string | null;
  lastFlushCount: number;
  lastError: string | null;
};

function isLocalStorageAvailable(): boolean {
  try {
    const key = "__fsl_storage_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const useLocalStorage = typeof window !== "undefined" && isLocalStorageAvailable();

function readItem<T>(key: string, fallback: T): T {
  if (!useLocalStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeItem<T>(key: string, value: T): void {
  if (!useLocalStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown[];
        const kept = (parsed as T[]).slice(-100);
        localStorage.setItem(key, JSON.stringify(kept));
      }
    } catch {
    }
  }
}

export const saveLog = (entry: LogEntry): void => {
  const logs = readItem<LogEntry[]>(LOGS_KEY, []);
  logs.push(entry);
  writeItem(LOGS_KEY, logs);
};

export const getLogs = (sessionId: string): LogEntry[] => {
  const logs = readItem<LogEntry[]>(LOGS_KEY, []);
  return logs.filter((l) => l.id.startsWith(sessionId));
};

export const getAllLogs = (): LogEntry[] => {
  return readItem<LogEntry[]>(LOGS_KEY, []);
};

export const saveSession = (session: Session): void => {
  const sessions = readItem<Session[]>(SESSIONS_KEY, []);
  const index = sessions.findIndex((s) => s.sessionId === session.sessionId);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  writeItem(SESSIONS_KEY, sessions);
};

export const getSessions = (): Session[] => {
  return readItem<Session[]>(SESSIONS_KEY, []);
};

export const getSession = (sessionId: string): Session | null => {
  const sessions = readItem<Session[]>(SESSIONS_KEY, []);
  return sessions.find((s) => s.sessionId === sessionId) ?? null;
};

export const deleteSession = (sessionId: string): void => {
  const sessions = readItem<Session[]>(SESSIONS_KEY, []);
  writeItem(
    SESSIONS_KEY,
    sessions.filter((s) => s.sessionId !== sessionId)
  );
  const logs = readItem<LogEntry[]>(LOGS_KEY, []);
  writeItem(
    LOGS_KEY,
    logs.filter((l) => !l.id.startsWith(sessionId))
  );
  const transcripts = readItem<TranscriptEntry[]>(TRANSCRIPTS_KEY, []);
  writeItem(
    TRANSCRIPTS_KEY,
    transcripts.filter((t) => t.sessionId !== sessionId)
  );
};

export const clearAll = (): void => {
  if (!useLocalStorage) return;
  localStorage.removeItem(LOGS_KEY);
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(TRANSCRIPTS_KEY);
};

export const saveTranscriptLocal = (entry: TranscriptEntry): void => {
  const transcripts = readItem<TranscriptEntry[]>(TRANSCRIPTS_KEY, []);
  const filtered = transcripts.filter(
    (t) => !(t.sessionId === entry.sessionId && t.label === entry.label)
  );
  filtered.push(entry);
  writeItem(TRANSCRIPTS_KEY, filtered);
};

export const getTranscripts = (sessionId: string): TranscriptEntry[] => {
  const transcripts = readItem<TranscriptEntry[]>(TRANSCRIPTS_KEY, []);
  return transcripts
    .filter((t) => t.sessionId === sessionId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

export const getAllTranscripts = (): TranscriptEntry[] => {
  return readItem<TranscriptEntry[]>(TRANSCRIPTS_KEY, []);
};

export const enqueueOperation = (op: PendingOperation): void => {
  const queue = readItem<PendingOperation[]>(QUEUE_KEY, []);
  if (queue.some((existing) => existing.id === op.id)) return;
  queue.push(op);
  writeItem(QUEUE_KEY, queue);
};

export const dequeueOperations = (ids: string[]): void => {
  const queue = readItem<PendingOperation[]>(QUEUE_KEY, []);
  const idSet = new Set(ids);
  writeItem(
    QUEUE_KEY,
    queue.filter((op) => !idSet.has(op.id))
  );
};

export const readQueue = (): PendingOperation[] => {
  return readItem<PendingOperation[]>(QUEUE_KEY, []);
};

export const clearQueue = (): void => {
  if (useLocalStorage) localStorage.removeItem(QUEUE_KEY);
};

export const readSyncMeta = (): SyncMeta => {
  return readItem<SyncMeta>(SYNC_META_KEY, {
    lastSyncAt: null,
    lastFlushCount: 0,
    lastError: null
  });
};

export const writeSyncMeta = (meta: Partial<SyncMeta>): void => {
  const current = readSyncMeta();
  writeItem(SYNC_META_KEY, { ...current, ...meta });
};

export const hasImportedHistory = (): boolean => {
  return readItem<boolean>(IMPORTED_FLAG_KEY, false);
};

export const markHistoryImported = (): void => {
  writeItem(IMPORTED_FLAG_KEY, true);
};

export const resetImportedFlag = (): void => {
  if (useLocalStorage) localStorage.removeItem(IMPORTED_FLAG_KEY);
};

export const getLocalDataForImport = () => {
  return {
    sessions: readItem<Session[]>(SESSIONS_KEY, []),
    logs: readItem<LogEntry[]>(LOGS_KEY, []),
    transcripts: readItem<TranscriptEntry[]>(TRANSCRIPTS_KEY, [])
  };
};
