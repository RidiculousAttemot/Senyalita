import type { ModelLoadResult } from "./types";

const MODEL_VERSION = "bilstm_v4";
const MODEL_TYPE = "unified-bilstm-v4";

type CacheState = {
  status: "loading" | "ready" | "error";
  model: unknown;
  labels: string[];
  error: string | null;
  modelVersion: string;
  modelType: string;
};

let cache: CacheState = {
  status: "loading",
  model: null,
  labels: [],
  error: null,
  modelVersion: MODEL_VERSION,
  modelType: MODEL_TYPE,
};

export function getCache(): CacheState {
  return cache;
}

export function setCache(update: Partial<CacheState>): void {
  cache = { ...cache, ...update };
}

export function getCachedResult(): ModelLoadResult {
  return {
    status: cache.status,
    error: cache.error ?? undefined,
    modelVersion: cache.status === "ready" ? cache.modelVersion : undefined,
    modelType: cache.status === "ready" ? cache.modelType : undefined,
    classes: cache.status === "ready" ? cache.labels.length : undefined,
  };
}
