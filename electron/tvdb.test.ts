import { describe, expect, it, vi } from 'vitest';
import { selectTvdbSeriesMatch, TvdbClient } from './tvdb.js';

describe('TVDB adapter', () => {
  it('selects a unique normalized title and prefers the requested year', () => {
    const candidates = [
      { id: '1', name: 'The Great British Bake Off', year: 2010 },
      { id: '2', name: 'The Great British Bake-Off', year: 2025 },
      { id: '3', name: 'Bake Off: The Professionals', year: 2016 },
    ];
    expect(selectTvdbSeriesMatch(candidates, 'The Great British Bake Off', 2010)?.id).toBe('1');
    expect(selectTvdbSeriesMatch(candidates, 'Unknown Bake Off', 2010)).toBeUndefined();
  });

  it('authenticates once and resolves a series ID', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: 'bearer-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 482771, name: 'Archive X: Unexplained Phenomena ', year: '2026', remoteIds: [{ id: '334779', sourceName: 'TheMovieDB.com' }] } }), { status: 200 }));
    const client = new TvdbClient('api-key', 'subscriber-pin', fetcher);
    await expect(client.getSeries('482771')).resolves.toEqual({ id: '482771', name: 'Archive X: Unexplained Phenomena', year: 2026, tmdbId: '334779' });
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ apikey: 'api-key', pin: 'subscriber-pin' });
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ authorization: 'Bearer bearer-token' });
  });

  it('searches TVDB series aliases', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: 'bearer-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ tvdb_id: '473125', name: 'Mouse Cursor', year: '2026' }] }), { status: 200 }));
    await expect(new TvdbClient('api-key', undefined, fetcher).searchSeries('Click Me All Over')).resolves.toEqual([{ id: '473125', name: 'Mouse Cursor', year: 2026 }]);
  });

  it('loads every page of English episodes in TVDB aired order', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: 'bearer-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { episodes: [{ id: 12, seasonNumber: 1, number: 2, absoluteNumber: 26, name: ' Second ', aired: '1987-10-05', runtime: 45 }] },
        links: { next: '/v4/series/71470/episodes/official/eng?page=1' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { episodes: [{ id: 11, seasonNumber: 1, number: 1, name: 'First', aired: '1987-09-28' }] },
        links: { next: null },
      }), { status: 200 }));

    await expect(new TvdbClient('api-key', undefined, fetcher).getSeriesEpisodes('71470')).resolves.toEqual([
      { id: '11', season: 1, number: 1, title: 'First', airDate: '1987-09-28' },
      { id: '12', season: 1, number: 2, absoluteNumber: 26, title: 'Second', airDate: '1987-10-05', runtimeMinutes: 45 },
    ]);
    expect(fetcher.mock.calls[1][0]).toBe('https://api4.thetvdb.com/v4/series/71470/episodes/official/eng?page=0');
    expect(fetcher.mock.calls[2][0]).toBe('https://api4.thetvdb.com/v4/series/71470/episodes/official/eng?page=1');
  });
});
