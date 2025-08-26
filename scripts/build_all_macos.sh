#!/usr/bin/env bash
set -euo pipefail

# Build vendored binaries and package the Electron app for macOS

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

# 4) Build vendored ffmpeg/ffprobe (macOS)
# NOTE: Building FFmpeg on macOS requires Xcode CLT and possibly homebrew for nasm/yasm.
#       You can adapt scripts/build_vendored_ffmpeg.sh for macOS by adding --arch flags and macOS SDK paths if needed.
echo "[info] Building vendored ffmpeg/ffprobe (with libfdk_aac)"
./scripts/build_vendored_ffmpeg.sh || { echo "[warn] FFmpeg build skipped/failed; ensure vendor/bin/ffmpeg & ffprobe exist."; }

# 5) Build renderer/main
echo "[info] Bundling Electron app"
bun run build || { echo "[fatal] bundling failed"; exit 1; }

# 6) Package DMG
echo "[info] Packaging DMG"
npx electron-builder --mac dmg || { echo "[fatal] packaging failed"; exit 1; }

echo "[done] macOS build complete. Artifacts in release/"