const API_ROOT = 'https://api4.thetvdb.com/v4';
const ARTWORK_ROOT = 'https://artworks.thetvdb.com';

type LoginResponse = { data: { token: string } };
type RemoteId = { id?: string; sourceName?: string; type?: number };
type RawSeries = { id?: number; tvdb_id?: string; name: string; year?: string; firstAired?: string; overview?: string; image?: string; originalLanguage?: string; remoteIds?: RemoteId[]; remote_ids?: RemoteId[] };
type SeriesResponse = { data: RawSeries };
type SearchResponse = { data?: RawSeries[] };
type RawEpisode = { id?: number; name?: string; aired?: string; seasonNumber?: number; number?: number; absoluteNumber?: number; runtime?: number; overview?: string; image?: string };
type EpisodesResponse = { data?: { episodes?: RawEpisode[] }; links?: { next?: string | null } };
type TranslationResponse = { data?: { name?: string; overview?: string } };

export function tvdbArtworkUrl(value?: string): string | undefined {
  const artwork = value?.trim();
  if (!artwork) return undefined;
  try {
    const url = new URL(artwork, ARTWORK_ROOT);
    if (url.protocol !== 'https:' || !/(?:^|\.)thetvdb\.com$/i.test(url.hostname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export interface TvdbSeries {
  id: string;
  name: string;
  year?: number;
  tmdbId?: string;
  overview?: string;
  imageUrl?: string;
  originalLanguage?: string;
}

export interface TvdbEpisode {
  id: string;
  season: number;
  number: number;
  absoluteNumber?: number;
  title: string;
  airDate?: string;
  runtimeMinutes?: number;
  overview?: string;
  imageUrl?: string;
}

const TVDB_LANGUAGE_CODES: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fra', de: 'deu', it: 'ita', 'pt-BR': 'por', ja: 'jpn', ko: 'kor', 'zh-CN': 'zho',
};

export function tvdbLanguageCode(language?: string): string {
  if (language && /^[a-z]{3}$/i.test(language)) return language.toLocaleLowerCase();
  return language && TVDB_LANGUAGE_CODES[language] ? TVDB_LANGUAGE_CODES[language] : 'eng';
}

export function directTvdbShow(series: TvdbSeries) {
  return { id: `tvdb-${series.id}`, tvdbId: series.id, name: series.name, year: series.year, overview: series.overview ?? '', posterUrl: series.imageUrl };
}

export function directTvdbShowDetails(series: TvdbSeries, episodes: TvdbEpisode[]) {
  const seasonNumbers = [...new Set(episodes.map((episode) => episode.season))].sort((left, right) => left - right);
  return {
    ...directTvdbShow(series),
    seasons: seasonNumbers.map((number) => ({
      number,
      name: number === 0 ? 'Specials' : `Season ${number}`,
      episodeCount: episodes.filter((episode) => episode.season === number).length,
      airDate: episodes.find((episode) => episode.season === number && episode.airDate)?.airDate,
    })),
  };
}

function normalizedSeriesName(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function selectTvdbSeriesMatch(candidates: TvdbSeries[], name: string, year?: number): TvdbSeries | undefined {
  const normalized = normalizedSeriesName(name);
  const exact = candidates.filter((candidate) => normalizedSeriesName(candidate.name) === normalized);
  if (!exact.length) return undefined;
  const sameYear = year === undefined ? [] : exact.filter((candidate) => candidate.year === year);
  if (sameYear.length === 1) return sameYear[0];
  return exact.length === 1 ? exact[0] : undefined;
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

  private async getSeriesTranslation(seriesId: string, language: string): Promise<{ name?: string; overview?: string } | undefined> {
    const response = await this.fetcher(`${API_ROOT}/series/${encodeURIComponent(seriesId)}/translations/${encodeURIComponent(language)}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` },
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`TVDB series translation request failed (${response.status}).`);
    const { data } = await response.json() as TranslationResponse;
    const name = data?.name?.trim();
    const overview = data?.overview?.trim();
    return name || overview ? { ...(name ? { name } : {}), ...(overview ? { overview } : {}) } : undefined;
  }

  async getSeries(seriesId: string, language?: string): Promise<TvdbSeries> {
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
    const id = data.tvdb_id ?? data.id;
    if (id === undefined) throw new Error(`TVDB series ${seriesId} returned no series ID.`);
    const series: TvdbSeries = {
      id: String(id),
      name: data.name.trim(),
      year: Number.isFinite(year) ? year : undefined,
      tmdbId,
      ...(data.overview?.trim() ? { overview: data.overview.trim() } : {}),
      ...(tvdbArtworkUrl(data.image) ? { imageUrl: tvdbArtworkUrl(data.image) } : {}),
      ...(data.originalLanguage?.trim() ? { originalLanguage: tvdbLanguageCode(data.originalLanguage.trim()) } : {}),
    };
    if (!language) return series;
    const translation = await this.getSeriesTranslation(series.id, language).catch(() => undefined);
    return translation ? { ...series, ...translation } : series;
  }

  async searchSeries(query: string, language = 'eng'): Promise<TvdbSeries[]> {
    const params = new URLSearchParams({ query, type: 'series', limit: '5', language });
    const response = await this.fetcher(`${API_ROOT}/search?${params}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` },
    });
    if (!response.ok) throw new Error(`TVDB search failed (${response.status}).`);
    const { data = [] } = await response.json() as SearchResponse;
    const results = data.map((series) => {
      const rawYear = series.year || series.firstAired?.slice(0, 4);
      const year = rawYear ? Number(rawYear) : undefined;
      const remoteIds = series.remoteIds ?? series.remote_ids ?? [];
      const tmdbId = remoteIds.find((remote) => /themoviedb|movie.?database|tmdb/i.test(remote.sourceName ?? ''))?.id;
      return {
        id: String(series.tvdb_id ?? series.id),
        name: series.name.trim(),
        year: Number.isFinite(year) ? year : undefined,
        ...(tmdbId ? { tmdbId } : {}),
        ...(series.overview?.trim() ? { overview: series.overview.trim() } : {}),
        ...(tvdbArtworkUrl(series.image) ? { imageUrl: tvdbArtworkUrl(series.image) } : {}),
      };
    });
    return Promise.all(results.map(async (series) => {
      const translation = await this.getSeriesTranslation(series.id, language).catch(() => undefined);
      return translation ? { ...series, ...translation } : series;
    }));
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
          ...(episode.absoluteNumber && episode.absoluteNumber > 0 ? { absoluteNumber: episode.absoluteNumber } : {}),
          title: episode.name?.trim() || `Episode ${episode.number}`,
          airDate: episode.aired || undefined,
          ...(episode.runtime && episode.runtime > 0 ? { runtimeMinutes: episode.runtime } : {}),
          ...(episode.overview?.trim() ? { overview: episode.overview.trim() } : {}),
          ...(tvdbArtworkUrl(episode.image) ? { imageUrl: tvdbArtworkUrl(episode.image) } : {}),
        });
      }
      if (!payload.links?.next) break;
    }
    return episodes.sort((left, right) => left.season - right.season || left.number - right.number);
  }
}
