const API_ROOT = 'https://api4.thetvdb.com/v4';

type LoginResponse = { data: { token: string } };
type SeriesResponse = { data: { id: number; name: string; year?: string; firstAired?: string } };

export interface TvdbSeries {
  id: string;
  name: string;
  year?: number;
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
    const response = await this.fetcher(`${API_ROOT}/series/${encodeURIComponent(seriesId)}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${await this.accessToken()}` },
    });
    if (response.status === 404) throw new Error(`TVDB series ${seriesId} was not found.`);
    if (!response.ok) throw new Error(`TVDB request failed (${response.status}).`);
    const { data } = await response.json() as SeriesResponse;
    const rawYear = data.year || data.firstAired?.slice(0, 4);
    const year = rawYear ? Number(rawYear) : undefined;
    return { id: String(data.id), name: data.name.trim(), year: Number.isFinite(year) ? year : undefined };
  }
}
