import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function svgToPng(svgPath, outDir, sizes) {
  const svg = await fs.readFile(svgPath);
  await ensureDir(outDir);
  const outPaths = [];
  for (const size of sizes) {
    const p = path.join(outDir, `icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(p);
    outPaths.push(p);
  }
  return outPaths;
}

async function build() {
  const root = process.cwd();
  const svgPath = path.join(root, 'icon.svg');
  const outDir = path.join(root, 'build', 'icons');
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

  try {
    await fs.access(svgPath);
  } catch {
    console.warn('[icons] icon.svg not found at project root; skipping icon build');
    return;
  }

  const pngs = await svgToPng(svgPath, outDir, sizes);

  // Windows ICO
  const icoPath = path.join(outDir, 'icon.ico');
  const icoBuf = await pngToIco(pngs.filter(p => /(16|24|32|48|64)\.png$/.test(p)));
  await fs.writeFile(icoPath, icoBuf);

  // macOS ICNS: electron-builder will read PNGs from icon set dir if given base path
  // We will also output a base icon as PNG that electron-builder can pick on Linux/macOS
  const basePng = path.join(outDir, 'icon.png');
  await fs.copyFile(pngs[pngs.length - 1], basePng);

  console.log(`[icons] Wrote ${pngs.length} PNGs, ICO at ${icoPath}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
