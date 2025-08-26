# yt-dlp Desktop (Electron + React + Bun)

This is a minimal, modern Electron + React UI for yt-dlp, built with Bun. It ships as a fixed-size desktop app and can bundle its own yt-dlp and ffmpeg, so end users don't need anything installed.

Quick start (dev)
- Build and run: `bun run start`
- Build only: `bun run build`

Persistence
- The URL and output folder fields are saved in `localStorage` and restored on launch.

Vendored binaries (recommended for releases)
- The app prefers vendored binaries if present: `vendor/bin/yt-dlp`, `vendor/bin/ffmpeg`, `vendor/bin/ffprobe`.
- If not found, it falls back to `python3 -m yt_dlp` using the local `yt-dlp/` source tree.

Build vendored binaries from source
```bash
# 1) Prune nonessential files from yt-dlp source (optional)
bun run prune:yt-dlp

# 2) Freeze yt-dlp from local source with PyInstaller
./scripts/build_vendored_yt_dlp.sh

# Optional: choose extractors to include (reduces size)
# Edit one per line in vendor/extractors.txt, e.g.:
#   youtube
#   generic

# 3) Build a minimal ffmpeg/ffprobe
./scripts/build_vendored_ffmpeg.sh
```

One‑shot platform builds
- Linux: `./scripts/build_all_linux.sh` (AppImage in `release/`)
- macOS: `./scripts/build_all_macos.sh` (DMG/ZIP in `release/`)
- Windows: `powershell -ExecutionPolicy Bypass -File scripts/build_all_windows.ps1` (NSIS in `release/`)
  - Note: the Windows script expects `vendor/bin/ffmpeg.exe` and `vendor/bin/ffprobe.exe` to exist. You can adapt the ffmpeg build for MSYS2 or drop prebuilt binaries in that folder.

Packaging details
- electron-builder configuration embeds `dist/**` and maps `vendor/bin/**` into `resources/bin` (outside ASAR) so the executables run at runtime.
- Artifacts are written to `release/`.

License notes
- Include licenses for ffmpeg and yt-dlp in your distribution if required. The provided ffmpeg build script uses the native AAC encoder to avoid libfdk_aac licensing complexities.
