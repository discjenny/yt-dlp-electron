import React from 'react';

export function WindowButtons() {
  return (
    <div className="flex items-center gap-1 -mr-1">
      <button className="btn" aria-label="Minimize" onClick={() => window.api.windowAction?.('minimize')}>_</button>
      <button className="btn danger" aria-label="Close" onClick={() => window.api.windowAction?.('close')}>×</button>
    </div>
  );
}
