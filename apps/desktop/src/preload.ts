import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  platform: string;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  getVersion: () => Promise<string>;
}

const api: ElectronAPI = {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  getVersion: () => ipcRenderer.invoke('app:version'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
