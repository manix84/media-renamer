import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AniListClient } from './anilist.js';
import { TmdbClient } from './tmdb.js';
import { selectTvdbSeriesMatch, TvdbClient } from './tvdb.js';
import { expandMediaPaths, isVideoFile, VIDEO_FILE_EXTENSIONS } from './mediaFiles.js';
import { probeMedia } from './mediaProbe.js';
import { stageGeneratedAssets } from './generatedAssets.js';
import { preflightRenameItems } from './renamePreflight.js';
import { executeRenamePlan, readLatestRenameOperation, resolveRenameCollisions, undoRenameOperation, type RenameOperation } from './renameExecution.js';
import { discoverMediaCompanions } from './mediaCompanions.js';
import { normalizePreferences, readPreferences, writePreferences, type PersistedPreferences } from './preferences.js';
import { MediaFileMonitor, type WatchedFileChange } from './fileMonitor.js';
import { MetadataCache } from './metadataCache.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appIconPath = path.join(app.getAppPath(), 'assets', 'app-icon.png');
type DebugLevel = 'info' | 'success' | 'warning' | 'error';
type DebugEntry = { id: number; timestamp: number; level: DebugLevel; message: string; detail?: string };

let debugWindow: BrowserWindow | undefined;
let mainWindow: BrowserWindow | undefined;
let debugSequence = 0;
let debugEntries: DebugEntry[] = [];
let lastRename: { operation: RenameOperation; logPath: string } | undefined;
let persistedPreferences: PersistedPreferences | undefined;
let preferenceWrite = Promise.resolve();
let renameRunning = false;
let activeRenameControl: 'stop' | 'undo' | undefined;
let metadataStore: MetadataCache | undefined;
let watchedMediaPaths: string[] = [];
const mediaFileMonitor = new MediaFileMonitor((changes) => {
  const replacements = new Map(changes.filter((change): change is Extract<WatchedFileChange, { type: 'moved' }> => change.type === 'moved').map((change) => [change.previousPath, change.path]));
  const deleted = new Set(changes.filter((change) => change.type === 'deleted').map((change) => change.path));
  watchedMediaPaths = watchedMediaPaths.flatMap((filePath) => deleted.has(filePath) ? [] : [replacements.get(filePath) ?? filePath]);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('files:changed', changes);
});

function renameHistoryDirectory(): string {
  return path.join(app.getPath('userData'), 'rename-history');
}

function preferencesFilePath(): string {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function metadataCache(): MetadataCache {
  return metadataStore ??= new MetadataCache(path.join(app.getPath('userData'), 'metadata-cache.json'));
}

const SEARCH_CACHE_AGE = 6 * 60 * 60 * 1000;
const SHOW_SEARCH_CACHE_VERSION = 2;
const DETAILS_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
const DETAILS_CACHE_VERSION = 2;
const EPISODE_CACHE_AGE = 30 * 24 * 60 * 60 * 1000;
const EPISODE_CACHE_VERSION = 4;

async function loadPreferences(): Promise<PersistedPreferences> {
  return persistedPreferences ??= await readPreferences(preferencesFilePath());
}

async function latestRename() {
  return lastRename ??= await readLatestRenameOperation(renameHistoryDirectory());
}

function localEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const env = fs.readFileSync(path.join(app.getAppPath(), '.env'), 'utf8');
    const line = env.split(/\r?\n/).find((entry) => entry.trimStart().startsWith(`${name}=`));
    return line?.split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/, '$2') || undefined;
  } catch {
    return undefined;
  }
}

function tmdb(): TmdbClient {
  const token = localEnv('TMDB_ACCESS_TOKEN');
  if (!token) throw new Error('TMDB is not configured. Add TMDB_ACCESS_TOKEN to .env and restart the app.');
  return new TmdbClient(token);
}

let tvdbClient: TvdbClient | undefined;
const aniListClient = new AniListClient();
function tvdb(): TvdbClient {
  const apiKey = localEnv('TVDB_API_KEY');
  if (!apiKey) throw new Error('TVDB is not configured. Add TVDB_API_KEY to .env to load Plex-compatible episode ordering.');
  return tvdbClient ??= new TvdbClient(apiKey, localEnv('TVDB_SUBSCRIBER_PIN'));
}

function textArgument(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error(`Invalid ${name}.`);
  return value.trim();
}

function mediaPathArgument(value: unknown): string {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.length > 32_768 || !isVideoFile(value)) throw new Error('Invalid media file path.');
  return value;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0e14',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = window;
  window.on('closed', () => { if (mainWindow === window) mainWindow = undefined; });

  const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
  if (!app.isPackaged) void window.loadURL(devUrl);
  else void window.loadFile(path.join(here, '../dist/index.html'));
}

