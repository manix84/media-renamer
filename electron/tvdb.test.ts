import { describe, expect, it, vi } from 'vitest';
import { TvdbClient } from './tvdb.js';

describe('TVDB adapter', () => {
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
});
