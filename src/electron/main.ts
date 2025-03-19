// src/electron/main.ts
import { app as electronApp, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Get absolute path to preload script in public folder
  const preloadPath = path.join(__dirname, "../../public/preload.js");

  // Debug: Check if preload script exists
  console.log("Checking preload script:", preloadPath);
  console.log("File exists:", fs.existsSync(preloadPath));

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  // Load the index.html file from the public directory
  const indexPath = path.join(__dirname, "../../public/index.html");
  console.log("Loading index from:", indexPath);
  console.log("Index exists:", fs.existsSync(indexPath));

  mainWindow.loadFile(indexPath);

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

// IPC handlers for file operations
ipcMain.handle("show-open-dialog", async (event, options) => {
  if (!mainWindow) return { canceled: true };
  return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle("read-file", async (event, filePath, encoding) => {
  try {
    if (encoding) {
      return await fs.promises.readFile(filePath, { encoding });
    } else {
      return await fs.promises.readFile(filePath);
    }
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle("list-directory", async (event, directoryPath) => {
  try {
    const entries = await fs.promises.readdir(directoryPath, {
      withFileTypes: true,
    });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch (error: any) {
    throw new Error(`Failed to read directory: ${error.message}`);
  }
});
