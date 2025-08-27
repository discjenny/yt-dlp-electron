import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

export function Branding({
  onComplete,
  linkUrl = 'https://wagner.dev',
  className,
}: {
  onComplete?: () => void;
  linkUrl?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<'hidden' | 'center' | 'sweep' | 'dock' | 'done'>('hidden');
  const [softenWeight, setSoftenWeight] = useState(false);
  const didNotifyRef = useRef(false);

  // Run animation flow once on mount. Notify completion exactly once.
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setPhase('done');
      if (!didNotifyRef.current) {
        didNotifyRef.current = true;
        onComplete?.();
      }
      return;
    }

    setPhase('center');
    setSoftenWeight(false);
    const centerDelay = 600;
    const sweepDuration = 1100;
    const dockDuration = 1300; // matches transition duration below
    const dockStart = centerDelay + sweepDuration;
    const doneDelay = dockStart + dockDuration + 100; // small cushion

    const t1 = setTimeout(() => setPhase('sweep'), centerDelay);
    const t2 = setTimeout(() => setPhase('dock'), dockStart);
    const tW = setTimeout(() => setSoftenWeight(true), dockStart + 250);
    const t3 = setTimeout(() => {
      setPhase('done');
      if (!didNotifyRef.current) {
        didNotifyRef.current = true;
        onComplete?.();
      }
    }, doneDelay);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tW);
    };
    // Intentionally omit onComplete from deps to avoid re-running when parent re-renders.
    // We guard with didNotifyRef to call onComplete at most once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={
        'absolute inset-0 flex items-center justify-center pointer-events-none z-30 ' +
        (className ?? '')
      }
      style={{ ['--intro-dy' as any]: 'calc(50vh - 12px)' }}
    >
      <div
        className={'group relative will-change-transform font-bold tracking-[0.4px] text-white text-[56px] leading-[1.05] whitespace-nowrap transition-[transform,font-size] duration-[1300ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] pointer-events-auto hover:cursor-pointer pl-2 pr-6 py-1 rounded-md'}
        style={{
          transform: phase === 'dock' || phase === 'done' ? 'translateY(var(--intro-dy))' : undefined,
          fontSize: phase === 'dock' || phase === 'done' ? 12 : 56,
        }}
        onClick={() => {
          const api = (globalThis as any).api as Window['api'];
          api.openExternal(linkUrl);
        }}
      >
        <span className="relative inline-block align-middle">
          {/* Bold layer (top during early phases) */}
          <span
            className={
              (phase === 'sweep'
                ? 'bg-gradient-to-r from-red-500 via-violet-500 to-blue-500 bg-clip-text text-transparent [background-size:300%_100%] animate-[intro-gradient-sweep_1.1s_ease-in-out_both]'
                : 'text-white') +
              ' transition-opacity duration-300 ' +
              (softenWeight ? 'opacity-0' : 'opacity-100')
            }
          >
            wagner.dev
          </span>
          {/* Normal-weight layer (fades in to avoid weight pop) */}
          <span
            className={
              'absolute inset-0 font-normal text-white transition-opacity duration-300 group-hover:bg-gradient-to-r group-hover:from-red-500 group-hover:via-violet-500 group-hover:to-blue-500 group-hover:bg-clip-text group-hover:text-transparent group-hover:[background-size:300%_100%] group-hover:animate-[intro-gradient-sweep_1.1s_ease-in-out_both] ' +
              (softenWeight ? 'opacity-100' : 'opacity-0')
            }
            aria-hidden
          >
            wagner.dev
          </span>
          {/* Icon now positioned relative to text wrapper to decouple from container padding */}
          <span
            className={
              (phase === 'sweep'
                ? 'absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2'
                : phase === 'dock' || phase === 'done'
                ? 'absolute left-[calc(100%+2px)] top-1/2 -translate-y-[58%]'
                : 'absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2') +
              ' inline-flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 ' +
              (phase === 'sweep' ? '[animation:intro-icon-flash_1.1s_ease-in-out_both]' : '')
            }
            aria-hidden
          >
            {phase === 'dock' || phase === 'done' ? <ExternalLink size={12} /> : <ExternalLink size={34} />}
          </span>
        </span>
      </div>
    </div>
  );
}


