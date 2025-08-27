import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './modules/App';
import './tailwind.css';

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(<App />);

// Load background video and crop watermark via CSS object-position
const video = document.getElementById('bg') as HTMLVideoElement | null;
if (video) {
  // Prefer cropped asset in dev
  const isDev = location.origin.startsWith('http://localhost:');
  video.src = isDev ? '/background.cropped.mp4' : './background.mp4';
  // Crop bottom-right watermark by shifting object-position
  // Adjust as needed; keeps watermark out of view for common aspect ratios
  video.style.objectPosition = 'center 60%';
}
