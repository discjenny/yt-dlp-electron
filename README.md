# yt-dlp Desktop (Electron + React + Bun)

Dev commands:

- Build and run: `bun run start`
- Just build: `bun run build`

This app provides a minimal UI around `yt-dlp`.

Vendoring binaries (developer workflow):

```bash
# 1) Prune extra sources to shrink size (optional during dev)
bun run prune:yt-dlp

# 2) Build a self-contained yt-dlp binary from local source
./scripts/build_vendored_yt_dlp.sh

# 3) Build a minimal static ffmpeg/ffprobe pair
./scripts/build_vendored_ffmpeg.sh

# 4) Package (AppImage for Linux right now)
npx electron-builder --linux AppImage
```

The app will prefer `vendor/bin/yt-dlp` and `vendor/bin/ffmpeg|ffprobe`. If absent, it falls back to Python `-m yt_dlp` from the local `yt-dlp/` checkout.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.20. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
