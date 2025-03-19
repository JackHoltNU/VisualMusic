// src/types/electron-window.d.ts

interface Window {
  electron: {
    showOpenDialog: (
      options: any
    ) => Promise<{ canceled: boolean; filePaths: string[] }>;
    readFile: (
      filePath: string,
      encoding?: string
    ) => Promise<string | Uint8Array>;
    listDirectory: (directoryPath: string) => Promise<any[]>;
    getBasename: (filePath: string) => string;
    getDirectoryPath: (filePath: string) => string;
  };

  fs: {
    readFile: (
      filePath: string,
      options?: { encoding?: string }
    ) => Promise<string | Uint8Array>;
    promises: {
      readdir: (directoryPath: string) => Promise<
        Array<{
          name: string;
          isDirectory: boolean;
          isFile: boolean;
        }>
      >;
    };
  };
}
