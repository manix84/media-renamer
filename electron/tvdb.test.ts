import { describe, expect, it, vi } from 'vitest';
import { directTvdbShow, directTvdbShowDetails, selectTvdbSeriesMatch, TvdbClient, tvdbArtworkUrl, tvdbLanguageCode } from './tvdb.js';

describe('TVDB adapter', () => {
  it('maps application languages to TVDB translation languages', () => {
    expect(tvdbLanguageCode('en')).toBe('eng');
    expect(tvdbLanguageCode('pt-BR')).toBe('por');
    expect(tvdbLanguageCode('ja')).toBe('jpn');
    expect(tvdbLanguageCode('jpn')).toBe('jpn');
  });
  it('normalizes relative artwork paths and rejects unrelated hosts', () => {
    expect(tvdbArtworkUrl('/banners/v4/episode/example.jpg')).toBe('https://artworks.thetvdb.com/banners/v4/episode/example.jpg');
    expect(tvdbArtworkUrl('https://artworks.thetvdb.com/banners/example.jpg')).toBe('https://artworks.thetvdb.com/banners/example.jpg');
    expect(tvdbArtworkUrl('https://example.com/image.jpg')).toBeUndefined();
  });
  it('creates selectable show metadata without a TMDB counterpart', () => {
    const series = { id: '81251', name: 'Pixar Short Films', year: 1984, overview: 'Pixar shorts.', imageUrl: 'https://artworks.thetvdb.com/poster.jpg' };
    expect(directTvdbShow(series)).toEqual({
      id: 'tvdb-81251', tvdbId: '81251', name: 'Pixar Short Films', year: 1984, overview: 'Pixar shorts.', posterUrl: 'https://artworks.thetvdb.com/poster.jpg',
    });
    expect(directTvdbShowDetails(series, [
      { id: '1', season: 0, number: 1, title: 'Special', airDate: '1984-01-01' },
      { id: '2', season: 1, number: 1, title: 'First', airDate: '1986-01-01' },
      { id: '3', season: 1, number: 2, title: 'Second' },
    ])).toMatchObject({
      id: 'tvdb-81251', tvdbId: '81251',
      seasons: [
        { number: 0, name: 'Specials', episodeCount: 1, airDate: '1984-01-01' },
        { number: 1, name: 'Season 1', episodeCount: 2, airDate: '1986-01-01' },
      ],
    });
  });

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
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 482771, name: 'Archive X: Unexplained Phenomena ', year: '2026', overview: ' An archive series. ', image: 'https://artworks.thetvdb.com/poster.jpg', originalLanguage: 'ja', remoteIds: [{ id: '334779', sourceName: 'TheMovieDB.com' }] } }), { status: 200 }));
    const client = new TvdbClient('api-key', 'subscriber-pin', fetcher);
    await expect(client.getSeries('482771')).resolves.toEqual({ id: '482771', name: 'Archive X: Unexplained Phenomena', year: 2026, tmdbId: '334779', overview: 'An archive series.', imageUrl: 'https://artworks.thetvdb.com/poster.jpg', originalLanguage: 'jpn' });
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ apikey: 'api-key', pin: 'subscriber-pin' });
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ authorization: 'Bearer bearer-token' });
  });

  it('searches TVDB series aliases', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: 'bearer-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ tvdb_id: '473125', name: 'マウスカーソル', year: '2026', overview: ' Native overview. ', image: '/banners/mouse.jpg', remote_ids: [{ id: '1234', sourceName: 'TheMovieDB.com' }] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { name: 'Mouse Cursor', overview: ' A pointer story. ' } }), { status: 200 }));
    await expect(new TvdbClient('api-key', undefined, fetcher).searchSeries('Click Me All Over', 'fra')).resolves.toEqual([{
      id: '473125', name: 'Mouse Cursor', year: 2026, tmdbId: '1234', overview: 'A pointer story.', imageUrl: 'https://artworks.thetvdb.com/banners/mouse.jpg',
    }]);
    expect(new URL(fetcher.mock.calls[1][0] as string).searchParams.get('language')).toBe('fra');
    expect(fetcher.mock.calls[2][0]).toBe('https://api4.thetvdb.com/v4/series/473125/translations/fra');
  });

  it('uses a requested series translation and falls back to the native title when absent', async () => {
    const translatedFetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: 'bearer-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 471791, name: '大きい女の子は好きですか?', year: '2026', originalLanguage: 'jpn' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { name: 'Do You Like Big Girls?' } }), { status: 200 }));
    await expect(new TvdbClient('api-key', undefined, translatedFetcher).getSeries('471791', 'eng')).resolves.toMatchObject({ name: 'Do You Like Big Girls?', originalLanguage: 'jpn' });

    const nativeFetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: 'bearer-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 471791, name: '大きい女の子は好きですか?', year: '2026' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(new TvdbClient('api-key', undefined, nativeFetcher).getSeries('471791', 'eng')).resolves.toMatchObject({ name: '大きい女の子は好きですか?' });
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
