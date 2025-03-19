// public/preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  showOpenDialog: (options) => {
    return ipcRenderer.invoke("show-open-dialog", options);
  },
  readFile: (filePath, encoding) => {
    return ipcRenderer.invoke("read-file", filePath, encoding);
  },
  listDirectory: (directoryPath) => {
    return ipcRenderer.invoke("list-directory", directoryPath);
  },
  getBasename: (filePath) => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || "";
  },
  getDirectoryPath: (filePath) => {
    const parts = filePath.split(/[/\\]/);
    parts.pop();
    return parts.join("/");
  },
});

// Expose a minimal fs API similar to Node's fs but through IPC
contextBridge.exposeInMainWorld("fs", {
  readFile: (filePath, options) => {
    return ipcRenderer.invoke("read-file", filePath, options?.encoding);
  },
  promises: {
    readdir: (directoryPath) => {
      return ipcRenderer.invoke("list-directory", directoryPath);
    },
  },
});

console.log("Preload script loaded successfully!");
