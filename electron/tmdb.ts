const API_ROOT = 'https://api.themoviedb.org/3';
const IMAGE_ROOT = 'https://image.tmdb.org/t/p/w342';
const LOGO_ROOT = 'https://image.tmdb.org/t/p/w500';

export interface TmdbShowSearchResult {
  id: string;
  tvdbId?: string;
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
  logoUrl?: string;
}

export interface TmdbSeasonSummary {
  number: number;
  name: string;
  episodeCount: number;
  airDate?: string;
}

export interface TmdbShowDetails extends TmdbShowSearchResult {
  seasons: TmdbSeasonSummary[];
}

export interface TmdbEpisode {
  id: string;
  season: number;
  number: number;
  title: string;
  airDate?: string;
}

export interface TmdbMovieSearchResult {
  id: string;
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
  logoUrl?: string;
}

type RawShow = {
  id: number;
  name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
};

type RawMovie = {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
};

type RawExternalIds = { tvdb_id?: number | null };
type RawImage = { file_path: string; iso_639_1?: string | null; vote_average?: number; width?: number };

type RawSeason = {
  season_number: number;
  name: string;
  episode_count: number;
  air_date?: string | null;
};

type RawEpisode = {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  air_date?: string | null;
};

function optionalDate(value?: string | null): string | undefined {
  return value || undefined;
}

export function normalizeShow(show: RawShow): TmdbShowSearchResult {
  const year = show.first_air_date ? Number(show.first_air_date.slice(0, 4)) : undefined;
  return {
    id: String(show.id),
    name: show.name,
    year: Number.isFinite(year) ? year : undefined,
    overview: show.overview ?? '',
    posterUrl: show.poster_path ? `${IMAGE_ROOT}${show.poster_path}` : undefined,
  };
}

export function normalizeMovie(movie: RawMovie): TmdbMovieSearchResult {
  const year = movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined;
  return {
    id: String(movie.id),
    name: movie.title,
    year: Number.isFinite(year) ? year : undefined,
    overview: movie.overview ?? '',
    posterUrl: movie.poster_path ? `${IMAGE_ROOT}${movie.poster_path}` : undefined,
  };
}

