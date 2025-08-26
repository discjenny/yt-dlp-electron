#!/usr/bin/env bash
set -euo pipefail

# Build a self-contained yt-dlp executable using PyInstaller with optional
# extractor slimming. Output goes to vendor/bin/yt-dlp (and .exe on Windows
# via cross-compile separately).

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
PY_DIR="$ROOT_DIR/yt-dlp"
OUT_DIR="$ROOT_DIR/vendor/bin"

mkdir -p "$OUT_DIR"

# Use a venv to keep things tidy
VENV_DIR="$ROOT_DIR/.venv-ytdlp"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip wheel
pip install pyinstaller

# Build arguments
EXTRACTORS_FILE="$ROOT_DIR/vendor/extractors.txt"
HIDDEN_IMPORTS=()
if [[ -f "$EXTRACTORS_FILE" ]]; then
  while IFS= read -r name; do
    name_trimmed=$(echo "$name" | sed 's/#.*$//' | xargs)
    [[ -z "$name_trimmed" ]] && continue
    HIDDEN_IMPORTS+=("--hidden-import=yt_dlp.extractor.${name_trimmed}")
  done < "$EXTRACTORS_FILE"
else
  # Fallback: collect all extractors. Larger, but ensures functionality.
  HIDDEN_IMPORTS=("--collect-submodules=yt_dlp.extractor")
fi

# Create a minimal one-file binary directly from local source (no pip install)
pyinstaller \
  --onefile \
  --name yt-dlp \
  --console \
  --paths "$PY_DIR" \
  -s \
  -i NONE \
  -F \
  -n yt-dlp \
  -y \
  --collect-submodules yt_dlp \
  "${HIDDEN_IMPORTS[@]}" \
  "$PY_DIR/yt_dlp/__main__.py"

# Move binary to vendor/bin
if [[ -f "dist/yt-dlp" ]]; then
  mv dist/yt-dlp "$OUT_DIR/yt-dlp"
elif [[ -f "dist/yt-dlp.exe" ]]; then
  mv dist/yt-dlp.exe "$OUT_DIR/yt-dlp.exe"
else
  echo "Build failed: dist/yt-dlp[.exe] not found" >&2
  exit 1
fi

chmod +x "$OUT_DIR/yt-dlp" 2>/dev/null || true

echo "Vendored yt-dlp written to $OUT_DIR"