function createDebugWindow() {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.show();
    debugWindow.focus();
    return;
  }

  debugWindow = new BrowserWindow({
    width: 620,
    height: 700,
    minWidth: 420,
    minHeight: 320,
    title: 'Media Renamer Debug Console',
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  debugWindow.on('closed', () => { debugWindow = undefined; });

  const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
  if (!app.isPackaged) void debugWindow.loadURL(`${devUrl}#debug`);
  else void debugWindow.loadFile(path.join(here, '../dist/index.html'), { hash: 'debug' });
}

function publishDebugEntries() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('debug:entries', debugEntries);
  if (debugWindow && !debugWindow.isDestroyed()) debugWindow.webContents.send('debug:entries', debugEntries);
}

function resumeMediaFileMonitoring(): void {
  // Destination paths may live on slow or temporarily unavailable volumes. Monitoring is
  // best-effort and must not hold the completed rename/undo IPC response open.
  void mediaFileMonitor.setPaths(watchedMediaPaths).catch((error) => {
    debugEntries = [...debugEntries.slice(-499), {
      id: ++debugSequence,
      timestamp: Date.now(),
      level: 'warning',
      message: 'Could not resume media file monitoring',
      detail: error instanceof Error ? error.message : String(error),
    }];
    publishDebugEntries();
  });
}

ipcMain.handle('files:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video files', extensions: [...VIDEO_FILE_EXTENSIONS] }],
  });
  return result.canceled ? [] : result.filePaths.filter(isVideoFile);
});

ipcMain.handle('folders:pick', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] });
  return result.canceled ? [] : expandMediaPaths(result.filePaths);
});