function titleWords(value: string): string[] {
  return value.normalize('NFKD').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function titleSimilarity(query: string, candidate: string): number {
  const queryWords = new Set(titleWords(query));
  const candidateWords = new Set(titleWords(candidate));
  if (!queryWords.size || !candidateWords.size) return 0;
  const shared = [...queryWords].filter((word) => candidateWords.has(word)).length;
  return (2 * shared) / (queryWords.size + candidateWords.size);
}

function longTitleFallbacks(query: string): string[] {
  const words = query.trim().split(/\s+/);
  if (words.length < 10) return [];
  return [words.slice(0, 10).join(' '), words.slice(-10).join(' ')].filter((value, index, values) => value !== query && values.indexOf(value) === index);
}

function mergeAndRank(query: string, groups: TmdbShowSearchResult[][]): TmdbShowSearchResult[] {
  const unique = new Map<string, TmdbShowSearchResult>();
  for (const result of groups.flat()) if (!unique.has(result.id)) unique.set(result.id, result);
  return [...unique.values()]
    .sort((left, right) => titleSimilarity(query, right.name) - titleSimilarity(query, left.name))
    .slice(0, 10);
}

export class TmdbClient {
  constructor(private readonly accessToken: string, private readonly fetcher: typeof fetch = fetch) {}

  private async request<T>(pathname: string, params?: URLSearchParams): Promise<T> {
    const url = new URL(`${API_ROOT}${pathname}`);
    if (params) url.search = params.toString();
    const response = await this.fetcher(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('TMDB rejected the access token. Check TMDB_ACCESS_TOKEN in .env.');
      throw new Error(`TMDB request failed (${response.status}).`);
    }
    return response.json() as Promise<T>;
  }

  private async searchByTitle(query: string, year?: string): Promise<TmdbShowSearchResult[]> {
    const params = new URLSearchParams({ query, include_adult: 'false' });
    if (year) params.set('first_air_date_year', year);
    const data = await this.request<{ results: RawShow[] }>('/search/tv', params);
    const results = data.results.map(normalizeShow);
    return year
      ? results.sort((left, right) => Number(right.year === Number(year)) - Number(left.year === Number(year))).slice(0, 10)
      : results.slice(0, 10);
  }

  async searchShows(query: string): Promise<TmdbShowSearchResult[]> {
    const tvdbId = query.match(/^tvdb-(\d+)$/i)?.[1];
    if (tvdbId) {
      const data = await this.request<{ tv_results: RawShow[] }>(`/find/${tvdbId}`, new URLSearchParams({ external_source: 'tvdb_id' }));
      return data.tv_results.map(normalizeShow);
    }

    const tmdbId = query.match(/^tmdb-(\d+)$/i)?.[1];
    if (tmdbId) return [normalizeShow(await this.request<RawShow>(`/tv/${tmdbId}`))];

    const literalResults = await this.searchByTitle(query);
    const strongestLiteralMatch = Math.max(0, ...literalResults.map((result) => titleSimilarity(query, result.name)));
    if (literalResults.length && strongestLiteralMatch >= 0.72) return literalResults;

    const datedTitle = query.match(/^(.*\S)\s+\(((?:19|20)\d{2})\)$/)
      ?? query.match(/^(.*\S)\s+((?:19|20)\d{2})$/);
    if (datedTitle && !literalResults.length) return this.searchByTitle(datedTitle[1], datedTitle[2]);

    const fallbackQueries = longTitleFallbacks(query);
    if (!fallbackQueries.length) return literalResults;
    const fallbackResults = await Promise.all(fallbackQueries.map((fallback) => this.searchByTitle(fallback)));
    return mergeAndRank(query, [literalResults, ...fallbackResults]);
  }

  async searchMovies(query: string): Promise<TmdbMovieSearchResult[]> {
    const tmdbId = query.match(/^tmdb-(\d+)$/i)?.[1];
    if (tmdbId) return [normalizeMovie(await this.request<RawMovie>(`/movie/${tmdbId}`))];
    const datedTitle = query.match(/^(.*\S)\s+\(((?:19|20)\d{2})\)$/);
    const params = new URLSearchParams({ query: datedTitle?.[1] ?? query, include_adult: 'false' });
    if (datedTitle) params.set('year', datedTitle[2]);
    const data = await this.request<{ results: RawMovie[] }>('/search/movie', params);
    return data.results.map(normalizeMovie)
      .sort((left, right) => Number(right.year === Number(datedTitle?.[2])) - Number(left.year === Number(datedTitle?.[2])))
      .slice(0, 10);
  }

  async getMovie(movieId: string): Promise<TmdbMovieSearchResult> {
    const data = await this.request<RawMovie & { images?: { logos?: RawImage[] } }>(
      `/movie/${encodeURIComponent(movieId)}`,
      new URLSearchParams({ append_to_response: 'images', include_image_language: 'en,null' }),
    );
    const logo = data.images?.logos?.slice().sort((left, right) => Number(right.iso_639_1 === 'en') - Number(left.iso_639_1 === 'en') || (right.vote_average ?? 0) - (left.vote_average ?? 0) || (right.width ?? 0) - (left.width ?? 0))[0];
    return { ...normalizeMovie(data), logoUrl: logo ? `${LOGO_ROOT}${logo.file_path}` : undefined };
  }

  async getShow(showId: string): Promise<TmdbShowDetails> {
    const data = await this.request<RawShow & { seasons: RawSeason[]; external_ids?: RawExternalIds; images?: { logos?: RawImage[] } }>(
      `/tv/${encodeURIComponent(showId)}`,
      new URLSearchParams({ append_to_response: 'external_ids,images', include_image_language: 'en,null' }),
    );
    const logo = data.images?.logos?.slice().sort((left, right) => Number(right.iso_639_1 === 'en') - Number(left.iso_639_1 === 'en') || (right.vote_average ?? 0) - (left.vote_average ?? 0) || (right.width ?? 0) - (left.width ?? 0))[0];
    return {
      ...normalizeShow(data),
      logoUrl: logo ? `${LOGO_ROOT}${logo.file_path}` : undefined,
      tvdbId: data.external_ids?.tvdb_id ? String(data.external_ids.tvdb_id) : undefined,
      seasons: data.seasons
        .filter((season) => season.episode_count > 0)
        .map((season) => ({
          number: season.season_number,
          name: season.name,
          episodeCount: season.episode_count,
          airDate: optionalDate(season.air_date),
        })),
    };
  }

  async getSeasonEpisodes(showId: string, season: number): Promise<TmdbEpisode[]> {
    const data = await this.request<{ episodes: RawEpisode[] }>(`/tv/${encodeURIComponent(showId)}/season/${season}`);
    return data.episodes.map((episode) => ({
      id: String(episode.id),
      season: episode.season_number,
      number: episode.episode_number,
      title: episode.name,
      airDate: optionalDate(episode.air_date),
    }));
  }
}
