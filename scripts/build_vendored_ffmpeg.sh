#!/usr/bin/env bash
set -euo pipefail

# Build FFmpeg minimal with codecs for AAC audio extraction (libfdk_aac or native aac), and mp4/m4a muxing.
# Output ffmpeg and ffprobe to vendor/bin.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/vendor/bin"
WORK_DIR="$ROOT_DIR/.build-ffmpeg"
DEPS_PREFIX="$WORK_DIR/deps"

mkdir -p "$OUT_DIR" "$WORK_DIR" "$DEPS_PREFIX"
cd "$WORK_DIR"

# Fetch sources (ffmpeg and optional fdk-aac). For distro-friendly, use native aac encoder (aac) to avoid fdk license.
# Build libfdk-aac (static) for best AAC encoding quality
if [[ ! -d fdk-aac ]]; then
  git clone --depth=1 https://github.com/mstorsjo/fdk-aac.git fdk-aac
fi
pushd fdk-aac
autoreconf -fiv || true
./configure --prefix="$DEPS_PREFIX" --disable-shared --enable-static
make -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"
make install
popd

# Fetch FFmpeg
if [[ ! -d ffmpeg ]]; then
  git clone --depth=1 https://github.com/FFmpeg/FFmpeg.git ffmpeg
fi

cd ffmpeg

PREFIX="$WORK_DIR/prefix"
mkdir -p "$PREFIX"

# Configure minimal build
export PKG_CONFIG_PATH="$DEPS_PREFIX/lib/pkgconfig:$PKG_CONFIG_PATH"

./configure \
  --prefix="$PREFIX" \
  --disable-everything \
  --enable-protocol=file \
  --enable-demuxer=mov,mp3,matroska,ogg,webm \
  --enable-muxer=ipod,mp4,adts,mp3,ogg,webm \
  --enable-bsf=aac_adtstoasc \
  --enable-parser=aac,mpegvideo,mpegaudio,opus,vorbis \
  --enable-decoder=aac,mp3,vorbis,opus \
  --enable-libfdk-aac \
  --enable-encoder=libfdk_aac \
  --enable-filter=aformat,aresample,volume \
  --enable-small \
  --disable-doc \
  --disable-debug \
  --disable-network \
  --disable-avdevice \
  --enable-static \
  --disable-shared \
  --enable-nonfree

CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
make -j"$CORES"
make install

cp -f "$PREFIX/bin/ffmpeg" "$OUT_DIR/ffmpeg" || true
cp -f "$PREFIX/bin/ffprobe" "$OUT_DIR/ffprobe" || true

strip "$OUT_DIR/ffmpeg" || true
strip "$OUT_DIR/ffprobe" || true

echo "Vendored ffmpeg/ffprobe written to $OUT_DIR"