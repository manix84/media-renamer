import { describe, expect, it, vi } from 'vitest';
import { normalizeShow, TmdbClient } from './tmdb.js';

describe('TMDB adapter', () => {
  it('normalizes provider-specific show fields', () => {
    expect(normalizeShow({ id: 42, name: 'Example', first_air_date: '1999-01-25', overview: 'A show', poster_path: '/poster.jpg' })).toEqual({
      id: '42', name: 'Example', year: 1999, overview: 'A show', posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
    });
  });

  it('authenticates with the read access token and normalizes episodes', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ episodes: [{ id: 7, season_number: 1, episode_number: 2, name: 'Second', air_date: '2020-01-02' }] }), { status: 200 }));
    const client = new TmdbClient('secret-token', fetcher);
    await expect(client.getSeasonEpisodes('123', 1)).resolves.toEqual([{ id: '7', season: 1, number: 2, title: 'Second', airDate: '2020-01-02' }]);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer secret-token' }) }));
  });

  it('resolves a TVDB-prefixed ID through TMDB external IDs', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tv_results: [{ id: 99, name: 'External Show', first_air_date: '2001-01-01' }] }), { status: 200 }));
    const results = await new TmdbClient('token', fetcher).searchShows('tvdb-48271');
    expect(results[0]).toMatchObject({ id: '99', name: 'External Show', year: 2001 });
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/3/find/48271');
    expect(url.searchParams.get('external_source')).toBe('tvdb_id');
  });

  it('resolves a TMDB-prefixed ID directly', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42, name: 'Direct Show' }), { status: 200 }));
    const results = await new TmdbClient('token', fetcher).searchShows('tmdb-42');
    expect(results[0]).toMatchObject({ id: '42', name: 'Direct Show' });
    expect((fetcher.mock.calls[0][0] as URL).pathname).toBe('/3/tv/42');
  });

  it('tries a literal dated title before using its year as a secondary field', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [
        { id: 1, name: 'Other', first_air_date: '1999-01-01' },
        { id: 2, name: 'Sealab 2021', first_air_date: '2000-12-21' },
      ] }), { status: 200 }));
    const results = await new TmdbClient('token', fetcher).searchShows('Sealab 2021 (2000)');

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[0][0] as URL).searchParams.get('query')).toBe('Sealab 2021 (2000)');
    const fallbackUrl = fetcher.mock.calls[1][0] as URL;
    expect(fallbackUrl.searchParams.get('query')).toBe('Sealab 2021');
    expect(fallbackUrl.searchParams.get('first_air_date_year')).toBe('2000');
    expect(results[0]).toMatchObject({ name: 'Sealab 2021', year: 2000 });
  });

  it('does not split a dated title when the literal search succeeds', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ id: 3, name: 'Literal (2000)', first_air_date: '2024-01-01' }] }), { status: 200 }));
    const results = await new TmdbClient('token', fetcher).searchShows('Literal (2000)');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results[0]?.name).toBe('Literal (2000)');
  });
});
