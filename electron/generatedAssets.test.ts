import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeGeneratedAssets, stageGeneratedAssets } from './generatedAssets';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.promises.rm(root, { recursive: true, force: true }))));

describe('generated metadata assets', () => {
  it('rejects unsafe destinations and artwork hosts', () => {
    expect(() => normalizeGeneratedAssets([{ targetPath: 'movie.nfo', content: '<movie/>' }])).toThrow(/destination/);
    expect(() => normalizeGeneratedAssets([{ targetPath: '/Movies/poster.jpg', url: 'https://example.com/poster.jpg' }])).toThrow(/host/);
  });

  it('stages UTF-8 NFO and provider artwork for transactional moving', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-assets-'));
    roots.push(root);
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const staged = await stageGeneratedAssets([
      { targetPath: '/Movies/Film/movie.nfo', content: '<movie>Résumé</movie>', groupIndex: 2 },
      { targetPath: '/Movies/Film/poster.jpg', url: 'https://image.tmdb.org/poster.jpg' },
    ], root, fetcher as typeof fetch);
    expect(await fs.promises.readFile(staged[0].sourcePath, 'utf8')).toContain('Résumé');
    expect(staged[0].groupIndex).toBe(2);
    expect([...await fs.promises.readFile(staged[1].sourcePath)]).toEqual([1, 2, 3]);
  });

  it('rejects an invalid movie group association', () => {
    expect(() => normalizeGeneratedAssets([{ targetPath: '/Movies/Film/movie.nfo', content: '<movie/>', groupIndex: -1 }])).toThrow(/group/);
    expect(() => normalizeGeneratedAssets([{ targetPath: '/Movies/Film/movie.nfo', content: '<movie/>', groupIndex: 1.5 }])).toThrow(/group/);
  });

  it('preserves an existing local asset instead of creating a numbered Plex-invalid name', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-assets-'));
    roots.push(root);
    const existing = path.join(root, 'poster.jpg');
    await fs.promises.writeFile(existing, 'mine');
    await expect(stageGeneratedAssets([{ targetPath: existing, url: 'https://image.tmdb.org/poster.jpg' }], root, vi.fn() as typeof fetch)).resolves.toEqual([]);
    await expect(fs.promises.readFile(existing, 'utf8')).resolves.toBe('mine');
  });
});
