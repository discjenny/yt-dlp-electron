#!/usr/bin/env bash
set -euo pipefail

# Build vendored binaries and package the Electron app for Linux

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

# 0) Ensure deps
command -v bun >/dev/null || { echo "[fatal] bun is required"; exit 1; }
command -v python3 >/dev/null || { echo "[fatal] python3 is required"; exit 1; }
command -v git >/dev/null || { echo "[fatal] git is required"; exit 1; }

# 1) Install JS deps
echo "[info] Installing JS dependencies with bun"
bun install

# 2) Prune Python sources (optional)
echo "[info] Pruning yt-dlp sources (optional)"
bun run prune:yt-dlp || echo "[warn] prune step failed/skipped"

# 3) Build vendored yt-dlp (single-file)
echo "[info] Building vendored yt-dlp (PyInstaller)"
./scripts/build_vendored_yt_dlp.sh || { echo "[fatal] yt-dlp build failed"; exit 1; }

# 4) Build vendored ffmpeg/ffprobe
echo "[info] Building vendored ffmpeg/ffprobe (with libfdk_aac)"
./scripts/build_vendored_ffmpeg.sh || { echo "[fatal] ffmpeg build failed"; exit 1; }

# 5) Build renderer/main
echo "[info] Bundling Electron app"
bun run build || { echo "[fatal] bundling failed"; exit 1; }

# 6) Package AppImage
echo "[info] Packaging AppImage"
npx electron-builder --linux AppImage || { echo "[fatal] packaging failed"; exit 1; }

echo "[done] Linux build complete. Artifacts in release/"