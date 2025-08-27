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
      const vendoredFfmpegDir = vendorBinDir; // keep ffmpeg and ffprobe here
      const vendoredFfmpegExe = path.join(vendoredFfmpegDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

      // Do not use -E, we need PYTHONPATH to be honored
      const argsBase = [
        '-m', 'yt_dlp',
        '--newline', '--no-color',
        '--ignore-config',
        ...(DEBUG_ENABLED ? ['-v'] : []),
        '-f', 'bestaudio',
        '--extract-audio',
        '--audio-format', 'aac',
        '--audio-quality', '0',
        '--no-write-info-json',
        '--no-write-description',
        '--no-write-annotations',
        '--no-write-thumbnail',
        '--no-write-playlist-metafiles',
        '--no-write-comments',
        '--print', 'after_move:filepath',
      ];
      const outputTemplateArgs = ['-P', outputDir, '-o', '%(title)s.%(ext)s'];
      const fullArgs = [
        ...argsBase,
        '--ffmpeg-location', vendoredFfmpegExe,
        '--prefer-ffmpeg',
        url,
        ...outputTemplateArgs,
      ];

      // Debug info to help diagnose environment and paths
      if (DEBUG_ENABLED) {
        try {
          const ffmpegPath = path.join(vendoredFfmpegDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
          const ffprobePath = path.join(vendoredFfmpegDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
          sendLog(`[debug] Debug mode ON`);
          sendLog(`[debug] vendoredYtDlp=${vendoredYtDlp} exists=${fs.existsSync(vendoredYtDlp)}`);
          sendLog(`[debug] ffmpeg=${ffmpegPath} exists=${fs.existsSync(ffmpegPath)} | ffprobe=${ffprobePath} exists=${fs.existsSync(ffprobePath)}`);
          sendLog(`[debug] outputDir=${outputDir}`);
          sendLog(`[debug] args=${JSON.stringify(fullArgs)}`);
        } catch {}
      }

      const envBase = { ...process.env, PYTHONPATH: ytDlpRoot } as NodeJS.ProcessEnv;
      const extendedEnv: NodeJS.ProcessEnv = {
        ...envBase,
        PATH: `${vendoredFfmpegDir}${path.delimiter}${envBase.PATH || ''}`,
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
          const savedFilePattern = /^(?:[a-zA-Z]:\\|\/)\S.*\.(mp4|mkv|webm|mp3|m4a|opus|aac|flac|wav)$/i;
          if (savedFilePattern.test(text)) {
            lastPath = text;
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
          try { updateDownloadCompleted({ id: downloadId, filePath: lastPath || null, error: null, completedAt: Date.now(), status: 'completed' }); } catch {}
          event.sender.send('download-complete', { id: downloadId, success: true, path: lastPath });
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
