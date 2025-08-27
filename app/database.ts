import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

// Lazy import to avoid hard dependency during development if sqlite3 isn't installed yet.
let sqlite3: typeof import('sqlite3') | null = null;
let warnedMissing = false;
type Database = import('sqlite3').Database;

function ensureSqliteLoaded(): boolean {
  if (sqlite3) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sqlite3 = require('sqlite3');
    return true;
  } catch {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn('History logging disabled: sqlite3 module not installed.');
    }
    return false;
  }
}

let db: Database | null = null;

export function getDatabasePath(): string {
  const base = app.getPath('userData');
  return path.join(base, 'history.sqlite3');
}

export function initDatabase(): void {
  if (!ensureSqliteLoaded()) {
    return; // Skip DB setup when sqlite3 isn't available
  }
  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new sqlite3!.Database(dbPath);
  db.serialize(() => {
    db!.run(
      `CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        output_dir TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        file_path TEXT,
        error TEXT
      )`
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        download_id TEXT NOT NULL,
        ts INTEGER NOT NULL,
        level TEXT,
        line TEXT NOT NULL,
        FOREIGN KEY(download_id) REFERENCES downloads(id)
      )`
    );
    db!.run(`CREATE INDEX IF NOT EXISTS idx_logs_download_id ON logs(download_id)`);
  });
}

export function insertDownloadRow(payload: {
  id: string;
  url: string;
  outputDir: string;
  startedAt: number;
}): void {
  if (!db) return;
  const stmt = db.prepare(
    `INSERT INTO downloads (id, url, output_dir, status, started_at) VALUES (?, ?, ?, 'downloading', ?)`
  );
  stmt.run(payload.id, payload.url, payload.outputDir, payload.startedAt);
  stmt.finalize();
}

export function updateDownloadCompleted(payload: {
  id: string;
  filePath: string | null;
  error: string | null;
  completedAt: number;
  status: 'completed' | 'error';
}): void {
  if (!db) return;
  const stmt = db.prepare(
    `UPDATE downloads SET status = ?, completed_at = ?, file_path = COALESCE(?, file_path), error = COALESCE(?, error) WHERE id = ?`
  );
  stmt.run(payload.status, payload.completedAt, payload.filePath, payload.error, payload.id);
  stmt.finalize();
}

export function insertLogRow(downloadId: string, line: string, level?: string): void {
  if (!db) return;
  const ts = Date.now();
  const stmt = db.prepare(
    `INSERT INTO logs (download_id, ts, level, line) VALUES (?, ?, ?, ?)`
  );
  stmt.run(downloadId, ts, level || null, line);
  stmt.finalize();
}

export function closeDatabase(): void {
  if (!db) return;
  try {
    db.close();
  } catch {}
  db = null;
}


