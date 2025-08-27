import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
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
    <div className="rounded border border-border/60 bg-card/30 backdrop-saturate-125 backdrop-blur-md shadow-md animate-[fadeUp_.25s_ease] p-2 flex flex-col gap-1 min-w-0">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            aria-controls={sectionId}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            className="h-6 w-6 p-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div id={sectionId} className="text-xs text-muted-foreground">
          {error ? (
            <div className="text-red-300">{error}</div>
          ) : lastOutputFile ? (
            <div>Saved to: {lastOutputFile}</div>
          ) : logs.length ? (
            <div className="max-h-24 overflow-y-auto whitespace-pre-wrap bg-secondary/30 border border-border/60 rounded p-2" style={{ scrollbarWidth: 'thin' }}>
              {logs.slice(-50).join('\n')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


