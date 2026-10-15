const API_ROOT = 'https://api4.thetvdb.com/v4';

type LoginResponse = { data: { token: string } };
type RemoteId = { id?: string; sourceName?: string; type?: number };
type RawSeries = { id?: number; tvdb_id?: string; name: string; year?: string; firstAired?: string; remoteIds?: RemoteId[]; remote_ids?: RemoteId[] };
type SeriesResponse = { data: RawSeries };
type SearchResponse = { data?: RawSeries[] };
type RawEpisode = { id?: number; name?: string; aired?: string; seasonNumber?: number; number?: number };
type EpisodesResponse = { data?: { episodes?: RawEpisode[] }; links?: { next?: string | null } };

export interface TvdbSeries {
  id: string;
  name: string;
  year?: number;
  tmdbId?: string;
}

export interface TvdbEpisode {
  id: string;
  season: number;
  number: number;
  title: string;
  airDate?: string;
}

export class TvdbClient {
  private token?: string;

  constructor(
    private readonly apiKey: string,
    private readonly pin?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token) return this.token;
    const response = await this.fetcher(`${API_ROOT}/login`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ apikey: this.apiKey, ...(this.pin ? { pin: this.pin } : {}) }),
    });
    if (!response.ok) throw new Error('TVDB rejected the API credentials. Check TVDB_API_KEY and TVDB_SUBSCRIBER_PIN in .env.');
    const data = await response.json() as LoginResponse;
    this.token = data.data.token;
    return this.token;
  }

  async getSeries(seriesId: string): Promise<TvdbSeries> {
    const response = await this.fetcher(`${API_ROOT}/series/${encodeURIComponent(seriesId)}/extended`, {
      headers: { accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` },
    });
    if (response.status === 404) throw new Error(`TVDB series ${seriesId} was not found.`);
    if (!response.ok) throw new Error(`TVDB request failed (${response.status}).`);
    const { data } = await response.json() as SeriesResponse;
    const rawYear = data.year || data.firstAired?.slice(0, 4);
    const year = rawYear ? Number(rawYear) : undefined;
    const remoteIds = data.remoteIds ?? data.remote_ids ?? [];
    const tmdbId = remoteIds.find((remote) => /themoviedb|movie.?database|tmdb/i.test(remote.sourceName ?? ''))?.id;
    return { id: String(data.id), name: data.name.trim(), year: Number.isFinite(year) ? year : undefined, tmdbId };
  }

  async searchSeries(query: string): Promise<TvdbSeries[]> {
    const params = new URLSearchParams({ query, type: 'series', limit: '5' });
    const response = await this.fetcher(`${API_ROOT}/search?${params}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` },
    });
    if (!response.ok) throw new Error(`TVDB search failed (${response.status}).`);
    const { data = [] } = await response.json() as SearchResponse;
    return data.map((series) => {
      const rawYear = series.year || series.firstAired?.slice(0, 4);
      const year = rawYear ? Number(rawYear) : undefined;
      return { id: String(series.tvdb_id ?? series.id), name: series.name.trim(), year: Number.isFinite(year) ? year : undefined };
    });
  }

  async getSeriesEpisodes(seriesId: string, language = 'eng'): Promise<TvdbEpisode[]> {
    const episodes: TvdbEpisode[] = [];
    for (let page = 0; page < 100; page += 1) {
      const params = new URLSearchParams({ page: String(page) });
      const response = await this.fetcher(`${API_ROOT}/series/${encodeURIComponent(seriesId)}/episodes/official/${encodeURIComponent(language)}?${params}`, {
        headers: { accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` },
      });
      if (response.status === 404) throw new Error(`TVDB episodes for series ${seriesId} were not found.`);
      if (!response.ok) throw new Error(`TVDB episode request failed (${response.status}).`);
      const payload = await response.json() as EpisodesResponse;
      for (const episode of payload.data?.episodes ?? []) {
        if (!Number.isInteger(episode.id) || !Number.isInteger(episode.seasonNumber) || !Number.isInteger(episode.number)) continue;
        episodes.push({
          id: String(episode.id as number),
          season: episode.seasonNumber as number,
          number: episode.number as number,
          title: episode.name?.trim() || `Episode ${episode.number}`,
          airDate: episode.aired || undefined,
        });
      }
      if (!payload.links?.next) break;
    }
    return episodes.sort((left, right) => left.season - right.season || left.number - right.number);
  }
}
