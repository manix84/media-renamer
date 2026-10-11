import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0e14',
    webPreferences: {
      preload: path.join(here, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
  if (!app.isPackaged) void window.loadURL(devUrl);
  else void window.loadFile(path.join(here, '../dist/index.html'));
}

ipcMain.handle('files:pick', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video files', extensions: ['mkv', 'mp4', 'avi', 'm4v', 'mov', 'webm'] }],
  });
  return result.canceled ? [] : result.filePaths;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
