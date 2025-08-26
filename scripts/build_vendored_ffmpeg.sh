#!/usr/bin/env bash
set -euo pipefail

# Build FFmpeg minimal with codecs for AAC audio extraction (libfdk_aac or native aac), and mp4/m4a muxing.
# Output ffmpeg and ffprobe to vendor/bin.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/vendor/bin"
WORK_DIR="$ROOT_DIR/.build-ffmpeg"

mkdir -p "$OUT_DIR" "$WORK_DIR"
cd "$WORK_DIR"

# Fetch sources (ffmpeg and optional fdk-aac). For distro-friendly, use native aac encoder (aac) to avoid fdk license.
if [[ ! -d ffmpeg ]]; then
  git clone --depth=1 https://github.com/FFmpeg/FFmpeg.git ffmpeg
fi

cd ffmpeg

PREFIX="$WORK_DIR/prefix"
mkdir -p "$PREFIX"

# Configure minimal build
./configure \
  --prefix="$PREFIX" \
  --disable-everything \
  --enable-protocol=file \
  --enable-demuxer=mov,mp3,matroska,ogg,webm \
  --enable-muxer=ipod,mp4,adts,mp3,ogg,webm \
  --enable-bsf=aac_adtstoasc \
  --enable-parser=aac,mpegvideo,mpegaudio,opus,vorbis \
  --enable-decoder=aac,mp3,vorbis,opus \
  --enable-encoder=aac,libmp3lame \
  --enable-filter=aformat,aresample,volume \
  --enable-small \
  --disable-doc \
  --disable-debug \
  --disable-network \
  --disable-avdevice \
  --enable-static \
  --disable-shared

make -j"$(nproc)"
make install

cp -f "$PREFIX/bin/ffmpeg" "$OUT_DIR/ffmpeg" || true
cp -f "$PREFIX/bin/ffprobe" "$OUT_DIR/ffprobe" || true

strip "$OUT_DIR/ffmpeg" || true
strip "$OUT_DIR/ffprobe" || true

echo "Vendored ffmpeg/ffprobe written to $OUT_DIR"