import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  onDockComplete,
}: {
  visible: boolean;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  autoFocusOnVisible?: boolean;
  dock?: boolean;
  onDockComplete?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const transitionRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const completedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible && autoFocusOnVisible) {
      // Small delay to ensure it focuses after mount/animation
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [visible, autoFocusOnVisible]);

  const containerClasses = useMemo(() => {
    const base = 'absolute inset-0 z-20 pointer-events-none flex items-center justify-center ';
    return base + (visible ? 'opacity-0 animate-[fadeUp_.3s_ease-out_both]' : 'opacity-0 pointer-events-none');
  }, [visible]);

  useEffect(() => {
    if (!dock) return;
    const el = transitionRef.current;
    if (!el) return;
    completedRef.current = false;
    const markComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      setTimeout(() => setDocked(true), 100);
      onDockComplete?.();
    };
    const handleEnd = (e: TransitionEvent) => {
      if (!e || !('propertyName' in e)) return markComplete();
      if ((e as any).propertyName === 'transform' || (e as any).propertyName === 'all') {
        markComplete();
      }
    };
    el.addEventListener('transitionend', handleEnd as any, { once: true } as any);
    // Fallback in case transitionend doesn't fire
    try { fallbackTimerRef.current = window.setTimeout(markComplete, 900); } catch {}
    return () => {
      try { el.removeEventListener('transitionend', handleEnd as any); } catch {}
      if (fallbackTimerRef.current != null) {
        try { window.clearTimeout(fallbackTimerRef.current); } catch {}
        fallbackTimerRef.current = null;
      }
    };
  }, [dock, onDockComplete]);

  return (
    <div className={containerClasses} aria-hidden={!visible} style={{ ['--dock-dy' as any]: 'calc(50vh - 50px)' }}>
      <div className={'w-full max-w-xl px-4 pointer-events-auto ' + (className ?? '')}>
        <div
          className={
            'relative will-change-transform transition-[transform] duration-[700ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]'
          }
          ref={transitionRef}
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
              const isEnter = e.key === 'Enter' || (e as any).code === 'Enter' || e.key === 'NumpadEnter';
              if (isEnter && !disabled) {
                e.preventDefault();
                onSubmit?.((e.currentTarget as HTMLInputElement).value);
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className={
              'h-12 pr-12 text-base rounded bg-card/60 border-border/70 text-foreground placeholder:text-muted-foreground/80 ' +
              'backdrop-blur-xl backdrop-saturate-150 shadow-lg focus-visible:ring-0 focus-visible:border-border/80 ' +
              (docked ? 'bg-transparent' : '')
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
                  onSubmit?.(text);
                }
              } catch {}
            }}
            className="absolute top-1/2 bg-background/10 backdrop-blur-md -translate-y-1/2 right-2 h-8 w-8 p-0 grid place-items-center"
          >
            <ClipboardPaste size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}


