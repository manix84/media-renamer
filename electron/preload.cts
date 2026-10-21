const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('mediaRenamer', {
  platform: process.platform,
  loadPreferences: () => ipcRenderer.invoke('preferences:get'),
  savePreferences: (preferences: unknown) => ipcRenderer.invoke('preferences:set', preferences),
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('files:pick'),
  pickFolders: (): Promise<string[]> => ipcRenderer.invoke('folders:pick'),
  pickDestinationFolder: (kind?: 'TV' | 'Movie' | 'Log'): Promise<string | undefined> => ipcRenderer.invoke('destination:pick', kind),
  expandPaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('files:expand-paths', paths),
  watchFiles: (paths: string[]): Promise<void> => ipcRenderer.invoke('files:watch', paths),
  onWatchedFilesChanged: (listener: (changes: Array<{ type: 'moved'; previousPath: string; path: string } | { type: 'deleted'; path: string }>) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, changes: Array<{ type: 'moved'; previousPath: string; path: string } | { type: 'deleted'; path: string }>) => listener(changes);
    ipcRenderer.on('files:changed', handler);
    return () => ipcRenderer.removeListener('files:changed', handler);
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  probeMedia: (filePath: string) => ipcRenderer.invoke('media:probe', filePath),
  stageGeneratedSidecars: (assets: Array<{ targetPath: string; content?: string; url?: string }>) => ipcRenderer.invoke('metadata:stage-sidecars', assets),
  discoverCompanions: (paths: string[]) => ipcRenderer.invoke('media:companions', paths),
  preflightRenamePlan: (items: Array<{ sourcePath: string; targetPath: string }>) => ipcRenderer.invoke('rename:preflight', items),
  resolveRenameCollisions: (groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>) => ipcRenderer.invoke('rename:resolve-collisions', groups),
  executeRenamePlan: (groups: Array<{ items: Array<{ sourcePath: string; targetPath: string }> }>, options?: { clearSourceJunk?: boolean; removeEmptySourceParents?: boolean; createExternalLog?: boolean; externalLogDirectory?: string }) => ipcRenderer.invoke('rename:execute', groups, options),
  controlRename: (control: 'stop' | 'undo'): Promise<boolean> => ipcRenderer.invoke('rename:control', control),
  getLastRenameOperation: () => ipcRenderer.invoke('rename:last-operation'),
  undoRenameOperation: (operationId: string) => ipcRenderer.invoke('rename:undo', operationId),
  onRenameProgress: (listener: (progress: { operation: 'rename' | 'undo'; completed: number; total: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { operation: 'rename' | 'undo'; completed: number; total: number }) => listener(progress);
    ipcRenderer.on('rename:progress', handler);
    return () => ipcRenderer.removeListener('rename:progress', handler);
  },
  exportRenamePlan: (plan: unknown): Promise<string | undefined> => ipcRenderer.invoke('rename:export-plan', plan),
  providerStatus: () => ipcRenderer.invoke('metadata:status'),
  searchShows: (query: string) => ipcRenderer.invoke('tmdb:search-shows', query),
  getShow: (showId: string) => ipcRenderer.invoke('tmdb:get-show', showId),
  resolveTvdbSeries: (request: { name: string; year?: number }) => ipcRenderer.invoke('metadata:resolve-tvdb-series', request),
  getShowEpisodes: (request: { agent: 'tvdb-aired' | 'tmdb-aired'; tmdbId: string; tvdbId?: string; seasons: number[] }) => ipcRenderer.invoke('metadata:get-show-episodes', request),
  searchMovies: (query: string) => ipcRenderer.invoke('tmdb:search-movies', query),
  getMovie: (movieId: string, mediaType?: 'movie' | 'tv') => ipcRenderer.invoke('tmdb:get-movie', movieId, mediaType),
  openDebugConsole: (): Promise<void> => ipcRenderer.invoke('debug:open'),
  dockDebugConsole: (): Promise<void> => ipcRenderer.invoke('debug:dock'),
  appendDebug: (entry: { level: string; message: string; detail?: string }): void => ipcRenderer.send('debug:append', entry),
  getDebugEntries: () => ipcRenderer.invoke('debug:list'),
  clearDebugEntries: (): Promise<void> => ipcRenderer.invoke('debug:clear'),
  onDebugEntries: (listener: (entries: unknown[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entries: unknown[]) => listener(entries);
    ipcRenderer.on('debug:entries', handler);
    return () => ipcRenderer.removeListener('debug:entries', handler);
  },
  onDebugDock: (listener: () => void): (() => void) => {
    ipcRenderer.on('debug:dock', listener);
    return () => ipcRenderer.removeListener('debug:dock', listener);
  },
});
