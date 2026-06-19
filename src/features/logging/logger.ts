import {
  LogEntry,
  Session,
  SessionAnalytics,
  TranscriptEntry
} from "./types";
import {
  saveLog as saveLogLocal,
  saveSession as saveSessionLocal,
  getSession as getSessionLocal,
  getSessions as getSessionsLocal,
  getLogs as getLogsLocal,
  getAllLogs as getAllLogsLocal,
  saveTranscriptLocal,
  getTranscripts as getTranscriptsLocal,
  getAllTranscripts as getAllTranscriptsLocal
} from "./storage";
import {
  queuePrediction,
  queueTranscript,
  queueEndSession,
  isAuthenticated,
  initSync
} from "./sync";

let nextId = Date.now();

const generateId = (): string => {
  nextId += 1;
  return nextId.toString(36);
};

export const createSession = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export type RecordPredictionParams = {
  sessionId: string;
  predictedLabel: string;
  confidence: number;
  topK: Array<{ label: string; confidence: number }>;
  smoothingEnabled: boolean;
  inferenceTimeMs: number;
  fps: number;
  startedAt?: string;
};

export const recordPrediction = (params: RecordPredictionParams): LogEntry => {
  const entry: LogEntry = {
    id: `${params.sessionId}_${generateId()}`,
    timestamp: new Date().toISOString(),
    predictedLabel: params.predictedLabel,
    confidence: params.confidence,
    topK: params.topK,
    smoothingEnabled: params.smoothingEnabled,
    inferenceTimeMs: params.inferenceTimeMs,
    fps: params.fps
  };

  saveLogLocal(entry);

  if (isAuthenticated()) {
    queuePrediction({
      sessionId: params.sessionId,
      predictedLabel: params.predictedLabel,
      confidence: params.confidence,
      topK: params.topK,
      inferenceTimeMs: params.inferenceTimeMs,
      startedAt: params.startedAt
    });
  }

  return entry;
};

export const endSession = (sessionId: string, startedAt: string): Session => {
  const logs = getLogsLocal(sessionId);
  const count = logs.length;
  const avgConf =
    count > 0
      ? logs.reduce((sum, l) => sum + l.confidence, 0) / count
      : 0;
  const avgTime =
    count > 0
      ? logs.reduce((sum, l) => sum + l.inferenceTimeMs, 0) / count
      : 0;
  const avgFps =
    count > 0 ? logs.reduce((sum, l) => sum + l.fps, 0) / count : 0;

  const session: Session = {
    sessionId,
    startedAt,
    endedAt: new Date().toISOString(),
    totalPredictions: count,
    averageConfidence: avgConf,
    averageInferenceTime: avgTime,
    averageFps: avgFps
  };
  saveSessionLocal(session);

  if (isAuthenticated()) {
    queueEndSession({ sessionId });
  }

  return session;
};

export const getSessionAnalytics = (sessionId: string): SessionAnalytics => {
  const logs = getLogsLocal(sessionId);
  const session = getSessionLocal(sessionId);

  const labelCounts: Record<string, number> = {};
  let totalConf = 0;
  let lowestConf = Infinity;
  let lowestConfLabel = "";
  let highestConf = -Infinity;
  let highestConfLabel = "";

  for (const log of logs) {
    labelCounts[log.predictedLabel] =
      (labelCounts[log.predictedLabel] ?? 0) + 1;
    totalConf += log.confidence;

    if (log.confidence < lowestConf) {
      lowestConf = log.confidence;
      lowestConfLabel = log.predictedLabel;
    }
    if (log.confidence > highestConf) {
      highestConf = log.confidence;
      highestConfLabel = log.predictedLabel;
    }
  }

  let mostRecognizedLabel = "";
  let maxCount = 0;
  for (const [label, count] of Object.entries(labelCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostRecognizedLabel = label;
    }
  }

  const sessionDurationMs = session
    ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
    : 0;

  return {
    mostRecognizedLabel,
    averageConfidence: logs.length > 0 ? totalConf / logs.length : 0,
    lowestConfidenceLabel: lowestConfLabel,
    lowestConfidence: lowestConf === Infinity ? 0 : lowestConf,
    highestConfidenceLabel: highestConfLabel,
    highestConfidence: highestConf === -Infinity ? 0 : highestConf,
    sessionDurationMs,
    totalPredictions: logs.length,
    labelCounts
  };
};

export const getTranscriptEntries = (sessionId: string): TranscriptEntry[] => {
  return getTranscriptsLocal(sessionId);
};

export const saveTranscriptEntry = (input: {
  sessionId: string;
  label: string;
  timestamp?: string;
}): TranscriptEntry => {
  const entry: TranscriptEntry = {
    label: input.label,
    timestamp: input.timestamp ?? new Date().toISOString(),
    sessionId: input.sessionId
  };
  saveTranscriptLocal(entry);

  if (isAuthenticated()) {
    queueTranscript({
      sessionId: input.sessionId,
      content: input.label
    });
  }
  return entry;
};

export const getAllSessionAnalytics = () => {
  const sessions = getSessionsLocal();
  const allLogs = getAllLogsLocal();

  const labelCounts: Record<string, number> = {};
  let totalConf = 0;
  let totalPredictions = 0;

  for (const log of allLogs) {
    labelCounts[log.predictedLabel] =
      (labelCounts[log.predictedLabel] ?? 0) + 1;
    totalConf += log.confidence;
    totalPredictions += 1;
  }

  let mostRecognizedLabel = "";
  let maxCount = 0;
  for (const [label, count] of Object.entries(labelCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostRecognizedLabel = label;
    }
  }

  const totalDurationMs = sessions.reduce((sum, s) => {
    const start = new Date(s.startedAt).getTime();
    const end = new Date(s.endedAt).getTime();
    return sum + (end - start);
  }, 0);

  return {
    totalSessions: sessions.length,
    totalPredictions,
    mostRecognizedLabel,
    averageConfidence: totalPredictions > 0 ? totalConf / totalPredictions : 0,
    totalDurationMs,
    labelCounts
  };
};

export const initializeLogging = (authenticated: boolean) => {
  initSync({ authenticated });
};
