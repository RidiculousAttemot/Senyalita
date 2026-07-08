import type { TranslationMemoryEntry } from "./types";

export class FileStorageProvider {
  private filePath: string;
  private cache: TranslationMemoryEntry[] | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<TranslationMemoryEntry[]> {
    if (this.cache) return this.cache;

    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(content);
      this.cache = Array.isArray(parsed) ? parsed : [];
      return this.cache;
    } catch {
      this.cache = [];
      return [];
    }
  }

  async save(entries: TranslationMemoryEntry[]): Promise<void> {
    this.cache = entries;
    try {
      const fs = await import("fs/promises");
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf("/"));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save translation memory:", err);
    }
  }

  async append(entry: TranslationMemoryEntry): Promise<void> {
    const entries = await this.load();
    entries.push(entry);
    this.cache = entries;
    try {
      const fs = await import("fs/promises");
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf("/"));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to append to translation memory:", err);
    }
  }
}

export class InMemoryStorageProvider {
  private entries: TranslationMemoryEntry[] = [];

  constructor(initialEntries: TranslationMemoryEntry[] = []) {
    this.entries = initialEntries;
  }

  async load(): Promise<TranslationMemoryEntry[]> {
    return this.entries;
  }

  async save(entries: TranslationMemoryEntry[]): Promise<void> {
    this.entries = entries;
  }

  async append(entry: TranslationMemoryEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class LocalStorageProvider {
  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  async load(): Promise<TranslationMemoryEntry[]> {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async save(entries: TranslationMemoryEntry[]): Promise<void> {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch (err) {
      console.error("Failed to save to localStorage:", err);
    }
  }

  async append(entry: TranslationMemoryEntry): Promise<void> {
    const entries = await this.load();
    entries.push(entry);
    await this.save(entries);
  }
}

export function createDefaultStorage(filePath = "data/translation-memory/translations.json"): FileStorageProvider {
  return new FileStorageProvider(filePath);
}

export function createClientStorage(): LocalStorageProvider {
  return new LocalStorageProvider("fsl_translation_memory");
}
