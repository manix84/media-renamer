import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mediaRenamer', {
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('files:pick'),
});
