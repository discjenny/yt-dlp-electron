import React, { useEffect, useMemo, useRef } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ClipboardPaste } from 'lucide-react';

export function CenteredSearchInput({
  visible,
  value,
  placeholder = 'Paste a URL and press Enter…',
  onChange,
  onSubmit,
  disabled,
  className,
  autoFocusOnVisible = true,
  dock = false,
}: {
  visible: boolean;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  className?: string;
  autoFocusOnVisible?: boolean;
  dock?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible && autoFocusOnVisible) {
      // Small delay to ensure it focuses after mount/animation
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [visible, autoFocusOnVisible]);

  const containerClasses = useMemo(() => {
    const base = 'absolute inset-0 z-20 pointer-events-none flex items-center justify-center ';
    return base + (visible ? 'opacity-100 animate-[fadeUp_.3s_ease-out_both]' : 'opacity-0 pointer-events-none');
  }, [visible]);

  return (
    <div className={containerClasses} aria-hidden={!visible} style={{ ['--dock-dy' as any]: 'calc(50vh - 50px)' }}>
      <div className={'w-full max-w-xl px-4 pointer-events-auto ' + (className ?? '')}>
        <div
          className={
            'relative will-change-transform transition-[transform] duration-[700ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]'
          }
          style={{ transform: dock ? 'translateY(var(--dock-dy))' : 'translateY(0)' }}
        >
          <Input
            ref={inputRef}
            type="url"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSubmit?.();
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className={
              'h-12 pr-12 text-base rounded bg-card/60 border-border/70 text-foreground placeholder:text-muted-foreground/80 ' +
              'backdrop-blur-xl backdrop-saturate-150 shadow-lg focus-visible:ring-0 focus-visible:border-border/80'
            }
          />
          <Button
            type="button"
            aria-label="Paste"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text) {
                  onChange(text);
                  onSubmit?.();
                }
              } catch {}
            }}
            className="absolute top-1/2 -translate-y-1/2 right-2 h-8 w-8 p-0 grid place-items-center"
          >
            <ClipboardPaste size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}


