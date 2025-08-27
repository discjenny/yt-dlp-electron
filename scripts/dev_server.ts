import index from '../renderer/index.html';

const port = Number(process.env.DEV_SERVER_PORT || 5175);

Bun.serve({
  port,
  routes: {
    '/': index,
    '/compiled.css': Bun.file(new URL('../renderer/compiled.css', import.meta.url)),
    // Static media used by the renderer in dev
    '/background.cropped.mp4': Bun.file(new URL('../renderer/public/background.cropped.mp4', import.meta.url)),
    '/background.mp4': Bun.file(new URL('../renderer/public/background.mp4', import.meta.url)),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`[dev] Bun server running at http://localhost:${port}`);


