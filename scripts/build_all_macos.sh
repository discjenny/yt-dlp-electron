#!/usr/bin/env bash
set -euo pipefail

# Build vendored binaries and package the Electron app for macOS

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

# 4) Build vendored ffmpeg/ffprobe (macOS)
# NOTE: Building FFmpeg on macOS requires Xcode CLT and possibly homebrew for nasm/yasm.
#       You can adapt scripts/build_vendored_ffmpeg.sh for macOS by adding --arch flags and macOS SDK paths if needed.
./scripts/build_vendored_ffmpeg.sh || echo "FFmpeg build skipped/failed; ensure vendor/bin/ffmpeg & ffprobe exist."

# 5) Build renderer/main
bun run build

# 6) Package DMG
npx electron-builder --mac dmg

echo "macOS build complete. Artifacts in release/"