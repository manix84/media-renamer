import { describe, expect, it, vi } from 'vitest';
import { normalizeMovie, normalizeShow, TmdbClient } from './tmdb.js';

describe('TMDB adapter', () => {
  it('normalizes provider-specific show fields', () => {
    expect(normalizeShow({ id: 42, name: 'Example', first_air_date: '1999-01-25', overview: 'A show', poster_path: '/poster.jpg' })).toEqual({
      id: '42', name: 'Example', year: 1999, overview: 'A show', posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
    });
  });

  it('searches and loads movie metadata with preferred artwork', async () => {
    expect(normalizeMovie({ id: 335984, title: 'Blade Runner 2049', release_date: '2017-10-04', overview: 'A movie', poster_path: '/movie.jpg' })).toMatchObject({
      id: '335984', name: 'Blade Runner 2049', year: 2017, posterUrl: 'https://image.tmdb.org/t/p/w342/movie.jpg',
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 335984, title: 'Blade Runner 2049', release_date: '2017-10-04' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 335984, title: 'Blade Runner 2049', release_date: '2017-10-04', runtime: 164, external_ids: { imdb_id: 'tt1856101' }, images: { logos: [{ file_path: '/logo.png', iso_639_1: 'en' }] } }), { status: 200 }));
    const client = new TmdbClient('token', fetcher);
    await expect(client.searchMovies('Blade Runner 2049 (2017)')).resolves.toEqual([expect.objectContaining({ id: '335984', year: 2017 })]);
    await expect(client.getMovie('335984')).resolves.toMatchObject({ id: '335984', imdbId: 'tt1856101', runtimeMinutes: 164, logoUrl: 'https://image.tmdb.org/t/p/w500/logo.png' });
    const searchUrl = fetcher.mock.calls[0][0] as URL;
    expect(searchUrl.pathname).toBe('/3/search/movie');
    expect(searchUrl.searchParams.get('query')).toBe('Blade Runner 2049');
    expect(searchUrl.searchParams.get('year')).toBe('2017');
    const detailsUrl = fetcher.mock.calls[1][0] as URL;
    expect(detailsUrl.searchParams.get('append_to_response')).toBe('external_ids,images');
  });

  it('resolves prefixed and bare IMDb movie IDs through TMDB external IDs', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ movie_results: [{ id: 861, title: 'Total Recall', release_date: '1990-06-01' }] }), { status: 200 })));
    const client = new TmdbClient('token', fetcher);
    await expect(client.searchMovies('imdb-tt0099864')).resolves.toEqual([expect.objectContaining({ id: '861', imdbId: 'tt0099864', name: 'Total Recall', year: 1990 })]);
    await expect(client.searchMovies('TT0099864')).resolves.toEqual([expect.objectContaining({ id: '861', imdbId: 'tt0099864' })]);
    for (const call of fetcher.mock.calls) {
      const url = call[0] as URL;
      expect(url.pathname).toBe('/3/find/tt0099864');
      expect(url.searchParams.get('external_source')).toBe('imdb_id');
    }
  });

  it('falls back to an exact TV miniseries when no exact movie title and year exists', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 123781, title: 'Strike It Rich', release_date: '1990-01-01' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 19614, name: 'It', first_air_date: '1990-11-18' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 19614, name: 'It', first_air_date: '1990-11-18', external_ids: { imdb_id: 'tt0099864' } }), { status: 200 }));
    const client = new TmdbClient('token', fetcher);
    const results = await client.searchMovies('It (1990)');
    expect(results[0]).toMatchObject({ id: '19614', mediaType: 'tv', name: 'It', year: 1990 });
    await expect(client.getMovie(results[0].id, results[0].mediaType)).resolves.toMatchObject({ id: '19614', mediaType: 'tv', imdbId: 'tt0099864' });
    expect((fetcher.mock.calls[0][0] as URL).pathname).toBe('/3/search/movie');
    expect((fetcher.mock.calls[1][0] as URL).pathname).toBe('/3/search/tv');
    expect((fetcher.mock.calls[1][0] as URL).searchParams.get('first_air_date_year')).toBe('1990');
    expect((fetcher.mock.calls[2][0] as URL).pathname).toBe('/3/tv/19614');
  });

  it('authenticates with the read access token and normalizes episodes', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ episodes: [{ id: 7, season_number: 1, episode_number: 2, name: 'Second', air_date: '2020-01-02', runtime: 52 }] }), { status: 200 }));
    const client = new TmdbClient('secret-token', fetcher);
    await expect(client.getSeasonEpisodes('123', 1)).resolves.toEqual([{ id: '7', season: 1, number: 2, title: 'Second', airDate: '2020-01-02', runtimeMinutes: 52 }]);
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer secret-token' }) }));
  });

  it('loads the TVDB cross-reference and preferred clear logo with show details', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 42,
      name: 'Example',
      seasons: [],
      external_ids: { tvdb_id: 74550 },
      images: { logos: [
        { file_path: '/untranslated.png', iso_639_1: null, vote_average: 9, width: 1000 },
        { file_path: '/english.png', iso_639_1: 'en', vote_average: 7, width: 800 },
      ] },
    }), { status: 200 }));
    const details = await new TmdbClient('token', fetcher).getShow('42');
    expect(details.tvdbId).toBe('74550');
    expect(details.logoUrl).toBe('https://image.tmdb.org/t/p/w500/english.png');
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.pathname).toBe('/3/tv/42');
    expect(url.searchParams.get('append_to_response')).toBe('external_ids,images');
    expect(url.searchParams.get('include_image_language')).toBe('en,null');
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

  it('uses a bare trailing year as a fallback when the literal title has no results', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 4, name: 'The IT Crowd', first_air_date: '2006-02-03' }] }), { status: 200 }));
    const results = await new TmdbClient('token', fetcher).searchShows('The IT Crowd 2006');

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[0][0] as URL).searchParams.get('query')).toBe('The IT Crowd 2006');
    const fallbackUrl = fetcher.mock.calls[1][0] as URL;
    expect(fallbackUrl.searchParams.get('query')).toBe('The IT Crowd');
    expect(fallbackUrl.searchParams.get('first_air_date_year')).toBe('2006');
    expect(results[0]).toMatchObject({ name: 'The IT Crowd', year: 2006 });
  });

  it('keeps a successful literal title that ends in a year', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ id: 5, name: 'Sealab 2021', first_air_date: '2000-12-21' }] }), { status: 200 }));
    const results = await new TmdbClient('token', fetcher).searchShows('Sealab 2021');

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results[0]?.name).toBe('Sealab 2021');
  });

  it('finds a long punctuation-sensitive title through shorter title segments', async () => {
    const fullTitle = 'Now That I Can Control Reality With A Mouse Cursor Im Gonna Click Away On The Girls';
    const canonicalTitle = "Now That I Can Control Reality With A Mouse Cursor, I'm Gonna Click Away On The Girls!";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 1, name: 'Weak Unrelated Result' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 90, name: canonicalTitle, first_air_date: '2026-10-04' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }));

    const results = await new TmdbClient('token', fetcher).searchShows(fullTitle);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect((fetcher.mock.calls[1][0] as URL).searchParams.get('query')).toBe('Now That I Can Control Reality With A Mouse Cursor');
    expect(results[0]).toMatchObject({ id: '90', name: canonicalTitle, year: 2026 });
  });
});
