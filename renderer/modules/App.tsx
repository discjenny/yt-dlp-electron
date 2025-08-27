import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Branding } from '../components/Branding';
import { CenteredSearchInput } from '../components/CenteredSearchInput';
import { DownloadStatus } from '../components/DownloadStatus';

export type DownloadResult = { success: true; path?: string } | { success: false; error: string };

declare global {
  interface Window {
    api: {
      selectOutputFolder: () => Promise<string | null>;
      startDownload: (payload: { url: string; outputDir: string }) => Promise<DownloadResult>;
      onDownloadLog: (listener: (line: string) => void) => () => void;
      getDefaultDownloads: () => Promise<string>;
      setDebug: (enabled: boolean) => void;
      windowAction: (action: 'minimize' | 'close') => void;
      setLogsVisible: (visible: boolean) => void;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}

export default function App() {
  const [url, setUrl] = useLocalStorage<string>('ytgui:url', '');
  const [outputDir, setOutputDir] = useLocalStorage<string>('ytgui:outputDir', '');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastOutputFile, setLastOutputFile] = useState<string | null>(null);
  const [debug, setDebug] = useLocalStorage<boolean>('ytgui:debug', false);
  const [logsVisible, setLogsVisible] = useLocalStorage<boolean>('ytgui:logsVisible', true);
  const [brandingDone, setBrandingDone] = useState(false);
  const [dockInput, setDockInput] = useState(false);

  const classifyLine = (line: string) => {
    const l = line.trim();
    if (/^\[error\]/i.test(l) || /error:/i.test(l)) return 'error';
    if (/^\[debug\]/i.test(l)) return 'debug';
    if (/^\[download\]/i.test(l) || /\bETA\b|\b%\b|\bKiB\b|\bMiB\b/i.test(l)) return 'progress';
    if (/^\[.*\]/.test(l)) return 'info';
    return 'info';
  };
  const addLog = (line: string) => setLogs((prev) => [...prev, line].slice(-500));

  useEffect(() => {
    const api = (globalThis as any).api as Window['api'];
    const unsubscribe = api.onDownloadLog((line: string) => {
      addLog(line);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const api = (globalThis as any).api as Window['api'];
        const def = await api.getDefaultDownloads();
        if (def && !outputDir) setOutputDir(def);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Branding animation handled inside <Branding/>; we only need to know when it's done

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'instant' as any });
  }, [logs.length]);


  const canDownload = useMemo(() => {
    const hasUrl = url.trim().length > 0;
    const hasDir = outputDir.trim().length > 0;
    return hasUrl && hasDir && !isRunning;
  }, [url, outputDir, isRunning]);

  const onChooseFolder = async () => {
    const api = (globalThis as any).api as Window['api'];
    const folder = await api.selectOutputFolder();
    if (folder) setOutputDir(folder);
  };

  const onDownload = async () => {
    setError(null);
    setLogs([]);
    setIsRunning(true);
    setDockInput(true);
    if (debug) {
      addLog('[debug] Requesting download with debug mode ON');
    }
    const normalizedUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
    setLastOutputFile(null);
    const api = (globalThis as any).api as Window['api'];
    const result = await api.startDownload({ url: normalizedUrl, outputDir });
    setIsRunning(false);

    if ('error' in result) {
      setError(result.error);
      addLog(`[error] ${result.error}`);
    } else {
      addLog('Done.');
      if ('path' in result && result.path) setLastOutputFile(result.path);
    }
  };

  return (
    <div className="w-[620px] h-[580px] mx-auto p-0 flex flex-col gap-0">
      <TopBar
        running={isRunning}
        hasError={!!error}
        debug={debug}
        onToggleDebug={(next) => {
          setDebug(next);
          const api = (globalThis as any).api as Window['api'];
          api.setDebug(next);
        }}
        logsVisible={logsVisible}
        onToggleLogs={(next) => {
          setLogsVisible(next);
          const api = (globalThis as any).api as Window['api'];
          api.setLogsVisible(next);
        }}
      />

      <Branding onComplete={() => setBrandingDone(true)} />

      <CenteredSearchInput
        visible={brandingDone}
        value={url}
        onChange={setUrl}
        onSubmit={onDownload}
        disabled={isRunning}
        dock={dockInput}
      />

      {/* Logs remain available if toggled on; input form removed for redesign */}
      {brandingDone && dockInput && (
        <DownloadStatus
          url={url}
          logs={logs}
          phase={isRunning ? 'downloading' : error ? 'error' : lastOutputFile ? 'completed' : 'idle'}
          error={error}
          lastOutputFile={lastOutputFile}
        />
      )}

      {logsVisible && (
        <div className="flex-1 min-h-0 rounded p-4 border border-border bg-card/60 backdrop-saturate-125 backdrop-blur-md shadow-md animate-[fadeUp_.25s_ease] flex flex-col gap-2 mx-3 my-3">
          <Label>Logs</Label>
          <div className="flex-1 min-h-0 font-mono bg-secondary/40 border border-border rounded p-3 overflow-y-auto whitespace-pre-wrap" style={{ scrollbarWidth: 'thin' }}>
            {logs.map((l, i) => {
              const cls = classifyLine(l);
              return (
                <div
                  key={i}
                  className={
                    cls === 'error'
                      ? 'px-1.5 py-0.5 rounded border-l-2 border-l-destructive bg-destructive/10'
                      : cls === 'progress'
                      ? 'px-1.5 py-0.5 rounded border-l-2 border-l-primary bg-primary/10'
                      : cls === 'debug'
                      ? 'px-1.5 py-0.5 rounded opacity-80'
                      : 'px-1.5 py-0.5 rounded border-l-2 border-l-border'
                  }
                >
                  {l}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
          {lastOutputFile && (
            <div className="text-xs text-muted-foreground">Saved to: {lastOutputFile}</div>
          )}
          {error && (
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-red-300">{error}</div>
              <Button variant="destructive" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          )}
        </div>
      )}

      {/* Footer button removed; overlay element becomes the final link to eliminate any pixel jump */}
    </div>
  );
}
