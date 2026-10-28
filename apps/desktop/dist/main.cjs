var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var import_electron = require("electron");
var import_fs = __toESM(require("fs"));
var import_http = __toESM(require("http"));
var import_net = __toESM(require("net"));
var import_path = __toESM(require("path"));
var mainWindow = null;
function createWindow(serverUrl) {
  mainWindow = new import_electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "SPYVERSE",
    backgroundColor: "#0b0f19",
    autoHideMenuBar: true,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--spyverse-server-url=${serverUrl}`]
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      import_electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(import_path.default.join(__dirname, "../../../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function isSpyverseServerRunning(port) {
  return new Promise((resolve) => {
    const request = import_http.default.get(`http://127.0.0.1:${port}/api/status`, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          const status = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          resolve(response.statusCode === 200 && status.name === "SPYVERSE Dedicated Server");
        } catch {
          resolve(false);
        }
      });
    });
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const probe = import_net.default.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "0.0.0.0", () => {
      probe.close(() => resolve(true));
    });
  });
}
async function findServerPort(startPort) {
  for (let port = startPort; port <= 3100; port++) {
    if (await isSpyverseServerRunning(port)) {
      return { port, isRunning: true };
    }
    if (await isPortAvailable(port)) {
      return { port, isRunning: false };
    }
  }
  throw new Error("No available server port found between 3001 and 3100.");
}
function findServerBundle() {
  const candidates = [
    import_path.default.join(import_path.default.dirname(process.execPath), "spyverse-server.cjs"),
    import_path.default.resolve(__dirname, "../../../dist-server/spyverse-server.cjs")
  ];
  const serverBundle = candidates.find((candidate) => import_fs.default.existsSync(candidate));
  if (!serverBundle) {
    throw new Error("The bundled SPYVERSE server was not found.");
  }
  return serverBundle;
}
async function startEmbeddedServer() {
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
import_electron.ipcMain.handle("window:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});
import_electron.ipcMain.handle("window:maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
import_electron.ipcMain.handle("window:close", () => {
  if (mainWindow) mainWindow.close();
});
import_electron.ipcMain.handle("app:version", () => {
  return import_electron.app.getVersion();
});
var isServerMode = process.argv.includes("--server");
import_electron.app.whenReady().then(() => {
  if (isServerMode) {
    try {
      require(import_path.default.join(import_path.default.dirname(process.execPath), "spyverse-server.cjs"));
    } catch (error) {
      console.error("[SPYVERSE Server] Failed to start:", error);
      process.exitCode = 1;
      import_electron.app.quit();
    }
    return;
  }
  startEmbeddedServer().then(createWindow).catch((error) => {
    console.error("[SPYVERSE Server] Failed to start embedded server:", error);
    createWindow("http://127.0.0.1:3001");
  });
});
if (!isServerMode) {
  import_electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      import_electron.app.quit();
    }
  });
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      startEmbeddedServer().then(createWindow).catch((error) => {
        console.error("[SPYVERSE Server] Failed to restart embedded server:", error);
        createWindow("http://127.0.0.1:3001");
      });
    }
  });
}
