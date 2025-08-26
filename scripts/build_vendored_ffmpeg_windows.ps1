# Build or fetch ffmpeg/ffprobe for Windows into vendor/bin
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $Root "vendor\bin"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Strategy: if MSYS2 is installed, attempt a local build. Otherwise, fallback to
# downloading a known-good static build (Gyan.dev). You can replace this URL source
# with your preferred reproducible artifacts provider.

function Test-MSYS2 {
  return (Test-Path "C:\\msys64\\usr\\bin\\bash.exe")
}

function Build-With-MSYS2 {
  $bash = "C:\\msys64\\usr\\bin\\bash.exe"
  if (-not (Test-Path $bash)) { return $false }
  # Build libfdk-aac and ffmpeg with nonfree enabled for best AAC quality
  & $bash -lc "set -e; pacman -S --noconfirm --needed git base-devel yasm nasm autoconf automake libtool; \
    mkdir -p /c/_ffbuild && cd /c/_ffbuild; \
    rm -rf fdk-aac FFmpeg; \
    git clone --depth=1 https://github.com/mstorsjo/fdk-aac.git fdk-aac; \
    cd fdk-aac; autoreconf -fiv || true; ./configure --prefix=/c/_deps --disable-shared --enable-static; make -j$(nproc); make install; \
    cd /c/_ffbuild; git clone --depth=1 https://github.com/FFmpeg/FFmpeg.git FFmpeg; \
    cd FFmpeg; export PKG_CONFIG_PATH=/c/_deps/lib/pkgconfig:$PKG_CONFIG_PATH; \
    ./configure --toolchain=msvc --disable-everything --enable-protocol=file --enable-demuxer=mov,mp3,matroska,ogg,webm --enable-muxer=ipod,mp4,adts,mp3,ogg,webm --enable-bsf=aac_adtstoasc --enable-parser=aac,mpegvideo,mpegaudio,opus,vorbis --enable-decoder=aac,mp3,vorbis,opus --enable-libfdk-aac --enable-encoder=libfdk_aac --enable-filter=aformat,aresample,volume --enable-small --disable-doc --disable-debug --disable-network --disable-avdevice --enable-static --disable-shared --enable-nonfree; \
    make -j$(nproc); make install DESTDIR=/c/_ffout" | Write-Output
  $src = "C:\\_ffout\\usr\\local\\bin"
  if ((Test-Path "$src\\ffmpeg.exe") -and (Test-Path "$src\\ffprobe.exe")) {
    Copy-Item -Force "$src\\ffmpeg.exe" (Join-Path $OutDir "ffmpeg.exe")
    Copy-Item -Force "$src\\ffprobe.exe" (Join-Path $OutDir "ffprobe.exe")
    return $true
  }
  return $false
}

function Fetch-Prebuilt {
  # Gyan.dev static build (x64). Update to a pinned URL as desired.
  $zipUrl = "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-7.0.2-essentials_build.zip"
  $tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "ffmzip")
  $zipPath = Join-Path $tmp.FullName "ff.zip"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  $extractTo = Join-Path $tmp.FullName "x"
  Expand-Archive -Path $zipPath -DestinationPath $extractTo -Force
  $bin = Get-ChildItem -Path $extractTo -Recurse -Filter ffmpeg.exe | Select-Object -First 1
  if (-not $bin) { throw "ffmpeg.exe not found in downloaded package" }
  $root = Split-Path $bin.FullName -Parent
  Copy-Item -Force (Join-Path $root "ffmpeg.exe") (Join-Path $OutDir "ffmpeg.exe")
  Copy-Item -Force (Join-Path $root "ffprobe.exe") (Join-Path $OutDir "ffprobe.exe")
}

if (Test-Path (Join-Path $OutDir "ffmpeg.exe") -and Test-Path (Join-Path $OutDir "ffprobe.exe")) {
  Write-Host "ffmpeg/ffprobe already exist in vendor\\bin"
} else {
  if (Test-MSYS2) {
    if (-not (Build-With-MSYS2)) { Fetch-Prebuilt }
  } else {
    Fetch-Prebuilt
  }
}

Write-Host "Vendored ffmpeg/ffprobe ready in vendor\\bin"