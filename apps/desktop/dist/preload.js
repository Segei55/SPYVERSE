var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var api = {
  platform: process.platform,
  minimize: () => import_electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => import_electron.ipcRenderer.invoke("window:maximize"),
  close: () => import_electron.ipcRenderer.invoke("window:close"),
  getVersion: () => import_electron.ipcRenderer.invoke("app:version")
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", api);
