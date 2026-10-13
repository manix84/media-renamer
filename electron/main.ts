import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TmdbClient } from './tmdb.js';
import { TvdbClient } from './tvdb.js';
import { expandMediaPaths, isVideoFile } from './mediaFiles.js';
import { probeMedia } from './mediaProbe.js';
import { preflightRenameItems } from './renamePreflight.js';
import { discoverMediaCompanions } from './mediaCompanions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
type DebugLevel = 'info' | 'success' | 'warning' | 'error';
type DebugEntry = { id: number; timestamp: number; level: DebugLevel; message: string; detail?: string };

let debugWindow: BrowserWindow | undefined;
let mainWindow: BrowserWindow | undefined;
let debugSequence = 0;
let debugEntries: DebugEntry[] = [];

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
function tvdb(): TvdbClient {
  const apiKey = localEnv('TVDB_API_KEY');
  if (!apiKey) throw new Error('This TVDB ID is not mapped by TMDB. Add TVDB_API_KEY to .env to resolve it directly.');
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

ipcMain.handle('files:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video files', extensions: ['mkv', 'mp4', 'avi', 'm4v', 'mov', 'webm'] }],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('folders:pick', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] });
  return result.canceled ? [] : expandMediaPaths(result.filePaths);
});

ipcMain.handle('destination:pick', async () => {
  const result = await dialog.showOpenDialog({ title: 'Choose TV base folder', properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('files:expand-paths', (_event, values: unknown) => {
  if (!Array.isArray(values) || values.length > 5000 || values.some((value) => typeof value !== 'string' || !path.isAbsolute(value))) {
    throw new Error('Invalid dropped file paths.');
  }
  return expandMediaPaths(values);
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

ipcMain.handle('tmdb:status', () => ({ configured: Boolean(localEnv('TMDB_ACCESS_TOKEN')) }));
ipcMain.handle('media:probe', (_event, filePath: unknown) => probeMedia(mediaPathArgument(filePath), localEnv('FFPROBE_PATH')));
ipcMain.handle('media:companions', (_event, values: unknown) => {
  if (!Array.isArray(values) || values.length > 5000) throw new Error('Invalid media paths.');
  return discoverMediaCompanions(values.map(mediaPathArgument));
});
ipcMain.handle('rename:preflight', (_event, items: unknown) => preflightRenameItems(items));
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
  const client = tmdb();
  const results = await client.searchShows(search);
  const tvdbId = search.match(/^tvdb-(\d+)$/i)?.[1];
  if (results.length || !tvdbId) return results;
  const series = await tvdb().getSeries(tvdbId);
  const candidates = await client.searchShows(series.name);
  const ranked = series.year ? candidates.sort((left, right) => Number(right.year === series.year) - Number(left.year === series.year)) : candidates;
  return ranked.map((candidate) => ({ ...candidate, tvdbId }));
});
ipcMain.handle('tmdb:get-show', (_event, showId: unknown) => tmdb().getShow(textArgument(showId, 'show ID')));
ipcMain.handle('tmdb:get-season-episodes', (_event, showId: unknown, season: unknown) => {
  const seasonNumber = Number(season);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0 || seasonNumber > 999) throw new Error('Invalid season number.');
  return tmdb().getSeasonEpisodes(textArgument(showId, 'show ID'), seasonNumber);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
