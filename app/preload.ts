import { contextBridge, ipcRenderer } from 'electron';

export type DownloadResult = { success: true; path?: string } | { success: false; error: string };

declare global {
  interface Window {
    api: {
      selectOutputFolder: () => Promise<string | null>;
      startDownload: (payload: { url: string; outputDir: string }) => Promise<DownloadResult>;
      onDownloadLog: (listener: (line: string) => void) => () => void;
      getDefaultDownloads: () => Promise<string>;
    };
  }
}

contextBridge.exposeInMainWorld('api', {
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  startDownload: (payload: { url: string; outputDir: string }) => ipcRenderer.invoke('start-download', payload),
  onDownloadLog: (listener: (line: string) => void) => {
    const handler = (_: unknown, line: string) => listener(line);
    ipcRenderer.on('download-log', handler);
    return () => ipcRenderer.removeListener('download-log', handler);
  },
  getDefaultDownloads: () => ipcRenderer.invoke('get-default-downloads'),
});
