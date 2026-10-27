import { app, BrowserWindow, shell, ipcMain } from 'electron';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(serverUrl: string): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'SPYVERSE',
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--spyverse-server-url=${serverUrl}`],
    },
  });

  // Safe external URL handler
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // In production, load built dist/index.html; in dev, load dev server
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    // Файл собран в apps/desktop/dist, веб-клиент лежит в корневом dist
    mainWindow.loadFile(path.join(__dirname, '../../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function isSpyverseServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/status`, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const status = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          resolve(response.statusCode === 200 && status.name === 'SPYVERSE Dedicated Server');
        } catch {
          resolve(false);
        }
      });
    });

    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '0.0.0.0', () => {
      probe.close(() => resolve(true));
    });
  });
}

async function findServerPort(startPort: number): Promise<{ port: number; isRunning: boolean }> {
  for (let port = startPort; port <= 3100; port++) {
    if (await isSpyverseServerRunning(port)) {
      return { port, isRunning: true };
    }
    if (await isPortAvailable(port)) {
      return { port, isRunning: false };
    }
  }
  throw new Error('No available server port found between 3001 and 3100.');
}

function findServerBundle(): string {
  const candidates = [
    path.join(path.dirname(process.execPath), 'spyverse-server.cjs'),
    path.resolve(__dirname, '../../../dist-server/spyverse-server.cjs'),
  ];
  const serverBundle = candidates.find((candidate) => fs.existsSync(candidate));
  if (!serverBundle) {
    throw new Error('The bundled SPYVERSE server was not found.');
  }
  return serverBundle;
}

async function startEmbeddedServer(): Promise<string> {
  const defaultPort = 3001;
  const { port, isRunning } = await findServerPort(defaultPort);
  if (isRunning) return `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  require(findServerBundle());

  for (let attempt = 0; attempt < 30; attempt++) {
    if (await isSpyverseServerRunning(port)) {
      return `http://127.0.0.1:${port}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`The SPYVERSE server did not start on port ${port}.`);
}

// IPC Handlers
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('app:version', () => {
  return app.getVersion();
});

const isServerMode = process.argv.includes('--server');

app.whenReady().then(() => {
  if (isServerMode) {
    try {
      require(path.join(path.dirname(process.execPath), 'spyverse-server.cjs'));
    } catch (error) {
      console.error('[SPYVERSE Server] Failed to start:', error);
      process.exitCode = 1;
      app.quit();
    }
    return;
  }

  startEmbeddedServer()
    .then(createWindow)
    .catch((error: unknown) => {
      console.error('[SPYVERSE Server] Failed to start embedded server:', error);
      createWindow('http://127.0.0.1:3001');
    });
});

if (!isServerMode) {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startEmbeddedServer()
        .then(createWindow)
        .catch((error: unknown) => {
          console.error('[SPYVERSE Server] Failed to restart embedded server:', error);
          createWindow('http://127.0.0.1:3001');
        });
    }
  });
}