ipcMain.handle('destination:pick', async (_event, kind: unknown) => {
  const result = await dialog.showOpenDialog({ title: kind === 'Movie' ? 'Choose movie base folder' : kind === 'Log' ? 'Choose operation log folder' : 'Choose TV base folder', properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('files:expand-paths', (_event, values: unknown) => {
  if (!Array.isArray(values) || values.length > 5000 || values.some((value) => typeof value !== 'string' || !path.isAbsolute(value))) {
    throw new Error('Invalid dropped file paths.');
  }
  return expandMediaPaths(values);
});
ipcMain.handle('files:watch', async (_event, values: unknown) => {
  if (!Array.isArray(values) || values.length > 5000) throw new Error('Invalid watched media paths.');
  watchedMediaPaths = values.map(mediaPathArgument);
  await mediaFileMonitor.setPaths(watchedMediaPaths);
});

ipcMain.handle('debug:open', () => createDebugWindow());
ipcMain.handle('debug:dock', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('debug:dock');
    mainWindow.show();
    mainWindow.focus();
  }
  debugWindow?.close();
});
ipcMain.handle('debug:list', () => debugEntries);
ipcMain.handle('debug:clear', () => {
  debugEntries = [];
  publishDebugEntries();
});
ipcMain.on('debug:append', (_event, value: unknown) => {
  if (!value || typeof value !== 'object') return;
  const candidate = value as { level?: unknown; message?: unknown; detail?: unknown };
  const levels: DebugLevel[] = ['info', 'success', 'warning', 'error'];
  if (!levels.includes(candidate.level as DebugLevel) || typeof candidate.message !== 'string') return;
  const detail = typeof candidate.detail === 'string' ? candidate.detail.slice(0, 2000) : undefined;
  debugEntries = [...debugEntries.slice(-499), {
    id: ++debugSequence,
    timestamp: Date.now(),
    level: candidate.level as DebugLevel,
    message: candidate.message.slice(0, 500),
    detail,
  }];
  publishDebugEntries();
});

ipcMain.handle('metadata:status', () => ({ configured: Boolean(localEnv('TMDB_ACCESS_TOKEN')), tvdbConfigured: Boolean(localEnv('TVDB_API_KEY')) }));
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('preferences:get', () => loadPreferences());
ipcMain.handle('preferences:set', async (_event, value: unknown) => {
  const next = normalizePreferences(value);
  preferenceWrite = preferenceWrite.catch(() => undefined).then(async () => {
    persistedPreferences = { ...await loadPreferences(), ...next };
    await writePreferences(preferencesFilePath(), persistedPreferences);
  });
  await preferenceWrite;
});
ipcMain.handle('media:probe', (_event, filePath: unknown) => probeMedia(mediaPathArgument(filePath), localEnv('FFPROBE_PATH')));
ipcMain.handle('metadata:stage-sidecars', (_event, assets: unknown) => stageGeneratedAssets(assets, path.join(app.getPath('temp'), 'media-renamer-sidecars')));
ipcMain.handle('media:companions', (_event, values: unknown) => {
  if (!Array.isArray(values) || values.length > 5000) throw new Error('Invalid media paths.');
  return discoverMediaCompanions(values.map(mediaPathArgument));
});
ipcMain.handle('rename:preflight', (_event, items: unknown) => preflightRenameItems(items));
ipcMain.handle('rename:resolve-collisions', (_event, groups: unknown) => resolveRenameCollisions(groups));
ipcMain.handle('rename:execute', async (event, groups: unknown, options: unknown) => {
  if (renameRunning) throw new Error('A rename operation is already running.');
  if (options !== undefined && (!options || typeof options !== 'object')) throw new Error('Invalid rename options.');
  const renameOptions = options as { clearSourceJunk?: unknown; removeEmptySourceParents?: unknown; createExternalLog?: unknown; externalLogDirectory?: unknown } | undefined;
  if (renameOptions?.clearSourceJunk !== undefined && typeof renameOptions.clearSourceJunk !== 'boolean') throw new Error('Invalid rename options.');
  if (renameOptions?.removeEmptySourceParents !== undefined && typeof renameOptions.removeEmptySourceParents !== 'boolean') throw new Error('Invalid rename options.');
  if (renameOptions?.createExternalLog !== undefined && typeof renameOptions.createExternalLog !== 'boolean') throw new Error('Invalid rename options.');
  if (renameOptions?.externalLogDirectory !== undefined && (typeof renameOptions.externalLogDirectory !== 'string' || !path.isAbsolute(renameOptions.externalLogDirectory))) throw new Error('Invalid rename log directory.');
  renameRunning = true;
  activeRenameControl = undefined;
  mediaFileMonitor.close();
  let executed: { operation: RenameOperation; logPath: string } | undefined;
  try {
    const resolved = await resolveRenameCollisions(groups);
    const items = resolved.flatMap((group) => group.items);
    executed = await executeRenamePlan(items, renameHistoryDirectory(), (completed, total, operation = 'rename') => event.sender.send('rename:progress', { operation, completed, total }), {
      clearSourceJunk: renameOptions?.clearSourceJunk ?? false,
      removeEmptySourceParents: renameOptions?.removeEmptySourceParents ?? false,
      createExternalLog: renameOptions?.createExternalLog ?? false,
      externalLogDirectory: renameOptions?.externalLogDirectory as string | undefined,
      control: () => activeRenameControl,
    });
    lastRename = executed;
    return executed;
  } finally {
    renameRunning = false;
    activeRenameControl = undefined;
    if (executed) {
      const replacements = new Map(executed.operation.status === 'undone' ? [] : executed.operation.items.map((item) => [item.sourcePath, item.targetPath]));
      watchedMediaPaths = watchedMediaPaths.map((filePath) => replacements.get(filePath) ?? filePath);
    }
    resumeMediaFileMonitoring();
  }
});
ipcMain.handle('rename:control', (_event, control: unknown) => {
  if (control !== 'stop' && control !== 'undo') throw new Error('Invalid rename control.');
  if (!renameRunning) return false;
  activeRenameControl = control;
  return true;
});
ipcMain.handle('rename:last-operation', () => latestRename());
ipcMain.handle('rename:undo', async (event, operationId: unknown) => {
  if (typeof operationId !== 'string') throw new Error('Invalid rename operation.');
  const recorded = await latestRename();
  if (!recorded || recorded.operation.id !== operationId) throw new Error('That rename operation is no longer the latest operation.');
  mediaFileMonitor.close();
  try {
    const operation = await undoRenameOperation(recorded.operation, recorded.logPath, (completed, total) => event.sender.send('rename:progress', { operation: 'undo', completed, total }));
    const replacements = new Map(recorded.operation.items.map((item) => [item.targetPath, item.sourcePath]));
    watchedMediaPaths = watchedMediaPaths.map((filePath) => replacements.get(filePath) ?? filePath);
    lastRename = { ...recorded, operation };
    return lastRename;
  } finally {
    resumeMediaFileMonitoring();
  }
});
ipcMain.handle('rename:export-plan', async (_event, value: unknown) => {
  if (!value || typeof value !== 'object') throw new Error('Invalid rename plan.');
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (serialized.length > 5_000_000) throw new Error('Rename plan is too large to export.');
  const options = { title: 'Export rename plan', defaultPath: 'rename-plan.json', filters: [{ name: 'JSON', extensions: ['json'] }] };
  const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return undefined;
  await fs.promises.writeFile(result.filePath, serialized, { encoding: 'utf8', flag: 'w' });
  return result.filePath;
});
ipcMain.handle('tmdb:search-shows', async (_event, query: unknown) => {
  const search = textArgument(query, 'search query');
  return metadataCache().get(`search:v${SHOW_SEARCH_CACHE_VERSION}:shows:${search.toLocaleLowerCase()}`, SEARCH_CACHE_AGE, async () => {
    const client = tmdb();
    const results = await client.searchShows(search);
    const tvdbId = search.match(/^tvdb-(\d+)$/i)?.[1];
    if (results.length) return results;
    if (tvdbId) {
      const series = await tvdb().getSeries(tvdbId);
      const candidates = series.tmdbId ? await client.searchShows(`tmdb-${series.tmdbId}`) : await client.searchShows(series.name);
      const ranked = series.year ? candidates.sort((left, right) => Number(right.year === series.year) - Number(left.year === series.year)) : candidates;
      return ranked.map((candidate) => ({ ...candidate, tvdbId }));
    }
    if (!localEnv('TVDB_API_KEY')) return [];
    try {
      const aliases = await aniListClient.searchAnimeTitles(search);
      for (const alias of aliases) {
        const seriesMatches = await tvdb().searchSeries(alias);
        for (const match of seriesMatches.slice(0, 3)) {
          const series = await tvdb().getSeries(match.id);
          if (!series.tmdbId) continue;
          const [candidate] = await client.searchShows(`tmdb-${series.tmdbId}`);
          if (candidate) return [{ ...candidate, tvdbId: series.id }];
        }
      }
    } catch {
      // Optional anime alias discovery must not turn an empty search into an error.
    }
    return [];
  });
});
ipcMain.handle('tmdb:get-show', (_event, showId: unknown) => {
  const id = textArgument(showId, 'show ID');
  return metadataCache().get(`tmdb:v${DETAILS_CACHE_VERSION}:show:${id}`, DETAILS_CACHE_AGE, () => tmdb().getShow(id));
});
ipcMain.handle('metadata:resolve-tvdb-series', async (_event, value: unknown) => {
  if (!value || typeof value !== 'object') throw new Error('Invalid TVDB series lookup.');
  const request = value as { name?: unknown; year?: unknown };
  const name = textArgument(request.name, 'show name');
  const year = request.year === undefined ? undefined : Number(request.year);
  if (year !== undefined && (!Number.isInteger(year) || year < 1800 || year > 3000)) throw new Error('Invalid show year.');
  return selectTvdbSeriesMatch(await tvdb().searchSeries(name), name, year);
});
ipcMain.handle('tmdb:search-movies', (_event, query: unknown) => {
  const search = textArgument(query, 'search query');
  return metadataCache().get(`search:movies:${search.toLocaleLowerCase()}`, SEARCH_CACHE_AGE, () => tmdb().searchMovies(search));
});
ipcMain.handle('tmdb:get-movie', (_event, movieId: unknown, mediaType: unknown) => {
  const id = textArgument(movieId, 'movie ID');
  if (mediaType !== undefined && mediaType !== 'movie' && mediaType !== 'tv') throw new Error('Invalid movie media type.');
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  return metadataCache().get(`tmdb:v${DETAILS_CACHE_VERSION}:${type}:${id}`, DETAILS_CACHE_AGE, () => tmdb().getMovie(id, type));
});
ipcMain.handle('metadata:get-show-episodes', async (_event, value: unknown) => {
  if (!value || typeof value !== 'object') throw new Error('Invalid show metadata request.');
  const request = value as { agent?: unknown; tmdbId?: unknown; tvdbId?: unknown; seasons?: unknown };
  if (request.agent === 'tvdb-aired') {
    const seriesId = textArgument(request.tvdbId, 'TVDB series ID');
    return metadataCache().get(`tvdb:v${EPISODE_CACHE_VERSION}:episodes:aired:eng:${seriesId}`, EPISODE_CACHE_AGE, () => tvdb().getSeriesEpisodes(seriesId));
  }
  if (request.agent === 'tmdb-aired') {
    if (!Array.isArray(request.seasons) || request.seasons.length > 100 || request.seasons.some((season) => !Number.isInteger(season) || Number(season) < 0 || Number(season) > 999)) throw new Error('Invalid TMDB season list.');
    const showId = textArgument(request.tmdbId, 'TMDB show ID');
    const seasons = request.seasons.map(Number).sort((left, right) => left - right);
    return metadataCache().get(`tmdb:v${EPISODE_CACHE_VERSION}:episodes:aired:${showId}:${seasons.join(',')}`, EPISODE_CACHE_AGE, async () => (await Promise.all(seasons.map((season) => tmdb().getSeasonEpisodes(showId, season)))).flat());
  }
  throw new Error('Unsupported show metadata agent.');
});

app.whenReady().then(() => {
  app.setName('Media Renamer');
  const appIcon = nativeImage.createFromPath(appIconPath);
  if (!appIcon.isEmpty() && process.platform === 'darwin') app.dock?.setIcon(appIcon);
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('before-quit', () => mediaFileMonitor.close());
