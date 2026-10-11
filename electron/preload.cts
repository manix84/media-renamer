const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('mediaRenamer', {
  platform: process.platform,
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('files:pick'),
  pickFolders: (): Promise<string[]> => ipcRenderer.invoke('folders:pick'),
  expandPaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('files:expand-paths', paths),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  providerStatus: () => ipcRenderer.invoke('tmdb:status'),
  searchShows: (query: string) => ipcRenderer.invoke('tmdb:search-shows', query),
  getShow: (showId: string) => ipcRenderer.invoke('tmdb:get-show', showId),
  getSeasonEpisodes: (showId: string, season: number) => ipcRenderer.invoke('tmdb:get-season-episodes', showId, season),
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
