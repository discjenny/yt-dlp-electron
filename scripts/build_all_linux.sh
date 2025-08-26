#!/usr/bin/env bash
set -euo pipefail

# Build vendored binaries and package the Electron app for Linux

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

# 0) Ensure deps
command -v bun >/dev/null || { echo "bun is required"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
command -v git >/dev/null || { echo "git is required"; exit 1; }

# 1) Install JS deps
bun install

# 2) Prune Python sources (optional)
bun run prune:yt-dlp || true

# 3) Build vendored yt-dlp (single-file)
./scripts/build_vendored_yt_dlp.sh

# 4) Build vendored ffmpeg/ffprobe
./scripts/build_vendored_ffmpeg.sh

# 5) Build renderer/main
bun run build

# 6) Package AppImage
npx electron-builder --linux AppImage

echo "Linux build complete. Artifacts in release/"