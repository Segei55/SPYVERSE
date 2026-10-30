import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../../../src/utils/electron';

const api: ElectronAPI = {
  platform: process.platform,
  serverUrl: process.argv.find((arg) => arg.startsWith('--spyverse-server-url='))?.slice('--spyverse-server-url='.length) || '',
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  getLatestRelease: () => ipcRenderer.invoke('release:latest'),
  getUpdateSupport: () => ipcRenderer.invoke('update:supported'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (listener) => {
    const handler = (_event: unknown, status: Parameters<typeof listener>[0]) => listener(status);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
