import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { createRoot } from 'react-dom/client';

type DownloadResult = { success: true; path?: string } | { success: false; error: string };

declare global {
  interface Window {
    api: {
      selectOutputFolder: () => Promise<string | null>;
      startDownload: (payload: { url: string; outputDir: string }) => Promise<DownloadResult>;
      onDownloadLog: (listener: (line: string) => void) => () => void;
    };
  }
}

function App() {
  const [url, setUrl] = useLocalStorage<string>('ytgui:url', '');
  const [outputDir, setOutputDir] = useLocalStorage<string>('ytgui:outputDir', '');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastOutputFile, setLastOutputFile] = useState<string | null>(null);

  const addLog = (line: string) => setLogs((prev) => [...prev, line].slice(-500));

  useEffect(() => {
    const unsubscribe = window.api.onDownloadLog((line) => {
      addLog(line);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const def = await window.api.getDefaultDownloads();
      if (def && !outputDir) setOutputDir(def);
    })();
    // we intentionally leave outputDir in deps to only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      <div className="header">
        <div>
          <div className="title">yt-dlp Desktop</div>
          <div className="sub">Minimal GUI for video downloads</div>
        </div>
        <div className={`badge ${isRunning ? 'running' : error ? 'error' : ''}`}>
          <span className="dot" />
          {isRunning ? 'Running' : error ? 'Error' : 'Idle'}
        </div>
      </div>

      <div className="card">
        <label className="help">Video URL</label>
        <div className="row">
          <input
            className="input"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            inputMode="url"
          />
        </div>

        <label className="help">Output folder</label>
        <div className="row">
          <input
            className="input"
            placeholder="Choose a folder or type a path..."
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            spellCheck={false}
          />
          <button className="btn" onClick={onChooseFolder}>Browse…</button>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn accent" disabled={!canDownload} onClick={onDownload}>
            {isRunning ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>

      <div className="card" style={{ flex: 1 }}>
        <label className="help">Logs</label>
        <div className="logs">
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          <div ref={logsEndRef} />
        </div>
        {lastOutputFile && (
          <div className="help">Saved to: {lastOutputFile}</div>
        )}
        {error && (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="help" style={{ color: '#ff9a9a' }}>{error}</div>
            <button className="btn danger" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
      </div>

      <div className="footer">
        <div className="help">Uses local Python `yt_dlp` from the repo.</div>
        <div className="help">Linux</div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
