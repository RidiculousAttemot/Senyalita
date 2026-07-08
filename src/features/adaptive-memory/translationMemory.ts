import type { TranslationMemoryEntry, TranslationMemoryIndex, TranslationMemoryStats, TranslationMemoryQuery } from "./types";

type StorageProvider = {
  load(): Promise<TranslationMemoryEntry[]>;
  save(entries: TranslationMemoryEntry[]): Promise<void>;
  append(entry: TranslationMemoryEntry): Promise<void>;
};

const MAX_CACHE_SIZE = 1000;
const FREQUENT_THRESHOLD = 5;

export class TranslationMemory {
  private entries: TranslationMemoryEntry[] = [];
  private index: TranslationMemoryIndex = {
    byOriginalText: new Map(),
    byGloss: new Map(),
    byGesture: new Map(),
    frequentlyUsed: [],
  };
  private storage: StorageProvider;
  private totalLookups = 0;
  private cacheHits = 0;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.loadFromStorage();
    return this.loadPromise;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const loaded = await this.storage.load();
      this.entries = [...loaded];
      this.rebuildIndex();
    } catch {
      this.entries = [];
    }
    this.loaded = true;
  }

  private rebuildIndex(): void {
    this.index = {
      byOriginalText: new Map(),
      byGloss: new Map(),
      byGesture: new Map(),
      frequentlyUsed: [],
    };

    for (const entry of this.entries) {
      const key = entry.originalText.toLowerCase().trim();
      if (!this.index.byOriginalText.has(key)) {
        this.index.byOriginalText.set(key, []);
      }
      this.index.byOriginalText.get(key)!.push(entry.id);

      const glossKey = entry.fslGloss.toLowerCase().trim();
      if (!this.index.byGloss.has(glossKey)) {
        this.index.byGloss.set(glossKey, []);
      }
      this.index.byGloss.get(glossKey)!.push(entry.id);

      for (const gesture of entry.gestureSequence) {
        const gKey = gesture.toLowerCase().trim();
        if (!this.index.byGesture.has(gKey)) {
          this.index.byGesture.set(gKey, []);
        }
        this.index.byGesture.get(gKey)!.push(entry.id);
      }
    }

    this.index.frequentlyUsed = this.entries
      .filter((e) => e.usageCount >= FREQUENT_THRESHOLD)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 50)
      .map((e) => e.id);
  }

  async lookup(input: string): Promise<TranslationMemoryEntry | null> {
    await this.initialize();
    this.totalLookups++;

    const key = input.toLowerCase().trim();
    const ids = this.index.byOriginalText.get(key);

    if (ids && ids.length > 0) {
      const entry = this.entries.find((e) => e.id === ids[0]);
      if (entry) {
        this.cacheHits++;
        entry.usageCount++;
        entry.lastUsedAt = Date.now();
        return entry;
      }
    }

    const glossIds = this.index.byGloss.get(key);
    if (glossIds && glossIds.length > 0) {
      const entry = this.entries.find((e) => e.id === glossIds[0]);
      if (entry) {
        this.cacheHits++;
        entry.usageCount++;
        entry.lastUsedAt = Date.now();
        return entry;
      }
    }

    return null;
  }

  async lookupByGloss(gloss: string): Promise<TranslationMemoryEntry[]> {
    await this.initialize();
    const key = gloss.toLowerCase().trim();
    const ids = this.index.byGloss.get(key) ?? [];
    return ids
      .map((id) => this.entries.find((e) => e.id === id))
      .filter((e): e is TranslationMemoryEntry => e !== undefined);
  }

  async addEntry(entry: TranslationMemoryEntry): Promise<void> {
    await this.initialize();

    const existing = this.entries.findIndex(
      (e) => e.originalText.toLowerCase().trim() === entry.originalText.toLowerCase().trim()
    );

    if (existing >= 0) {
      this.entries[existing].usageCount++;
      this.entries[existing].lastUsedAt = Date.now();
      this.entries[existing].averageConfidence = (this.entries[existing].averageConfidence + entry.averageConfidence) / 2;
      if (entry.administratorCorrections.length > 0) {
        this.entries[existing].administratorCorrections = [
          ...new Set([...this.entries[existing].administratorCorrections, ...entry.administratorCorrections]),
        ];
      }
      this.rebuildIndex();
      return;
    }

    if (this.entries.length >= MAX_CACHE_SIZE) {
      const oldest = this.entries.reduce((min, e) => (e.lastUsedAt < min.lastUsedAt ? e : min));
      this.entries = this.entries.filter((e) => e.id !== oldest.id);
    }

    this.entries.push(entry);
    this.rebuildIndex();
    await this.storage.save(this.entries);
  }

  async recordCorrection(originalText: string, correction: string): Promise<void> {
    await this.initialize();

    const existing = this.entries.find(
      (e) => e.originalText.toLowerCase().trim() === originalText.toLowerCase().trim()
    );

    if (existing) {
      if (!existing.administratorCorrections.includes(correction)) {
        existing.administratorCorrections.push(correction);
      }
      existing.usageCount++;
      existing.lastUsedAt = Date.now();
      this.rebuildIndex();
      await this.storage.save(this.entries);
    }
  }

  async query(query: TranslationMemoryQuery): Promise<TranslationMemoryEntry[]> {
    await this.initialize();

    let results = [...this.entries];

    if (query.originalText) {
      const q = query.originalText.toLowerCase();
      results = results.filter((e) => e.originalText.toLowerCase().includes(q));
    }

    if (query.gloss) {
      const q = query.gloss.toLowerCase();
      results = results.filter((e) => e.fslGloss.toLowerCase().includes(q));
    }

    if (query.gestureLabel) {
      const q = query.gestureLabel.toLowerCase();
      results = results.filter((e) => e.gestureSequence.some((g) => g.toLowerCase().includes(q)));
    }

    if (query.language) {
      results = results.filter((e) => e.detectedLanguage === query.language);
    }

    const minConf = query.minConfidence;
    if (minConf !== undefined) {
      results = results.filter((e) => e.averageConfidence >= minConf);
    }

    results.sort((a, b) => b.usageCount - a.usageCount);

    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  getStats(): TranslationMemoryStats {
    const languageMap: Record<string, number> = {};
    for (const e of this.entries) {
      languageMap[e.detectedLanguage] = (languageMap[e.detectedLanguage] ?? 0) + 1;
    }

    const totalConfidence = this.entries.reduce((s, e) => s + e.averageConfidence, 0);
    const avgConfidence = this.entries.length > 0 ? totalConfidence / this.entries.length : 0;

    const mostUsed = [...this.entries]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20);

    return {
      totalEntries: this.entries.length,
      totalLookups: this.totalLookups,
      cacheHitRate: this.totalLookups > 0 ? this.cacheHits / this.totalLookups : 0,
      mostUsedEntries: mostUsed,
      languageBreakdown: languageMap,
      averageConfidence: avgConfidence,
    };
  }

  getFrequentEntries(minUsage = FREQUENT_THRESHOLD): TranslationMemoryEntry[] {
    return this.entries
      .filter((e) => e.usageCount >= minUsage)
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  async getAllEntries(): Promise<TranslationMemoryEntry[]> {
    await this.initialize();
    return [...this.entries];
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  getCacheHitRate(): number {
    return this.totalLookups > 0 ? this.cacheHits / this.totalLookups : 0;
  }
}
