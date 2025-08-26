import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export type DownloadResult = { success: true; path?: string } | { success: false; error: string };

declare global {
  interface Window {
    api: {
      selectOutputFolder: () => Promise<string | null>;
      startDownload: (payload: { url: string; outputDir: string }) => Promise<DownloadResult>;
      onDownloadLog: (listener: (line: string) => void) => () => void;
      getDefaultDownloads?: () => Promise<string>;
      setDebug?: (enabled: boolean) => void;
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
  const logsContainerRef = useRef<HTMLDivElement>(null);

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
    const unsubscribe = window.api.onDownloadLog((line) => {
      addLog(line);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const def = await window.api.getDefaultDownloads?.();
        if (def && !outputDir) setOutputDir(def);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
  }, [logs.length]);

  const canDownload = useMemo(() => {
    const hasUrl = url.trim().length > 0;
    const hasDir = outputDir.trim().length > 0;
    return hasUrl && hasDir && !isRunning;
  }, [url, outputDir, isRunning]);

  const onChooseFolder = async () => {
    const folder = await window.api.selectOutputFolder();
    if (folder) setOutputDir(folder);
  };

  const onDownload = async () => {
    setError(null);
    setLogs([]);
    setIsRunning(true);
    if (debug) {
      addLog('[debug] Requesting download with debug mode ON');
    }
    const normalizedUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
    setLastOutputFile(null);
    const result = await window.api.startDownload({ url: normalizedUrl, outputDir });
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
    <div className="app">
      <TopBar
        running={isRunning}
        hasError={!!error}
        debug={debug}
        onToggleDebug={(next) => {
          setDebug(next);
          window.api.setDebug?.(next);
        }}
        logsVisible={logsVisible}
        onToggleLogs={(next) => {
          setLogsVisible(next);
          window.api.setLogsVisible?.(next);
        }}
      />

      <div className="card">
        <Label className="help">Video URL</Label>
        <div className="row">
          <Input
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            inputMode="url"
          />
        </div>

        <Label className="help">Output folder</Label>
        <div className="row">
          <Input
            placeholder="Choose a folder or type a path..."
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            spellCheck={false}
          />
          <Button onClick={onChooseFolder}>Browse…</Button>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="default" disabled={!canDownload} onClick={onDownload}>
            {isRunning ? 'Downloading…' : 'Download'}
          </Button>
        </div>
      </div>

      {logsVisible && (
        <div className="card" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <label className="help">Logs</label>
          <div className="logs" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {logs.map((l, i) => {
              const cls = classifyLine(l);
              return (
                <div key={i} className={`log-line ${cls}`}>{l}</div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
          {lastOutputFile && (
            <div className="help">Saved to: {lastOutputFile}</div>
          )}
          {error && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="help" style={{ color: '#ff9a9a' }}>{error}</div>
              <Button variant="destructive" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          )}
        </div>
      )}

      <div className="footer">
        <div className="help">Uses vendored yt-dlp/ffmpeg when available.</div>
        <div className="help">Linux/Windows</div>
      </div>
    </div>
  );
}
