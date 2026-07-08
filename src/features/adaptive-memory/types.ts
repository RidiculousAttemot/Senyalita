export type TranslationMemoryEntry = {
  id: string;
  originalText: string;
  detectedLanguage: string;
  fslGloss: string;
  gestureSequence: string[];
  animationSequence: string[];
  administratorCorrections: string[];
  timestamp: number;
  usageCount: number;
  lastUsedAt: number;
  averageConfidence: number;
  source: "conversation" | "translation" | "correction" | "admin";
  tags: string[];
};

export type TranslationMemoryIndex = {
  byOriginalText: Map<string, string[]>;
  byGloss: Map<string, string[]>;
  byGesture: Map<string, string[]>;
  frequentlyUsed: string[];
};

export type TranslationMemoryStats = {
  totalEntries: number;
  totalLookups: number;
  cacheHitRate: number;
  mostUsedEntries: TranslationMemoryEntry[];
  languageBreakdown: Record<string, number>;
  averageConfidence: number;
};

export type TranslationMemoryQuery = {
  originalText?: string;
  gloss?: string;
  gestureLabel?: string;
  language?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
};
