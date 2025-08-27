import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

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
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [introPhase, setIntroPhase] = useState<'hidden'|'center'|'sweep'|'dock'|'done'>('hidden');
  const [softenWeight, setSoftenWeight] = useState(false);

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

  useEffect(() => {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIntroPhase('done');
      return;
    }
    setIntroPhase('center');
    setSoftenWeight(false);
    const centerDelay = 600;
    const sweepDuration = 1100;
    const dockDuration = 1300; // matches transition duration below
    const dockStart = centerDelay + sweepDuration;
    const doneDelay = dockStart + dockDuration + 100; // small cushion

    const t1 = setTimeout(() => setIntroPhase('sweep'), centerDelay);
    const t2 = setTimeout(() => setIntroPhase('dock'), dockStart);
    const tW = setTimeout(() => setSoftenWeight(true), dockStart + 250);
    const t3 = setTimeout(() => setIntroPhase('done'), doneDelay);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(tW); };
  }, []);

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

      {/* Intro overlay persists to avoid post-animation jump; becomes the final link */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30" style={{ ['--intro-dy' as any]: 'calc(50vh - 12px)' }}>
        <div
          className={
            'group relative will-change-transform font-bold tracking-[0.4px] text-white text-[56px] leading-[1.05] whitespace-nowrap transition-[transform,font-size] duration-[1300ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] pointer-events-auto hover:cursor-pointer pl-2 pr-6 py-1 rounded-md'
          }
          style={{
            transform: (introPhase === 'dock' || introPhase === 'done') ? 'translateY(var(--intro-dy))' : undefined,
            fontSize: (introPhase === 'dock' || introPhase === 'done') ? 12 : 56,
          }}
          onClick={() => {
            const api = (globalThis as any).api as Window['api'];
            api.openExternal('https://wagner.dev');
          }}
          
        >
            <span className="relative inline-block align-middle">
              {/* Bold layer (top during early phases) */}
              <span
                className={
                  (introPhase === 'sweep'
                    ? 'bg-gradient-to-r from-red-500 via-violet-500 to-blue-500 bg-clip-text text-transparent [background-size:300%_100%] animate-[intro-gradient-sweep_1.1s_ease-in-out_both]'
                    : 'text-white')
                  + ' transition-opacity duration-300 ' + (softenWeight ? 'opacity-0' : 'opacity-100')
                }
              >
                wagner.dev
              </span>
              {/* Normal-weight layer (fades in to avoid weight pop) */}
              <span className={'absolute inset-0 font-normal text-white transition-opacity duration-300 group-hover:bg-gradient-to-r group-hover:from-red-500 group-hover:via-violet-500 group-hover:to-blue-500 group-hover:bg-clip-text group-hover:text-transparent group-hover:[background-size:300%_100%] group-hover:animate-[intro-gradient-sweep_1.1s_ease-in-out_both] ' + (softenWeight ? 'opacity-100' : 'opacity-0')} aria-hidden>
                wagner.dev
              </span>
              {/* Icon now positioned relative to text wrapper to decouple from container padding */}
              <span
                className={
                  (introPhase === 'sweep'
                    ? 'absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2'
                    : (introPhase === 'dock' || introPhase === 'done')
                      ? 'absolute left-[calc(100%+2px)] top-1/2 -translate-y-[58%]'
                      : 'absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2')
                  + ' inline-flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 '
                  + (introPhase === 'sweep' ? '[animation:intro-icon-flash_1.1s_ease-in-out_both]' : '')
                }
                aria-hidden
              >
                {introPhase === 'dock' || introPhase === 'done' ? <ExternalLink size={12} /> : <ExternalLink size={34} />}
              </span>
            </span>
        </div>
      </div>

      {/* Logs remain available if toggled on; input form removed for redesign */}
      {logsVisible && (
        <div className="flex-1 min-h-0 rounded-2xl p-3.5 border border-border bg-card/60 backdrop-saturate-125 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.18)] animate-[fadeUp_.25s_ease] flex flex-col gap-2 mx-3 my-3">
          <label className="text-xs text-muted-foreground">Logs</label>
          <div className="flex-1 min-h-0 font-mono bg-black/55 border border-border rounded-xl p-2.5 overflow-y-auto whitespace-pre-wrap" style={{ scrollbarWidth: 'thin' }}>
            {logs.map((l, i) => {
              const cls = classifyLine(l);
              return (
                <div
                  key={i}
                  className={
                    cls === 'error'
                      ? 'px-1.5 py-0.5 rounded-md border-l-2 border-l-red-400/80 bg-red-400/15'
                      : cls === 'progress'
                      ? 'px-1.5 py-0.5 rounded-md border-l-2 border-l-sky-400/80 bg-sky-400/10'
                      : cls === 'debug'
                      ? 'px-1.5 py-0.5 rounded-md opacity-80'
                      : 'px-1.5 py-0.5 rounded-md border-l-2 border-l-slate-400/60 bg-slate-400/5'
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
