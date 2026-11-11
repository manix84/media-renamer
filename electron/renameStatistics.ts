import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const SUBTITLE_EXTENSIONS = new Set(['.ass', '.smi', '.srt', '.ssa', '.sub', '.sup', '.vtt']);
const VIDEO_EXTENSIONS = new Set(['.3gp', '.avi', '.flv', '.m2ts', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.mts', '.ogm', '.ts', '.webm', '.wmv']);
const HISTORY_LIMIT = 20;

export interface SortedMediaStatistic {
  name: string;
  count: number;
  lastSortedAt: string;
}

export interface RenameStatistics {
  version: 1;
  updatedAt?: string;
  totals: { operations: number; files: number; videos: number; movies: number; episodes: number; shows: number; subtitles: number };
  shows: Record<string, SortedMediaStatistic>;
  movies: Record<string, SortedMediaStatistic>;
}

export interface RenameStatisticsSummary extends RenameStatistics {
  topShows: SortedMediaStatistic[];
  recentShows: SortedMediaStatistic[];
  recentMovies: SortedMediaStatistic[];
}

function emptyStatistics(): RenameStatistics {
  return { version: 1, totals: { operations: 0, files: 0, videos: 0, movies: 0, episodes: 0, shows: 0, subtitles: 0 }, shows: {}, movies: {} };
}

function normalizeStatistics(value: unknown): RenameStatistics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStatistics();
  const candidate = value as Partial<RenameStatistics>;
  if (candidate.version !== 1 || !candidate.totals || !candidate.shows || !candidate.movies) return emptyStatistics();
  return candidate as RenameStatistics;
}

function mediaName(targetPath: string, mediaKind: 'movies' | 'shows'): string {
  const parent = path.dirname(targetPath);
  return mediaKind === 'shows' ? path.basename(path.dirname(parent)) : path.basename(parent);
}

function safeKey(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 300);
}

async function writeAtomic(filePath: string, value: RenameStatistics): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fs.promises.rename(temporary, filePath);
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function readRenameStatistics(filePath: string): Promise<RenameStatistics> {
  try { return normalizeStatistics(JSON.parse(await fs.promises.readFile(filePath, 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStatistics();
    throw error;
  }
}

export async function recordCompletedRename(filePath: string, mediaKind: 'movies' | 'shows', targetPaths: string[], now = new Date()): Promise<RenameStatisticsSummary> {
  const statistics = await readRenameStatistics(filePath);
  const timestamp = now.toISOString();
  const videos = targetPaths.filter((item) => VIDEO_EXTENSIONS.has(path.extname(item).toLocaleLowerCase()));
  const subtitles = targetPaths.filter((item) => SUBTITLE_EXTENSIONS.has(path.extname(item).toLocaleLowerCase())).length;
  const namedMedia = new Map<string, { name: string; count: number }>();
  for (const targetPath of videos) {
    const name = mediaName(targetPath, mediaKind);
    const key = safeKey(name);
    if (!key) continue;
    const current = namedMedia.get(key);
    namedMedia.set(key, { name, count: (current?.count ?? 0) + 1 });
  }
  const collection = mediaKind === 'shows' ? statistics.shows : statistics.movies;
  for (const [key, item] of namedMedia) {
    const current = collection[key];
    collection[key] = { name: item.name, count: (current?.count ?? 0) + item.count, lastSortedAt: timestamp };
  }
  statistics.updatedAt = timestamp;
  statistics.totals.operations += 1;
  statistics.totals.files += targetPaths.length;
  statistics.totals.videos += videos.length;
  statistics.totals.subtitles += subtitles;
  if (mediaKind === 'shows') statistics.totals.episodes += videos.length;
  else statistics.totals.movies += videos.length;
  statistics.totals.shows = Object.keys(statistics.shows).length;
  await writeAtomic(filePath, statistics);
  return summarizeRenameStatistics(statistics);
}

export function summarizeRenameStatistics(statistics: RenameStatistics): RenameStatisticsSummary {
  const shows = Object.values(statistics.shows);
  const recent = (items: SortedMediaStatistic[]) => [...items].sort((left, right) => right.lastSortedAt.localeCompare(left.lastSortedAt)).slice(0, HISTORY_LIMIT);
  return {
    ...statistics,
    topShows: [...shows].sort((left, right) => right.count - left.count || right.lastSortedAt.localeCompare(left.lastSortedAt)).slice(0, HISTORY_LIMIT),
    recentShows: recent(shows),
    recentMovies: recent(Object.values(statistics.movies)),
  };
}

export interface HomeAssistantPublisherConfig { baseUrl: string; token: string; entityPrefix: string }

function homeAssistantBaseUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Home Assistant URL is invalid.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Home Assistant URL must be an HTTP or HTTPS base URL without credentials, a query, or a fragment.');
  return url;
}

export async function publishRenameStatistics(config: HomeAssistantPublisherConfig, summary: RenameStatisticsSummary, fetcher: typeof fetch = fetch): Promise<void> {
  const baseUrl = homeAssistantBaseUrl(config.baseUrl);
  const common = { source: 'Media Renamer', last_updated: summary.updatedAt };
  const entities: Array<[string, string | number, Record<string, unknown>]> = [
    ['files_renamed', summary.totals.files, { friendly_name: 'Media Renamer files renamed', icon: 'mdi:file-move', state_class: 'total_increasing', unit_of_measurement: 'files' }],
    ['videos_sorted', summary.totals.videos, { friendly_name: 'Media Renamer videos sorted', icon: 'mdi:video', state_class: 'total_increasing', unit_of_measurement: 'videos' }],
    ['movies_sorted', summary.totals.movies, { friendly_name: 'Media Renamer movies sorted', icon: 'mdi:movie-open', state_class: 'total_increasing', unit_of_measurement: 'movies' }],
    ['episodes_sorted', summary.totals.episodes, { friendly_name: 'Media Renamer episodes sorted', icon: 'mdi:television-classic', state_class: 'total_increasing', unit_of_measurement: 'episodes' }],
    ['shows_sorted', summary.totals.shows, { friendly_name: 'Media Renamer unique shows sorted', icon: 'mdi:television', unit_of_measurement: 'shows' }],
    ['subtitles_sorted', summary.totals.subtitles, { friendly_name: 'Media Renamer subtitles sorted', icon: 'mdi:subtitles', state_class: 'total_increasing', unit_of_measurement: 'subtitles' }],
    ['operations', summary.totals.operations, { friendly_name: 'Media Renamer operations', icon: 'mdi:counter', state_class: 'total_increasing' }],
    ['activity', summary.updatedAt ?? 'unknown', { friendly_name: 'Media Renamer activity', icon: 'mdi:history', device_class: 'timestamp', top_shows: summary.topShows, recent_shows: summary.recentShows, recent_movies: summary.recentMovies }],
  ];
  for (const [suffix, state, attributes] of entities) {
    const endpoint = new URL(`/api/states/sensor.${config.entityPrefix}_${suffix}`, baseUrl);
    const response = await fetcher(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ state: String(state), attributes: { ...common, ...attributes } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const responseDetail = (await response.text().catch(() => '')).trim().replace(/\s+/g, ' ').slice(0, 300);
      const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      throw new Error(`Home Assistant rejected sensor.${config.entityPrefix}_${suffix} (${status})${responseDetail ? `: ${responseDetail}` : '.'}`);
    }
  }
}
