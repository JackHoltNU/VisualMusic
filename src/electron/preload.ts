// src/electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";
import * as path from "path";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  showOpenDialog: (options: Electron.OpenDialogOptions) => {
    return ipcRenderer.invoke("show-open-dialog", options);
  },
  readFile: (filePath: string, encoding?: string) => {
    return ipcRenderer.invoke("read-file", filePath, encoding);
  },
  listDirectory: (directoryPath: string) => {
    return ipcRenderer.invoke("list-directory", directoryPath);
  },
  getBasename: (filePath: string) => {
    return path.basename(filePath);
  },
  getDirectoryPath: (filePath: string) => {
    return path.dirname(filePath);
  },
});

// Expose a minimal fs API similar to Node's fs but through IPC
contextBridge.exposeInMainWorld("fs", {
  readFile: (filePath: string, options?: { encoding?: string }) => {
    return ipcRenderer.invoke("read-file", filePath, options?.encoding);
  },
  promises: {
    readdir: (directoryPath: string, options?: { withFileTypes?: boolean }) => {
      return ipcRenderer.invoke("list-directory", directoryPath);
    },
  },
});
