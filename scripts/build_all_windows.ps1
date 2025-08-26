# Build vendored binaries and package the Electron app for Windows
$ErrorActionPreference = "Stop"

# Resolve repo root
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

# 0) Ensure deps
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { throw "[fatal] bun is required" }
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) { throw "[fatal] python is required" }

# 1) JS deps
Write-Host "[info] Installing JS dependencies with bun"
bun install

# 2) Prune yt-dlp (optional)
Write-Host "[info] Pruning yt-dlp sources (optional)"
try { bun run prune:yt-dlp } catch { Write-Host "[warn] prune step failed/skipped" }

# 3) Build vendored yt-dlp via PyInstaller (Windows exe)
Write-Host "[info] Building vendored yt-dlp (PyInstaller)"
powershell -ExecutionPolicy Bypass -File "$Root/scripts/build_vendored_yt_dlp.ps1"

# 4) Build vendored ffmpeg (Windows): try MSYS2 build, otherwise fetch prebuilt static
Write-Host "[info] Building vendored ffmpeg/ffprobe (MSYS2 or static fetch)"
powershell -ExecutionPolicy Bypass -File "$Root/scripts/build_vendored_ffmpeg_windows.ps1"

# 5) Build renderer/main
Write-Host "[info] Bundling Electron app"
bun run build

# 6) Package NSIS installer
Write-Host "[info] Packaging NSIS installer"
npx electron-builder --win nsis --x64

Write-Host "[done] Windows build complete. Artifacts in release/"
Get-ChildItem -Recurse -Path "$Root\release" -Filter "*.exe" | ForEach-Object { Write-Host "[artifact]" $_.FullName }
