import React from 'react';
import { Settings } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverPortal, PopoverContent, PopoverArrow } from './ui/popover';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { WindowButtons } from './WindowButtons';

export function TopBar(props: {
  running: boolean;
  hasError: boolean;
  debug: boolean;
  onToggleDebug: (next: boolean) => void;
  logsVisible: boolean;
  onToggleLogs: (next: boolean) => void;
}) {
  const { running, hasError, debug, onToggleDebug, logsVisible, onToggleLogs } = props;
  return (
    <div className="header">
      <div className="flex items-center gap-2">
        <div className="title">yt-dlp Desktop</div>
        <div className="sub">Minimal GUI for video downloads</div>
      </div>
      <div className="controls flex items-center gap-2">
        <div className={`badge ${running ? 'running' : hasError ? 'error' : ''}`}>
          <span className="dot" />
          {running ? 'Running' : hasError ? 'Error' : 'Idle'}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button aria-label="Settings" size="sm">
              <Settings size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent sideOffset={8}>
              <div className="flex items-center justify-between gap-6 mb-3">
                <div className="help">Debug mode</div>
                <Switch checked={debug} onCheckedChange={(v) => onToggleDebug(!!v)} />
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="help">Show logs</div>
                <Switch checked={logsVisible} onCheckedChange={(v) => onToggleLogs(!!v)} />
              </div>
              <PopoverArrow className="fill-[var(--panel)]" />
            </PopoverContent>
          </PopoverPortal>
        </Popover>
        {typeof window !== 'undefined' && (window as any).api?.windowAction ? (
          <WindowButtons />
        ) : null}
      </div>
    </div>
  );
}
