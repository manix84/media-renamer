import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetadataCache } from './metadataCache';

const temporaryDirectories: string[] = [];
async function cachePath() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-cache-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'metadata.json');
}
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))));

describe('metadata cache', () => {
  it('persists fresh values and reuses them across cache instances', async () => {
    const filePath = await cachePath();
    const loader = vi.fn(async () => ({ name: 'Star Trek: The Next Generation' }));
    await expect(new MetadataCache(filePath, () => 1000).get('show:1', 5000, loader)).resolves.toEqual({ name: 'Star Trek: The Next Generation' });
    await expect(new MetadataCache(filePath, () => 2000).get('show:1', 5000, loader)).resolves.toEqual({ name: 'Star Trek: The Next Generation' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('refreshes expired values', async () => {
    const filePath = await cachePath();
    await new MetadataCache(filePath, () => 1000).get('show:1', 500, async () => 'old');
    await expect(new MetadataCache(filePath, () => 2000).get('show:1', 500, async () => 'new')).resolves.toBe('new');
  });

  it('falls back to stale metadata when its provider is unavailable', async () => {
    const filePath = await cachePath();
    await new MetadataCache(filePath, () => 1000).get('episodes:1', 500, async () => ['cached']);
    await expect(new MetadataCache(filePath, () => 2000).get('episodes:1', 500, async () => { throw new Error('offline'); })).resolves.toEqual(['cached']);
  });

  it('recovers from a corrupt cache file', async () => {
    const filePath = await cachePath();
    await fs.promises.writeFile(filePath, '{broken');
    await expect(new MetadataCache(filePath).get('movie:1', 5000, async () => ({ name: 'Arrival' }))).resolves.toEqual({ name: 'Arrival' });
    await expect(fs.promises.readFile(filePath, 'utf8')).resolves.toContain('Arrival');
  });
});
