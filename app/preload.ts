import { contextBridge, ipcRenderer } from 'electron';

export type DownloadResult = { success: true; path?: string } | { success: false; error: string };

declare global {
  interface Window {
    api: {
      selectOutputFolder: () => Promise<string | null>;
      startDownload: (payload: { url: string; outputDir: string }) => Promise<DownloadResult & { id?: string }>;
      onDownloadLog: (listener: (line: string, id?: string) => void) => () => void;
      getDefaultDownloads: () => Promise<string>;
      setDebug: (enabled: boolean) => void;
      windowAction: (action: 'minimize' | 'close') => void;
      setLogsVisible: (visible: boolean) => void;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}

contextBridge.exposeInMainWorld('api', {
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  startDownload: (payload: { url: string; outputDir: string }) => ipcRenderer.invoke('start-download', payload),
  onDownloadLog: (listener: (line: string, id?: string) => void) => {
    const handler = (_: unknown, line: string, id?: string) => listener(line, id);
    ipcRenderer.on('download-log', handler);
    return () => ipcRenderer.removeListener('download-log', handler);
  },
  onDownloadComplete: (listener: (payload: { id: string; success: boolean; path?: string; error?: string }) => void) => {
    const handler = (_: unknown, payload: { id: string; success: boolean; path?: string; error?: string }) => listener(payload);
    ipcRenderer.on('download-complete', handler);
    return () => ipcRenderer.removeListener('download-complete', handler);
  },
  getDefaultDownloads: () => ipcRenderer.invoke('get-default-downloads'),
  setDebug: (enabled: boolean) => {
    ipcRenderer.send('set-debug', enabled);
  },
  windowAction: (action: 'minimize' | 'close') => {
    ipcRenderer.send('window-action', action);
  },
  setLogsVisible: (visible: boolean) => {
    ipcRenderer.send('ui:set-logs-visible', visible);
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});
