const API_ROOT = 'https://api.themoviedb.org/3';
const IMAGE_ROOT = 'https://image.tmdb.org/t/p/w342';

export interface TmdbShowSearchResult {
  id: string;
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
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

type RawShow = {
  id: number;
  name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
};

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
    if (literalResults.length) return literalResults;

    const datedTitle = query.match(/^(.*\S)\s+\(((?:19|20)\d{2})\)$/);
    if (!datedTitle) return [];
    return this.searchByTitle(datedTitle[1], datedTitle[2]);
  }

  async getShow(showId: string): Promise<TmdbShowDetails> {
    const data = await this.request<RawShow & { seasons: RawSeason[] }>(`/tv/${encodeURIComponent(showId)}`);
    return {
      ...normalizeShow(data),
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
