import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initDatabase, insertDownloadRow, insertLogRow, updateDownloadCompleted, closeDatabase } from './database';

function getDistDir(): string {
  // When running via `electron .`, app.getAppPath() is project root
  // Built assets live in `<root>/dist`
  return path.join(app.getAppPath(), 'dist');
}

function getDevServerUrl(): string {
  const explicit = process.env.DEV_SERVER_URL;
  if (explicit) return explicit;
  const port = process.env.DEV_SERVER_PORT || '5175';
  return `http://localhost:${port}`;
}

function getResourcesDir(): string {
  // In production, Electron packs resources under process.resourcesPath
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

function getVendorBinDir(): string {
  // Expect built binaries in `vendor/bin` during dev, and packed into `resources/bin` in production
  return app.isPackaged
    ? path.join(getResourcesDir(), 'bin')
    : path.join(getResourcesDir(), 'vendor', 'bin');
}

function resolveFfmpegTools(): { ffmpegExe: string | null; ffprobeExe: string | null; ffDir: string } {
  const vendorBinDir = getVendorBinDir();
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const ffmpegCandidates = [
    path.join(vendorBinDir, ffmpegName),
    path.join(vendorBinDir, 'ffmpeg', ffmpegName),
    path.join(vendorBinDir, 'ffmpeg'),
    path.join(vendorBinDir, 'ffmpeg', 'ffmpeg'),
  ];
  const ffprobeCandidates = [
    path.join(vendorBinDir, ffprobeName),
    path.join(vendorBinDir, 'ffprobe', ffprobeName),
    path.join(vendorBinDir, 'ffprobe'),
    path.join(vendorBinDir, 'ffprobe', 'ffprobe'),
  ];
  const resolvedFfmpegExe = ffmpegCandidates.find((p) => fs.existsSync(p)) || null;
  const resolvedFfprobeExe = ffprobeCandidates.find((p) => fs.existsSync(p)) || null;
  const ffmpegDirForArgs = resolvedFfmpegExe ? path.dirname(resolvedFfmpegExe) : vendorBinDir;
  return { ffmpegExe: resolvedFfmpegExe, ffprobeExe: resolvedFfprobeExe, ffDir: ffmpegDirForArgs };
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const isDev = !app.isPackaged;
  const useDevServer = process.env.DEV === '1';
  const win = new BrowserWindow({
    width: 620,
    height: 580,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#0b0c10',
    frame: process.platform !== 'win32',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'yt-dlp-electron',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
      : path.join(getResourcesDir(), 'build', 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(getDistDir(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (useDevServer) {
    const devUrl = getDevServerUrl();
    win.loadURL(`${devUrl}/`);
  } else {
    win.loadFile(path.join(getDistDir(), 'index.html'));
  }

  if (useDevServer) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Reinforce window as fixed-size and disable native title controls on Windows
  if (process.platform === 'win32') {
    win.setMenuBarVisibility(false);
  }

  mainWindow = win;
}

app.whenReady().then(() => {
  // Ensure taskbar/Start menu shortcut uses the correct icon on Windows
  // Must be called before creating any BrowserWindow
  if (process.platform === 'win32') {
    // Set a stable explicit AppUserModelID to bind taskbar/shortcuts to our exe + icon
    app.setAppUserModelId('dev.wagner.ytdlp-electron');
  }

  // Improve About panel on macOS
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'yt-dlp-electron',
      applicationVersion: app.getVersion(),
      authors: ['wagner.dev'],
      credits: 'Created by wagner.dev',
    } as any);
  }

  createWindow();

  try {
    initDatabase();
  } catch (err) {
    // Database is optional. Continue without persistence if initialization fails.
    console.error('Database init failed:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  try { closeDatabase(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-output-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  } catch {
    // On some Linux distros without xdg-desktop-portal, this may fail.
    return null;
  }
});

ipcMain.handle('get-default-downloads', async () => {
  try {
    return app.getPath('downloads');
  } catch {
    return '';
  }
});

let DEBUG_ENABLED = false;
ipcMain.on('set-debug', (_evt, enabled: boolean) => {
  DEBUG_ENABLED = !!enabled;
});

ipcMain.on('window-action', (_evt, action: 'minimize' | 'close') => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'close') mainWindow.close();
});

ipcMain.on('ui:set-logs-visible', (_evt, visible: boolean) => {
  if (!mainWindow) return;
  // Resize window when logs are hidden to a smaller height
  const size = mainWindow.getSize();
  const w = Array.isArray(size) && typeof size[0] === 'number' ? size[0] : 620;
  const compactHeight = 400; // smaller height without logs
  const fullHeight = 580; // original height
  mainWindow.setSize(w, visible ? fullHeight : compactHeight);
});

ipcMain.handle('open-external', async (_evt, url: string) => {
  try {
    if (!url || typeof url !== 'string') return false;
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});

function resolvePythonCommand(): string[] {
  // Try python3 first, then python
  return ['python3', 'python'];
}

function ensureDirectoryExists(directoryPath: string): Promise<void> {
  return fs.promises
    .mkdir(directoryPath, { recursive: true })
    .then(() => {})
    .catch((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    });
}

function spawnYtDlp(
  url: string,
  outputDir: string,
  sendLog: (line: string) => void
): Promise<{ code: number | null; stdout?: string; stderr?: string }>
{
  return new Promise(async (resolve, reject) => {
    try {
      if (!url || typeof url !== 'string') {
        reject(new Error('No URL provided'));
        return;
      }

      await ensureDirectoryExists(outputDir);

      const ytDlpRoot = path.join(app.getAppPath(), 'yt-dlp');
      const vendorBinDir = getVendorBinDir();
      const vendoredYtDlp = path.join(vendorBinDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
      // Resolve ffmpeg/ffprobe robustly
      const { ffmpegExe: resolvedFfmpegExe, ffprobeExe: resolvedFfprobeExe, ffDir: ffmpegDirForArgs } = resolveFfmpegTools();
      const ffprobeDirForArgs = resolvedFfprobeExe ? path.dirname(resolvedFfprobeExe) : ffmpegDirForArgs;

      // Do not use -E, we need PYTHONPATH to be honored
      const argsBase = [
        '-m', 'yt_dlp',
        '--newline', '--no-color',
        '--ignore-config',
        ...(DEBUG_ENABLED ? ['-v'] : []),
        '-f', 'bestaudio',
        '--no-write-info-json',
        '--no-write-description',
        '--no-write-annotations',
        '--no-write-thumbnail',
        '--no-write-playlist-metafiles',
        '--no-write-comments',
      ];
      const outputTemplateArgs = ['-P', outputDir, '-o', '%(title)s.%(ext)s'];
      // Avoid using --print hooks that may be unstable across versions
      const printArgs: string[] = [];
      // Prefer ffmpeg; provide location via env (FFMPEG_LOCATION) instead of CLI to avoid edge-case bugs
      const ffmpegArgs = ['--prefer-ffmpeg'];
      const fullArgs = [
        ...argsBase,
        ...ffmpegArgs,
        ...outputTemplateArgs,
        ...printArgs,
        url,
      ];

      // Debug info to help diagnose environment and paths
      try {
        // Always show a concise startup summary so users can diagnose issues
        sendLog(`[info] Starting yt-dlp (debug=${DEBUG_ENABLED ? 'on' : 'off'})`);
        sendLog(`[info] yt-dlp exe: ${vendoredYtDlp} (exists=${fs.existsSync(vendoredYtDlp)})`);
        sendLog(`[info] ffmpeg: ${resolvedFfmpegExe || 'none'} | ffprobe: ${resolvedFfprobeExe || 'none'}`);
        sendLog(`[info] output dir: ${outputDir}`);
        if (DEBUG_ENABLED) {
          sendLog(`[debug] ffmpegDirForArgs=${ffmpegDirForArgs}`);
          sendLog(`[debug] args=${JSON.stringify(fullArgs)}`);
        }
      } catch {}

      const envBase = { ...process.env, PYTHONPATH: ytDlpRoot } as NodeJS.ProcessEnv;
      const pathSegments: string[] = [];
      if (resolvedFfmpegExe) pathSegments.push(path.dirname(resolvedFfmpegExe));
      if (resolvedFfprobeExe) pathSegments.push(path.dirname(resolvedFfprobeExe));
      pathSegments.push(vendorBinDir);
      const extendedEnv: NodeJS.ProcessEnv = {
        ...envBase,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        FFMPEG_LOCATION: ffmpegDirForArgs,
        PATH: `${pathSegments.join(path.delimiter)}${path.delimiter}${envBase.PATH || ''}`,
      };

      let child: ChildProcessWithoutNullStreams | null = null;
      if (fs.existsSync(vendoredYtDlp)) {
        if (DEBUG_ENABLED) sendLog('[debug] Using vendored yt-dlp executable');
        const exeArgs = fullArgs.filter((a) => a !== '-m' && a !== 'yt_dlp');
        if (DEBUG_ENABLED) sendLog(`[debug] exeArgs=${JSON.stringify(exeArgs)}`);
        child = spawn(vendoredYtDlp, exeArgs, { env: extendedEnv });
      } else {
        // Fallback to local Python module (dev mode)
        if (DEBUG_ENABLED) sendLog('[debug] vendored yt-dlp not found. Falling back to python -m yt_dlp');
        let started = false;
        const candidates = resolvePythonCommand();
        for (const candidate of candidates) {
          try {
            child = spawn(candidate, fullArgs, { env: extendedEnv });
            started = true;
            if (DEBUG_ENABLED) sendLog(`[debug] Spawned ${candidate} -m yt_dlp`);
            break;
          } catch {
            started = false;
          }
        }
        if (!started || !child) {
          reject(new Error('Python not found. Please install Python 3 or provide a bundled yt-dlp.'));
          return;
        }
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', (chunk: string) => {
        stdoutBuf += chunk;
        chunk.split(/\r?\n/).forEach((line) => {
          if (!line) return;
          if (DEBUG_ENABLED) return sendLog(line);
          if (!/^\[debug\]/i.test(line)) sendLog(line);
        });
      });

      child.stderr.on('data', (chunk: string) => {
        stderrBuf += chunk;
        chunk.split(/\r?\n/).forEach((line) => {
          if (!line) return;
          if (DEBUG_ENABLED) return sendLog(line);
          if (!/^\[debug\]/i.test(line)) sendLog(line);
        });
      });

      child.on('error', (error) => {
        sendLog(`[error] ${String(error)}`);
      });

      child.on('close', (code) => {
        resolve({ code, stdout: stdoutBuf, stderr: stderrBuf });
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function spawnFfmpegTranscode(
  inputFilePath: string,
  sendLog: (line: string) => void
): Promise<{ code: number | null; outputPath?: string }>
{
  return new Promise(async (resolve) => {
    try {
      const { ffmpegExe, ffDir } = resolveFfmpegTools();
      const ffmpegPath = ffmpegExe || (process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
      if (!fs.existsSync(inputFilePath)) {
        sendLog(`[error] ffmpeg: input does not exist: ${inputFilePath}`);
        return resolve({ code: 1 });
      }
      const parsed = path.parse(inputFilePath);
      const outputPath = path.join(parsed.dir, `${parsed.name}.m4a`);
      const args = [
        '-hide_banner', '-nostdin', '-y',
        '-loglevel', 'info',
        '-i', inputFilePath,
        '-vn',
        '-c:a', 'aac',
        '-q:a', '0',
        outputPath,
      ];
      const envBase = { ...process.env } as NodeJS.ProcessEnv;
      const extendedEnv: NodeJS.ProcessEnv = {
        ...envBase,
        FFMPEG_LOCATION: ffDir,
        PATH: `${ffDir}${path.delimiter}${envBase.PATH || ''}`,
      };
      try { sendLog(`[info] ffmpeg transcode: ${JSON.stringify([ffmpegPath, ...args])}`); } catch {}

      const candidates = [ffmpegPath, (process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'), 'ffmpeg'];
      const trySpawn = (cmd: string, useShell: boolean) => {
        return spawn(cmd, args, { env: extendedEnv, cwd: ffDir, shell: useShell });
      };

      const runWithCandidate = (index: number) => {
        if (index >= candidates.length) {
          sendLog('[error] ffmpeg not found or failed to start after multiple attempts');
          return resolve({ code: 1 });
        }
        const cmd = candidates[index];
        let child = trySpawn(cmd, false);
        let errored = false;
        const onError = (err: NodeJS.ErrnoException) => {
          errored = true;
          sendLog(`[error] ffmpeg spawn error (${cmd}): ${err.code || ''} ${String(err)}`);
          if (process.platform === 'win32' && index === 0) {
            try {
              const shellChild = trySpawn(cmd, true);
              wire(shellChild);
              child = shellChild;
              return;
            } catch {}
          }
          runWithCandidate(index + 1);
        };
        const onClose = (code: number | null) => {
          if (errored) return;
          resolve({ code, outputPath: code === 0 ? outputPath : undefined });
        };
        const wire = (proc: ChildProcessWithoutNullStreams) => {
          proc.stdout.setEncoding('utf8');
          proc.stderr.setEncoding('utf8');
          proc.stdout.on('data', (chunk: string) => {
            chunk.split(/\r?\n/).forEach((line) => { if (line) sendLog(line); });
          });
          proc.stderr.on('data', (chunk: string) => {
            chunk.split(/\r?\n/).forEach((line) => { if (line) sendLog(line); });
          });
          proc.on('error', onError);
          proc.on('close', onClose);
        };
        wire(child);
      };

      runWithCandidate(0);
    } catch (err) {
      sendLog(`[error] ffmpeg transcode failed: ${String(err)}`);
      resolve({ code: 1 });
    }
  });
}

ipcMain.handle('start-download', async (event, payload: { url: string; outputDir: string }) => {
  const { url, outputDir } = payload || ({} as any);

  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Please enter a valid URL.' };
  }

  if (!outputDir || typeof outputDir !== 'string') {
    return { success: false, error: 'Please choose an output folder.' };
  }

  try {
    const downloadId = crypto.randomUUID();
    try {
      insertDownloadRow({ id: downloadId, url: url.trim(), outputDir: outputDir.trim(), startedAt: Date.now() });
    } catch {}

    // Fire-and-forget worker to run spawn and emit completion
    (async () => {
      let lastPath = '';
      try {
        const result = await spawnYtDlp(url.trim(), outputDir.trim(), (line) => {
          const text = line.trim();
          // Try to extract a full file path from common yt-dlp messages
          const barePath = /^(?:[a-zA-Z]:\\|\/)\S.*\.(mp4|mkv|webm|mp3|m4a|opus|aac|flac|wav)$/i;
          const destinationLine = /^(?:\[download\]\s+)?Destination:\s+((?:[a-zA-Z]:\\|\/)\S.*\.(?:mp4|mkv|webm|mp3|m4a|opus|aac|flac|wav))$/i;
          const movingLine = /^(?:\[download\]\s+)?Moving to:\s+((?:[a-zA-Z]:\\|\/)\S.*\.(?:mp4|mkv|webm|mp3|m4a|opus|aac|flac|wav))$/i;
          if (barePath.test(text)) {
            lastPath = text;
          } else {
            const dm = text.match(destinationLine) || text.match(movingLine);
            if (dm && dm[1]) lastPath = dm[1];
          }
          event.sender.send('download-log', line, downloadId);
          try {
            const level = /^\[error\]/i.test(text)
              ? 'error'
              : /^\[debug\]/i.test(text)
              ? 'debug'
              : /^\[download\]/i.test(text)
              ? 'progress'
              : 'info';
            insertLogRow(downloadId, line, level);
          } catch {}
        });

        if (result.code === 0) {
          // If we couldn't detect the path from logs, try to pick the newest media file in the output directory
          if (!lastPath) {
            try {
              const candidates = await fs.promises.readdir(outputDir).then((names) => names
                .filter((n) => /\.(mp4|mkv|webm|mp3|m4a|opus|aac|flac|wav|ogg)$/i.test(n))
                .map((n) => path.join(outputDir, n)));
              const stats = await Promise.all(candidates.map(async (p) => ({ p, t: (await fs.promises.stat(p)).mtimeMs })));
              const newest = stats.sort((a, b) => b.t - a.t)[0];
              if (newest) {
                lastPath = newest.p;
                event.sender.send('download-log', `[info] Detected latest output file: ${lastPath}`, downloadId);
              }
            } catch {}
          }

          const isTargetAudio = /\.(m4a|aac)$/i.test(lastPath);
          if (lastPath && !isTargetAudio) {
            event.sender.send('download-log', '[info] Starting audio transcode to AAC (.m4a)…', downloadId);
            const tx = await spawnFfmpegTranscode(lastPath, (line) => event.sender.send('download-log', line, downloadId));
            const outPath = (tx && typeof tx.outputPath === 'string') ? tx.outputPath : '';
            if (tx.code === 0 && outPath) {
              // Attempt to remove the original source file to avoid duplicates
              try {
                if (lastPath && lastPath !== outPath) {
                  await fs.promises.unlink(lastPath);
                  event.sender.send('download-log', `[info] Removed source file: ${lastPath}` as any, downloadId);
                }
              } catch (remErr) {
                event.sender.send('download-log', `[warn] Could not remove source file: ${lastPath} (${String(remErr)})` as any, downloadId);
              }
              try { updateDownloadCompleted({ id: downloadId, filePath: outPath, error: null, completedAt: Date.now(), status: 'completed' }); } catch {}
              event.sender.send('download-complete', { id: downloadId, success: true, path: outPath || '' });
            } else {
              const msg = 'Transcode failed after download.';
              try { updateDownloadCompleted({ id: downloadId, filePath: lastPath || null, error: msg, completedAt: Date.now(), status: 'error' }); } catch {}
              event.sender.send('download-complete', { id: downloadId, success: false, error: msg });
            }
          } else {
            try { updateDownloadCompleted({ id: downloadId, filePath: lastPath || null, error: null, completedAt: Date.now(), status: 'completed' }); } catch {}
            event.sender.send('download-complete', { id: downloadId, success: true, path: lastPath || '' });
          }
        } else {
          const details = (result.stderr || result.stdout || '').split('\n').find((l) => /error|Traceback|Exception/i.test(l)) || '';
          const humanMessage = result.code === null
            ? 'Download failed. Python may be missing.'
            : `yt-dlp exited with code ${result.code}.${details ? ' ' + details : ''}`;
          try { updateDownloadCompleted({ id: downloadId, filePath: lastPath || null, error: humanMessage, completedAt: Date.now(), status: 'error' }); } catch {}
          event.sender.send('download-complete', { id: downloadId, success: false, error: humanMessage });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        try { updateDownloadCompleted({ id: downloadId, filePath: lastPath || null, error: message, completedAt: Date.now(), status: 'error' }); } catch {}
        event.sender.send('download-complete', { id: downloadId, success: false, error: message });
      }
    })();

    // Return immediately with the id so renderer can track concurrently
    return { success: true, id: downloadId } as any;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
});
