# yt-dlp Desktop (Electron + React + Bun)

This is a minimal, modern Electron + React UI for yt-dlp, built with Bun. It ships as a fixed-size desktop app and can bundle its own yt-dlp and ffmpeg, so end users don't need anything installed.

Build: one‑shot per platform

- Linux (AppImage in `release/`):
  - `./scripts/build_all_linux.sh`

- macOS (DMG/ZIP in `release/`):
  - `./scripts/build_all_macos.sh`

- Windows (NSIS in `release/`):
  - `powershell -ExecutionPolicy Bypass -File scripts/build_all_windows.ps1`
  - Will build yt-dlp.exe from local source and either build ffmpeg via MSYS2 or fetch a static build automatically.

Notes
- The app prefers vendored binaries placed in `vendor/bin` (`yt-dlp`, `ffmpeg`, `ffprobe`). If they are missing in dev, it falls back to `python3 -m yt_dlp` with the local `yt-dlp/` checkout.
- URL and output folder fields are persisted in localStorage.

Licensing
- This setup builds ffmpeg with libfdk_aac for highest quality AAC encoding (`--enable-nonfree`). Include the corresponding licenses.
- Licenses are provided under `LICENSES/` (ffmpeg, libfdk_aac, yt-dlp). Make sure to review before distribution.
