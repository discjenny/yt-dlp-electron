import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function mtimeMs(p) {
  try { const s = await fs.stat(p); return s.mtimeMs; } catch { return 0; }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const ps = spawn(cmd, args, { stdio: 'inherit', ...opts });
    ps.on('error', reject);
    ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
  });
}

async function main() {
  const root = process.cwd();
  const src = path.join(root, 'background.mp4');
  const outDir = path.join(root, 'renderer', 'public');
  const out = path.join(outDir, 'background.cropped.mp4');

  if (!(await fileExists(src))) return;

  await fs.mkdir(outDir, { recursive: true });

  // If output exists and is newer than source, skip
  const [srcM, outM] = await Promise.all([mtimeMs(src), mtimeMs(out)]);
  if (outM && outM >= srcM) {
    console.log('[dev-media] Using existing cropped background.mp4');
    return;
  }

  // Choose ffmpeg
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const vendorFfmpeg = path.join(root, 'vendor', 'bin', ffmpegName);
  async function hasSystemFfmpeg() {
    try { await run('ffmpeg', ['-version']); return true; } catch { return false; }
  }
  const useSystem = await hasSystemFfmpeg();
  const ffmpeg = useSystem ? 'ffmpeg' : ((await fileExists(vendorFfmpeg)) ? vendorFfmpeg : 'ffmpeg');

  const width = 620;
  const height = 580;
  const crop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  try {
    const args = [
      '-y', '-i', src, '-an',
      '-vf', crop,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      out,
    ];
    if (useSystem) {
      args.splice(6, 0, '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast');
    }
    await run(ffmpeg, args);
    console.log('[dev-media] Cropped background.mp4 for dev');
  } catch (e) {
    console.warn(`[dev-media] ffmpeg failed (${e.message}). Copying original background.mp4`);
    await fs.copyFile(src, out);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


