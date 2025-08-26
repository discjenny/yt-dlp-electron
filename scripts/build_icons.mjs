#!/usr/bin/env node
// Build platform icons from icon.svg
// - Windows: build/icons/icon.ico (sizes 16..256)
// - Linux:   build/icons/icon.png (512x512)
// If icon.svg is missing, the script is a no-op.

import fs from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const projectRoot = process.cwd();
const srcSvg = path.resolve(projectRoot, 'icon.svg');
const outDir = path.resolve(projectRoot, 'build', 'icons');

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try {
    await access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function generatePng(size, dst) {
  const svg = await readFile(srcSvg);
  const png = await sharp(svg, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(dst, png);
  return png;
}

async function main() {
  if (!(await fileExists(srcSvg))) {
    console.log('[icons] icon.svg not found. Skipping icon generation.');
    return;
  }

  await ensureDir(outDir);

  console.log('[icons] Generating PNGs...');
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const buffers = {};
  for (const s of sizes) {
    const outPath = path.join(outDir, `icon-${s}.png`);
    buffers[s] = await generatePng(s, outPath);
  }

  // Linux primary icon (512x512)
  const linuxPng = path.join(outDir, 'icon.png');
  await writeFile(linuxPng, buffers[512]);
  console.log('[icons] Wrote', linuxPng);

  // Windows ICO (16..256)
  console.log('[icons] Generating ICO...');
  const icoBuf = await pngToIco([
    buffers[16], buffers[24], buffers[32], buffers[48], buffers[64], buffers[128], buffers[256],
  ]);
  const icoPath = path.join(outDir, 'icon.ico');
  await writeFile(icoPath, icoBuf);
  console.log('[icons] Wrote', icoPath);

  // Also duplicate to build/icon.* so electron-builder default resolution finds it
  const buildDir = path.resolve(projectRoot, 'build');
  await ensureDir(buildDir);
  await writeFile(path.join(buildDir, 'icon.ico'), icoBuf);
  await writeFile(path.join(buildDir, 'icon.png'), buffers[512]);

  // Note: macOS .icns not generated here; electron-builder can fall back to default on mac.
  // If needed later, we can add icon-gen to produce .icns from SVG/PNG without affecting Linux.
}

main().catch((err) => {
  console.error('[icons] Failed:', err?.stack || String(err));
  process.exit(1);
});
