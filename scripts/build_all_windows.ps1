# Build vendored binaries and package the Electron app for Windows
$ErrorActionPreference = "Stop"

# Resolve repo root
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

# 0) Ensure deps
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { throw "bun is required" }
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) { throw "python is required" }

# 1) JS deps
bun install

# 2) Prune yt-dlp (optional)
bun run prune:yt-dlp

# 3) Build vendored yt-dlp via PyInstaller (Windows exe)
& "$Root/scripts/build_vendored_yt_dlp.sh"

# 4) Build vendored ffmpeg (Windows)
# NOTE: Building FFmpeg on Windows requires MSYS2 or a prebuilt toolchain. Consider using
#       a preconfigured build system or adjust this script to your environment.
Write-Host "Skipping FFmpeg build on Windows. Place ffmpeg.exe and ffprobe.exe in vendor/bin."

# 5) Build renderer/main
bun run build

# 6) Package NSIS installer
npx electron-builder --win nsis

Write-Host "Windows build complete. Artifacts in release/"
