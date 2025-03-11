// src/electron/main.ts
import { app as electronApp, BrowserWindow } from "electron";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the index.html file from the public directory
  mainWindow.loadFile(path.join(__dirname, "../../public/index.html"));

  // Open the DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Window closed event
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App ready event
electronApp.on("ready", createWindow);

// Quit when all windows are closed
electronApp.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electronApp.quit();
  }
});

electronApp.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
