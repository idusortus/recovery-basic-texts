// Rasterizes the committed PWA icon sources under assets/pwa/ into the PNGs
// served from static/icons/. Run with `pnpm run icons:pwa`.
//
// The SVG sources carry the "bt" monogram as vector outlines, so this script
// only rasterizes; it never typesets text and never needs a font installed.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = resolve(root, 'assets/pwa');
const iconsDir = resolve(root, 'static/icons');

// [output name, source svg, pixel size]
const outputs = [
	['icon-192.png', 'icon.svg', 192],
	['icon-512.png', 'icon.svg', 512],
	['icon-maskable-512.png', 'icon-maskable.svg', 512],
	['apple-touch-icon.png', 'icon-maskable.svg', 180]
];

const sources = new Map();
async function loadSource(name) {
	if (!sources.has(name)) {
		sources.set(name, await readFile(resolve(assetsDir, name)));
	}
	return sources.get(name);
}

await mkdir(iconsDir, { recursive: true });

for (const [outName, sourceName, size] of outputs) {
	const svg = await loadSource(sourceName);
	const png = await sharp(svg)
		.resize(size, size)
		.ensureAlpha()
		.png({ compressionLevel: 9 })
		.toBuffer();

	await writeFile(resolve(iconsDir, outName), png);
	console.log(`wrote static/icons/${outName} (${size}x${size})`);
}
