# Build a self-contained yt-dlp.exe from local source using PyInstaller
$ErrorActionPreference = "Stop"

function Get-PythonExe {
  if (Get-Command py -ErrorAction SilentlyContinue) { return "py" }
  if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
  throw "Python not found. Install Python 3."
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$PyDir = Join-Path $Root "yt-dlp"
$OutDir = Join-Path $Root "vendor\bin"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$py = Get-PythonExe
# Create an isolated venv
$venv = Join-Path $Root ".venv-ytdlp-win"
& $py -3 -m venv $venv
$venvPy = Join-Path $venv "Scripts\python.exe"

& $venvPy -m pip install --upgrade pip pyinstaller | Write-Output

# Build args from vendor\extractors.txt if present
$extractorsFile = Join-Path $Root "vendor\extractors.txt"
$hiddenImports = @()
if (Test-Path $extractorsFile) {
  Get-Content $extractorsFile | ForEach-Object {
    $line = $_ -replace '#.*$','' | ForEach-Object { $_.Trim() }
    if (-not [string]::IsNullOrWhiteSpace($line)) {
      $hiddenImports += "--hidden-import=yt_dlp.extractor.$line"
    }
  }
} else {
  $hiddenImports += "--collect-submodules=yt_dlp.extractor"
}

# Run PyInstaller directly on local source
$specArgs = @(
  "--onefile",
  "--name","yt-dlp",
  "--console",
  "--paths", $PyDir,
  "-F",
  "-n","yt-dlp",
  "-y",
  "--collect-submodules","yt_dlp"
) + $hiddenImports + @(
  (Join-Path $PyDir "yt_dlp\__main__.py")
)

& $venvPy -m PyInstaller @specArgs | Write-Output

$built = Join-Path $Root "dist\yt-dlp.exe"
if (-not (Test-Path $built)) { throw "Build failed: dist\yt-dlp.exe not found" }
Copy-Item -Force $built (Join-Path $OutDir "yt-dlp.exe")
Write-Host "Vendored yt-dlp written to $OutDir"