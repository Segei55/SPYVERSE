declare module 'electron' {
  export interface BrowserWindowOptions {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    title?: string;
    backgroundColor?: string;
    autoHideMenuBar?: boolean;
    webPreferences?: {
      preload?: string;
      contextIsolation?: boolean;
      nodeIntegration?: boolean;
      sandbox?: boolean;
    };
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowOptions);
    webContents: {
      setWindowOpenHandler: (handler: (details: { url: string }) => { action: 'deny' | 'allow' }) => void;
    };
    minimize: () => void;
    maximize: () => void;
    unmaximize: () => void;
    isMaximized: () => boolean;
    close: () => void;
    loadURL: (url: string) => Promise<void>;
    loadFile: (filePath: string) => Promise<void>;
    on: (event: string, callback: () => void) => void;
    static getAllWindows: () => BrowserWindow[];
  }

  export const app: {
    whenReady: () => Promise<void>;
    on: (event: string, callback: () => void) => void;
    quit: () => void;
    getVersion: () => string;
  };

  export const shell: {
    openExternal: (url: string) => Promise<void>;
  };

  export const ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: any[]) => any) => void;
  };

  export const ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };

  export const contextBridge: {
    exposeInMainWorld: (apiKey: string, api: any) => void;
  };
}
