import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publishRenameStatistics, recordCompletedRename } from './renameStatistics';

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))));

describe('rename statistics', () => {
  it('aggregates show episodes, subtitles, recency, and top shows', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-statistics-'));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'statistics.json');
    await recordCompletedRename(filePath, 'shows', ['/TV/Example/Season 1/Example - S01E01.mkv', '/TV/Example/Season 1/Example - S01E01.en.srt'], new Date('2026-10-30T10:00:00Z'));
    const result = await recordCompletedRename(filePath, 'shows', ['/TV/Example/Season 1/Example - S01E02.mkv'], new Date('2026-10-31T10:00:00Z'));
    expect(result.totals).toMatchObject({ operations: 2, files: 3, videos: 2, episodes: 2, shows: 1, subtitles: 1 });
    expect(result.topShows[0]).toMatchObject({ name: 'Example', count: 2, lastSortedAt: '2026-10-31T10:00:00.000Z' });
  });

  it('publishes bounded Home Assistant sensor states without exposing paths', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), body: String(init?.body) });
      return new Response('', { status: 201 });
    }) as typeof fetch;
    await publishRenameStatistics({ baseUrl: 'http://homeassistant.local:8123', token: 'secret', entityPrefix: 'media_renamer' }, {
      version: 1, updatedAt: '2026-10-31T10:00:00.000Z', totals: { operations: 1, files: 2, videos: 1, movies: 1, episodes: 0, shows: 0, subtitles: 1 }, shows: {}, movies: {}, topShows: [], recentShows: [], recentMovies: [],
    }, fetcher);
    expect(calls).toHaveLength(8);
    expect(calls[0].url).toBe('http://homeassistant.local:8123/api/states/sensor.media_renamer_files_renamed');
    expect(calls.map((call) => call.body).join(' ')).not.toContain('/TV/');
  });
});
