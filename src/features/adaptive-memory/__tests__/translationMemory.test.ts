import { describe, it, expect, beforeEach } from "vitest";
import { TranslationMemory } from "../translationMemory";
import { InMemoryStorageProvider } from "../storage";

function makeEntry(overrides: Partial<{
  id: string; originalText: string; detectedLanguage: string; fslGloss: string; gestureSequence: string[]; animationSequence: string[];
  administratorCorrections: string[]; timestamp: number; usageCount: number; lastUsedAt: number; averageConfidence: number; source: string; tags: string[];
}> = {}) {
  return {
    id: overrides.id ?? "test-1",
    originalText: overrides.originalText ?? "hello",
    detectedLanguage: overrides.detectedLanguage ?? "en",
    fslGloss: overrides.fslGloss ?? "HELLO",
    gestureSequence: overrides.gestureSequence ?? ["HELLO"],
    animationSequence: overrides.animationSequence ?? ["HELLO"],
    administratorCorrections: overrides.administratorCorrections ?? [],
    timestamp: overrides.timestamp ?? Date.now(),
    usageCount: overrides.usageCount ?? 0,
    lastUsedAt: overrides.lastUsedAt ?? Date.now(),
    averageConfidence: overrides.averageConfidence ?? 0.9,
    source: (overrides.source ?? "translation") as any,
    tags: overrides.tags ?? [],
  };
}

describe("TranslationMemory", () => {
  let tm: TranslationMemory;
  let storage: InMemoryStorageProvider;

  beforeEach(() => {
    storage = new InMemoryStorageProvider();
    tm = new TranslationMemory(storage);
  });

  it("starts empty", async () => {
    await tm.initialize();
    expect(tm.getEntryCount()).toBe(0);
  });

  it("stores and retrieves entries by original text", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello", fslGloss: "HELLO", usageCount: 1 }));
    await tm.addEntry(makeEntry({ id: "2", originalText: "thank you", fslGloss: "THANK YOU", usageCount: 1 }));

    expect(tm.getEntryCount()).toBe(2);

    const result = await tm.lookup("hello");
    expect(result).not.toBeNull();
    expect(result!.fslGloss).toBe("HELLO");
  });

  it("returns null for unknown text", async () => {
    await tm.initialize();
    const result = await tm.lookup("unknown text");
    expect(result).toBeNull();
  });

  it("increases usage count on lookup", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello", usageCount: 0 }));

    await tm.lookup("hello");
    await tm.lookup("hello");

    const entry = await tm.lookup("hello");
    expect(entry!.usageCount).toBe(3);
  });

  it("merges entries with same original text", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello", usageCount: 1, averageConfidence: 0.8 }));
    await tm.addEntry(makeEntry({ id: "2", originalText: "hello", usageCount: 1, averageConfidence: 0.9 }));

    expect(tm.getEntryCount()).toBe(1);
    expect((await tm.lookup("hello"))!.averageConfidence).toBeCloseTo(0.85, 2);
  });

  it("evicts oldest entry when cache is full", async () => {
    await tm.initialize();
    for (let i = 0; i < 1001; i++) {
      await tm.addEntry(makeEntry({
        id: `e${i}`,
        originalText: `text-${i}`,
        usageCount: 0,
        lastUsedAt: i < 1000 ? 1000 : Date.now(),
      }));
    }
    expect(tm.getEntryCount()).toBeLessThanOrEqual(1000);
  });

  it("records administration corrections", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello" }));
    await tm.recordCorrection("hello", "formal greeting");
    const entry = await tm.lookup("hello");
    expect(entry!.administratorCorrections).toContain("formal greeting");
  });

  it("looks up by gloss", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello", fslGloss: "HELLO" }));
    await tm.addEntry(makeEntry({ id: "2", originalText: "hi", fslGloss: "HELLO" }));
    const results = await tm.lookupByGloss("HELLO");
    expect(results).toHaveLength(2);
  });

  it("provides stats", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello", detectedLanguage: "en", fslGloss: "HELLO", usageCount: 5 }));
    await tm.addEntry(makeEntry({ id: "2", originalText: "kumusta", detectedLanguage: "tl", fslGloss: "HELLO", usageCount: 3 }));

    await tm.lookup("hello");

    const stats = tm.getStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalLookups).toBe(1);
    expect(stats.cacheHitRate).toBe(1);
    expect(stats.languageBreakdown.en).toBe(1);
    expect(stats.languageBreakdown.tl).toBe(1);
  });

  it("filters by query", async () => {
    await tm.initialize();
    await tm.addEntry(makeEntry({ id: "1", originalText: "hello", detectedLanguage: "en", fslGloss: "HELLO", usageCount: 5 }));
    await tm.addEntry(makeEntry({ id: "2", originalText: "kumusta", detectedLanguage: "tl", fslGloss: "MABUTI", usageCount: 3 }));

    const enResults = await tm.query({ language: "en" });
    expect(enResults).toHaveLength(1);
    expect(enResults[0].originalText).toBe("hello");
  });

  it("returns frequent entries", async () => {
    await tm.initialize();
    for (let i = 0; i < 10; i++) {
      await tm.addEntry(makeEntry({ id: `e${i}`, originalText: `text-${i}`, usageCount: i }));
    }
    const frequent = tm.getFrequentEntries(5);
    expect(frequent.length).toBeGreaterThanOrEqual(5);
  });
});
