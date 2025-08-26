import fs from 'node:fs/promises';
import path from 'node:path';

// Minimal pruning: remove tests, devscripts, docs to reduce size when packaging.
// Safe to run locally as it only deletes within yt-dlp directory.

async function removeIfExists(p: string) {
  try { await fs.rm(p, { recursive: true, force: true }); }
  catch { /* ignore */ }
}

async function main() {
  const root = process.cwd();
  const yt = path.join(root, 'yt-dlp');
  const targets = [
    'test',
    'devscripts',
    'bundle',
    'supportedsites.md',
    'Changelog.md',
    'CONTRIBUTING.md',
    'CONTRIBUTORS',
    'README.md',
    'Makefile',
    'setup.cfg',
    'pyproject.toml',
    'yt-dlp.cmd',
    'yt-dlp.sh',
  ];

  for (const t of targets) {
    const p = path.join(yt, t);
    await removeIfExists(p);
  }

  console.log('Pruned yt-dlp aux files. Core `yt_dlp` package retained.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
