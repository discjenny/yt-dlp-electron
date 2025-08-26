import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
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
  const outDir = path.join(root, 'dist');
  const out = path.join(outDir, 'background.mp4');

  if (!(await fileExists(src))) {
    return; // nothing to process
  }

  await fs.mkdir(outDir, { recursive: true });

  // Determine ffmpeg binary: prefer system for full filters/encoders; fallback to vendored
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const vendorFfmpeg = path.join(root, 'vendor', 'bin', ffmpegName);
  async function hasSystemFfmpeg() {
    try { await run('ffmpeg', ['-version']); return true; } catch { return false; }
  }
  const useSystem = await hasSystemFfmpeg();
  const ffmpeg = useSystem ? 'ffmpeg' : ((await fileExists(vendorFfmpeg)) ? vendorFfmpeg : 'ffmpeg');

  const width = 620;
  const height = 580;
  // Scale up to cover, then crop center to window size; never stretch beyond aspect
  const crop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  try {
    const args = [
      '-y',
      '-i', src,
      '-an', // drop audio to reduce size
      '-vf', crop,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      out,
    ];
    // If our ffmpeg supports libx264/preset/crf, prefer that for size/quality
    // Minimal/static builds may not; in that case, rely on default encoder (mpeg4)
    if (useSystem) {
      args.splice(6, 0, '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast');
    }
    await run(ffmpeg, args);
    console.log(`[media] Cropped background.mp4 to ${width}x${height} using ${ffmpeg}`);
  } catch (e) {
    console.warn(`[media] ffmpeg failed (${e.message}). Copying original background.mp4`);
    await fs.copyFile(src, out);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
