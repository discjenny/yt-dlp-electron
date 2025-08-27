import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Branding } from '../components/Branding';
import { CenteredSearchInput } from '../components/CenteredSearchInput';
import { DownloadStatus } from '../components/DownloadStatus';
import { ScrollArea } from '../components/ui/scroll-area';

export type DownloadResult = { success: true; path?: string; id?: string } | { success: false; error: string; id?: string };

type DownloadItem = {
  id: string;
  url: string;
  logs: string[];
  error: string | null;
  lastOutputFile: string | null;
  phase: 'idle' | 'starting' | 'downloading' | 'completed' | 'error';
};

export default function App() {
  const [url, setUrl] = useLocalStorage<string>('ytgui:url', '');
  const [outputDir, setOutputDir] = useLocalStorage<string>('ytgui:outputDir', '');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [debug, setDebug] = useLocalStorage<boolean>('ytgui:debug', false);
  const [logsVisible, setLogsVisible] = useLocalStorage<boolean>('ytgui:logsVisible', true);
  const [brandingDone, setBrandingDone] = useState(false);
  const [dockInput, setDockInput] = useState(false);
  const [dockDone, setDockDone] = useState(false);
  const [everDocked, setEverDocked] = useState(false);

  const classifyLine = (line: string) => {
    const l = line.trim();
    if (/^\[error\]/i.test(l) || /error:/i.test(l)) return 'error';
    if (/^\[debug\]/i.test(l)) return 'debug';
    if (/^\[download\]/i.test(l) || /\bETA\b|\b%\b|\bKiB\b|\bMiB\b/i.test(l)) return 'progress';
    if (/^\[.*\]/.test(l)) return 'info';
    return 'info';
  };
  const addLogTo = (downloadId: string | undefined, line: string) => {
    setDownloads((prev) => {
      if (!prev.length) return prev;
      const targetIndex = downloadId ? prev.findIndex((d) => d.id === downloadId) : prev.length - 1;
      const idx = targetIndex >= 0 ? targetIndex : prev.length - 1;
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      const item: DownloadItem = { ...current };
      item.logs = [...(item.logs || []), line].slice(-500);
      // Heuristic: capture saved file path lines
      const text = line.trim();
      const savedFilePattern = /^(?:[a-zA-Z]:\\|\/)\S.*\.(mp4|mkv|webm|mp3|m4a|opus|aac|flac|wav)$/i;
      if (savedFilePattern.test(text)) {
        item.lastOutputFile = text;
      }
      next[idx] = item;
      return next;
    });
  };

  useEffect(() => {
    const api = (globalThis as any).api as Window['api'];
    const unsubscribe = api.onDownloadLog((line: string, id?: string) => {
      addLogTo(id, line);
    });
    const unComplete = (api as any).onDownloadComplete?.((payload: { id: string; success: boolean; path?: string; error?: string }) => {
      const { id, success, path, error } = payload || ({} as any);
      setDownloads((prev) => prev.map((d) => (d.id === id ? { ...d, phase: success ? 'completed' : 'error', lastOutputFile: path || d.lastOutputFile, error: error || d.error } : d)));
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

  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Auto-scroll to bottom when new items arrive or when the list becomes visible
    try {
      const el = viewportRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }, [downloads.length, dockInput, everDocked, brandingDone]);


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
    setIsRunning(true);
    setDockInput(true);
    if (!everDocked) setDockDone(false);
    const normalizedUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
    const api = (globalThis as any).api as Window['api'];
    // Optimistically create a local entry so logs can attach even if ID lags
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDownloads((prev) => [
      ...prev,
      { id: tempId, url: normalizedUrl, logs: debug ? ['[debug] Requesting download'] : [], error: null, lastOutputFile: null, phase: 'starting' },
    ]);
    // Attempt to scroll immediately after enqueueing the new item
    setTimeout(() => {
      try {
        const el = viewportRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      } catch {}
    }, 0);
    const result = await api.startDownload({ url: normalizedUrl, outputDir });
    setIsRunning(false);

    const assignedId: string = (result as any && (result as any).id) ? String((result as any).id) : tempId;
    // If backend provided a real ID, reconcile temp item to that ID
    setDownloads((prev) => {
      const idx = prev.findIndex((d) => d.id === tempId);
      const existsIdx = prev.findIndex((d) => d.id === assignedId);
      const next = [...prev];
      if (idx >= 0) {
        const base = next[idx];
        if (!base) return next;
        const merged: DownloadItem = { id: assignedId, url: base.url, logs: base.logs, error: base.error, lastOutputFile: base.lastOutputFile, phase: 'downloading' };
        next[idx] = merged;
      } else if (existsIdx === -1) {
        const created: DownloadItem = { id: assignedId, url: normalizedUrl, logs: [], error: null, lastOutputFile: null, phase: 'downloading' };
        next.push(created);
      }
      return next;
    });

    // Completion now handled by onDownloadComplete event; still record immediate startup errors
    if ('error' in result && !result.id) {
      setError(result.error);
      setDownloads((prev) => prev.map((d) => (d.id === assignedId ? { ...d, phase: 'error', error: result.error } : d)));
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
        dock={dockInput}
        onDockComplete={() => {
          setDockDone(true);
          setEverDocked(true);
        }}
      />

      {/* Download entries list: newest at bottom, scrolls on overflow */}
      {brandingDone && (dockInput || everDocked) && (
        <div>
          <ScrollArea className={((dockDone || everDocked) ? 'animate-[fadeUp_.25s_ease] ' : 'opacity-0 ')+"ml-4 z-10000 flex-[0_1_440px] h-[440px] min-h-0"} viewportClassName="pr-4" viewportRef={viewportRef}>
            <div className="py-2 flex flex-col gap-1 min-w-0">
              {downloads.map((d) => (
                <DownloadStatus key={d.id} url={d.url} logs={d.logs} phase={d.phase} error={d.error} lastOutputFile={d.lastOutputFile} />
              ))}
            </div>
          </ScrollArea>
          <div className={((dockDone || everDocked) ? 'animate-[fadeUp_.25s_ease] ' : 'opacity-0 ') + "h-[91px] border-t border-border bg-card/20 backdrop-saturate-110 backdrop-blur-md"}></div>
        </div>
      )}

      {logsVisible && (
        <div className="flex-1 min-h-0 rounded p-4 border border-border bg-card/60 backdrop-saturate-125 backdrop-blur-md shadow-md animate-[fadeUp_.25s_ease] flex flex-col gap-2 mx-3 my-3">
          <Label>Logs</Label>
          <div className="text-xs text-muted-foreground">Logs are now per-download in the list above and persisted to the database.</div>
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
