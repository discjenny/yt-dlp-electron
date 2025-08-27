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
    <div className="flex items-center justify-between px-[12px] py-[8px] border-b border-border bg-card/40 backdrop-saturate-110 backdrop-blur-md select-none [--app-region:drag] [-webkit-app-region:var(--app-region)]">
      <div className="flex items-center gap-2">
        <div className="font-semibold tracking-[0.2px] leading-none text-[18px]">yt-dlp-electron</div>
      </div>
      <div className="ml-auto flex items-center gap-2 [--app-region:no-drag] [-webkit-app-region:var(--app-region)]">
        <Popover>
          <PopoverTrigger asChild>
            <Button aria-label="Settings" size="sm" tabIndex={-1} variant="outline">
              <Settings size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent sideOffset={10}>
              <div className="flex items-center justify-between gap-8 mb-2">
                <div className="text-xs text-muted-foreground">Debug mode</div>
                <Switch checked={debug} onCheckedChange={(v) => onToggleDebug(!!v)} />
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="text-xs text-muted-foreground">Show logs</div>
                <Switch checked={logsVisible} onCheckedChange={(v) => onToggleLogs(!!v)} />
              </div>
              <PopoverArrow className="fill-card" />
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
