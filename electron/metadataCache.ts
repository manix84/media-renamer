import fs from 'node:fs';
import { writeJsonAtomically } from './atomicJson.js';

type CacheEntry = { storedAt: number; value: unknown };
type CacheFile = { version: 1; entries: Record<string, CacheEntry> };

export class MetadataCache {
  private entries: Record<string, CacheEntry> | undefined;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private writeQueue = Promise.resolve();

  constructor(private readonly filePath: string, private readonly now: () => number = Date.now, private readonly maximumEntries = 1500) {}

  async get<T>(key: string, maxAgeMilliseconds: number, load: () => Promise<T>): Promise<T> {
    await this.load();
    const cached = this.entries![key];
    if (cached && this.now() - cached.storedAt <= maxAgeMilliseconds) return cached.value as T;
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const request = load().then(async (value) => {
      this.entries![key] = { storedAt: this.now(), value };
      this.prune();
      await this.persist().catch(() => undefined);
      return value;
    }).catch((error) => {
      if (cached) return cached.value as T;
      throw error;
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async load(): Promise<void> {
    if (this.entries) return;
    try {
      const parsed = JSON.parse(await fs.promises.readFile(this.filePath, 'utf8')) as Partial<CacheFile>;
      this.entries = parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
    } catch {
      this.entries = {};
    }
  }

  private prune(): void {
    const entries = Object.entries(this.entries!);
    if (entries.length <= this.maximumEntries) return;
    entries.sort((left, right) => right[1].storedAt - left[1].storedAt);
    this.entries = Object.fromEntries(entries.slice(0, this.maximumEntries));
  }

  private async persist(): Promise<void> {
    const snapshot: CacheFile = { version: 1, entries: { ...this.entries } };
    this.writeQueue = this.writeQueue.catch(() => undefined).then(() => writeJsonAtomically(this.filePath, snapshot));
    await this.writeQueue;
  }
}
