import { LogEntry, Session } from "./types";

const LOGS_KEY = "fsl_recognition_logs";
const SESSIONS_KEY = "fsl_recognition_sessions";

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

const useLocalStorage = isLocalStorageAvailable();

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
};

export const clearAll = (): void => {
  if (useLocalStorage) {
    localStorage.removeItem(LOGS_KEY);
    localStorage.removeItem(SESSIONS_KEY);
  }
};
