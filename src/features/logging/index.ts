export type {
  LogEntry,
  Session,
  ConfidenceThreshold,
  TranscriptEntry,
  SessionAnalytics
} from "./types";
export {
  CONFIDENCE_THRESHOLDS,
  DEFAULT_CONFIDENCE_THRESHOLD
} from "./types";
export {
  saveLog,
  getLogs,
  getAllLogs,
  saveSession,
  getSessions,
  getSession,
  deleteSession,
  clearAll,
  saveTranscriptLocal,
  getTranscripts,
  getAllTranscripts,
  type PendingOperation
} from "./storage";
export {
  createSession,
  recordPrediction,
  endSession,
  getSessionAnalytics,
  getTranscriptEntries,
  getAllSessionAnalytics,
  saveTranscriptEntry,
  initializeLogging
} from "./logger";
export type { RecordPredictionParams } from "./logger";
export {
  initSync,
  setAuthenticated,
  isAuthenticated,
  getSyncStatus,
  subscribeSync,
  flushQueue,
  importLocalHistoryIfNeeded,
  deduplicateLocalLogs,
  clearPendingQueue,
  type SyncStatus,
  type FlushResult,
  type ImportResult
} from "./sync";
export {
  createTranslationSession,
  logPrediction,
  saveTranscript,
  finalizeTranslationSession,
  getUserSessions,
  getSessionLogs,
  importLocalHistory,
  type CreateSessionResult,
  type LogPredictionInput,
  type SaveTranscriptInput,
  type FinalizeSessionInput,
  type GetUserSessionsOptions,
  type UserSessionRow,
  type SessionLogRow,
  type SessionTranscriptRow,
  type GetSessionLogsResult
} from "./actions";
