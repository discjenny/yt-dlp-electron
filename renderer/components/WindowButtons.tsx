import React from 'react';
import { Minus, X } from 'lucide-react';
import { Button } from './ui/button';

export function WindowButtons() {
  return (
    <div className="flex items-center gap-2 -mr-1">
      <Button size="sm" variant="outline" aria-label="Minimize" onClick={() => (globalThis as any).api?.windowAction('minimize')}>
        <Minus size={16} />
      </Button>
      <Button size="sm" variant="destructive" aria-label="Close" onClick={() => (globalThis as any).api?.windowAction('close')}>
        <X size={16} />
      </Button>
    </div>
  );
}
