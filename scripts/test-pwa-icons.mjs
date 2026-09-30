#!/usr/bin/env node
/**
 * Dependency-free checks for the committed PWA icon set.
 *
 * Run with: `pnpm run test:pwa-icons`.
 *
 * Reads the PNG IHDR chunk directly (no image library) to assert the four
 * generated icons exist at the sizes the manifest and app shell declare, and
 * greps `vite.config.ts` to assert the maskable manifest entry points at the
 * dedicated maskable asset rather than reusing the "any" 512px raster.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngHeader(path) {
	const buf = readFileSync(path);
	assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), `${path} is not a PNG`);
	assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', `${path} has no IHDR chunk`);
	return {
		width: buf.readUInt32BE(16),
		height: buf.readUInt32BE(20),
		bitDepth: buf[24],
		colorType: buf[25]
	};
}

let passed = 0;
function test(name, fn) {
	try {
		fn();
		passed += 1;
		console.log(`  ok  ${name}`);
	} catch (error) {
		console.error(`FAIL  ${name}`);
		throw error;
	}
}

console.log('pwa-icons: generated raster dimensions and manifest wiring');

const expectations = [
	['icon-192.png', 192, 192],
	['icon-512.png', 512, 512],
	['icon-maskable-512.png', 512, 512],
	['apple-touch-icon.png', 180, 180]
];

for (const [name, width, height] of expectations) {
	test(`${name} exists at ${width}x${height}, 8-bit RGBA`, () => {
		const header = readPngHeader(resolve(root, 'static/icons', name));
		assert.equal(header.width, width, `${name} width`);
		assert.equal(header.height, height, `${name} height`);
		assert.equal(header.bitDepth, 8, `${name} bit depth`);
		assert.equal(header.colorType, 6, `${name} colour type (RGBA)`);
	});
}

const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');

test('manifest keeps the 192 and 512 "any" icon paths', () => {
	assert.match(viteConfig, /src:\s*'\/icons\/icon-192\.png'/);
	assert.match(viteConfig, /src:\s*'\/icons\/icon-512\.png'/);
});

test('manifest maskable entry points at the dedicated maskable asset', () => {
	const maskable = viteConfig.match(/\{[^{}]*purpose:\s*'maskable'[^{}]*\}/);
	assert.ok(maskable, 'a maskable icon entry exists in vite.config.ts');
	assert.match(maskable[0], /src:\s*'\/icons\/icon-maskable-512\.png'/);
	assert.doesNotMatch(maskable[0], /\/icons\/icon-512\.png/);
});

console.log(`\n${passed} pwa-icon checks passed`);
