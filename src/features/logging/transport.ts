// Transport layer for the sync queue. Wraps the server actions so they
// can be replaced in tests (e.g. with a mock that just resolves success).

import {
  logPrediction,
  saveTranscript,
  finalizeTranslationSession,
  importLocalHistory
} from "./actions";
import type { ImportSessionInput } from "@/lib/supabase/queries/translations";

export interface SyncTransport {
  logPrediction: typeof logPrediction;
  saveTranscript: typeof saveTranscript;
  finalizeTranslationSession: typeof finalizeTranslationSession;
  importLocalHistory: typeof importLocalHistory;
}

const defaultTransport: SyncTransport = {
  logPrediction,
  saveTranscript,
  finalizeTranslationSession,
  importLocalHistory
};

let currentTransport: SyncTransport = defaultTransport;

export const getTransport = (): SyncTransport => currentTransport;

export const setTransport = (transport: SyncTransport): void => {
  currentTransport = transport;
};

export const resetTransport = (): void => {
  currentTransport = defaultTransport;
};

export type { ImportSessionInput };
