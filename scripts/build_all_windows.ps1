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
if ($LASTEXITCODE -ne 0) { throw "[fatal] bun install failed" }

# 2) Prune yt-dlp (optional)
Write-Host "[info] Pruning yt-dlp sources (optional)"
try { bun run prune:yt-dlp } catch { Write-Host "[warn] prune step failed/skipped" }

# 3) Build vendored yt-dlp via PyInstaller (Windows exe)
Write-Host "[info] Building vendored yt-dlp (PyInstaller)"
powershell -ExecutionPolicy Bypass -File "$Root/scripts/build_vendored_yt_dlp.ps1"
if ($LASTEXITCODE -ne 0) { throw "[fatal] vendored yt-dlp build failed" }

# 4) Build vendored ffmpeg (Windows): try MSYS2 build, otherwise fetch prebuilt static
Write-Host "[info] Building vendored ffmpeg/ffprobe (MSYS2 or static fetch)"
powershell -ExecutionPolicy Bypass -File "$Root/scripts/build_vendored_ffmpeg_windows.ps1"
if ($LASTEXITCODE -ne 0) { throw "[fatal] vendored ffmpeg/ffprobe build failed" }

# 5) Build renderer/main
Write-Host "[info] Bundling Electron app"
bun run build
if ($LASTEXITCODE -ne 0) { throw "[fatal] bundling failed" }

# 6) Create unpacked app (dir) so we can force-set exe icon, then build NSIS from prepackaged
Write-Host "[info] Creating unpacked app (dir target)"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:CSC_LINK = ""
$env:WIN_CSC_LINK = ""
npx electron-builder --win dir --x64
if ($LASTEXITCODE -ne 0) { throw "[fatal] electron-builder dir target failed" }

# 6.1) Force apply icon to exe using rcedit (fallback to installing if missing)
$rcedit = Join-Path $Root "node_modules\rcedit\bin\rcedit-x64.exe"
if (-not (Test-Path $rcedit)) {
  Write-Host "[info] Installing rcedit dev dependency to set exe icon"
  bun add -d rcedit | Out-Null
}
$rcedit = Join-Path $Root "node_modules\rcedit\bin\rcedit-x64.exe"
if (Test-Path $rcedit) {
  $exePath = Join-Path $Root "release\win-unpacked\ytdlp-desktop.exe"
  $icoPath = Join-Path $Root "build\icon.ico"
  if (-not (Test-Path $icoPath)) { $icoPath = Join-Path $Root "build\icons\icon.ico" }
  if (Test-Path $exePath -and (Test-Path $icoPath)) {
    Write-Host "[info] Applying icon to exe via rcedit"
    & $rcedit "$exePath" --set-icon "$icoPath"
  } else {
    Write-Host "[warn] Skipping rcedit (exe or icon not found)"
  }
} else {
  Write-Host "[warn] rcedit not available; skipping explicit exe icon set"
}

# 6.2) Package NSIS installer from prepackaged folder (no code signing)
Write-Host "[info] Packaging NSIS installer (prepackaged)"
npx electron-builder --prepackaged "$Root\release\win-unpacked" --win nsis --x64
if ($LASTEXITCODE -ne 0) { throw "[fatal] electron-builder packaging (prepackaged) failed" }

Write-Host "[done] Windows build complete. Artifacts in release/"
Get-ChildItem -Recurse -Path "$Root\release" -Filter "*.exe" | ForEach-Object { Write-Host "[artifact]" $_.FullName }
