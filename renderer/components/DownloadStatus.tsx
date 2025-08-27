import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type DownloadPhase = 'idle' | 'starting' | 'downloading' | 'completed' | 'error';

export function DownloadStatus({
  url,
  logs,
  phase,
  error,
  lastOutputFile,
}: {
  url: string;
  logs: string[];
  phase: DownloadPhase;
  error: string | null;
  lastOutputFile: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const sectionId = useId();
  return (
    <div className="mx-3 mt-3 mb-2 rounded border border-border bg-card/60 backdrop-saturate-125 backdrop-blur-md shadow-md animate-[fadeUp_.25s_ease] p-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm text-muted-foreground shrink-0">Download</div>
          <div className="text-xs truncate" title={url}>{url}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {phase === 'starting' && 'Starting…'}
            {phase === 'downloading' && 'Downloading…'}
            {phase === 'completed' && 'Completed'}
            {phase === 'error' && 'Error'}
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={sectionId}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            className="inline-flex items-center justify-center h-6 w-6 rounded bg-background/10 border border-border hover:bg-card/50 focus-visible:outline-none focus-visible:ring-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {expanded ? (
        <div id={sectionId} className="text-xs text-muted-foreground">
          {error ? (
            <div className="text-red-300">{error}</div>
          ) : lastOutputFile ? (
            <div>Saved to: {lastOutputFile}</div>
          ) : logs.length ? (
            <div className="max-h-24 overflow-y-auto whitespace-pre-wrap bg-secondary/40 border border-border rounded p-2" style={{ scrollbarWidth: 'thin' }}>
              {logs.slice(-50).join('\n')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


