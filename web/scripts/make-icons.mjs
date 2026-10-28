// Generates PWA icons from the official Zilla logo (public/zilla-logo-official.svg).
// Run: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }));

const BG = '#0a0a0a'; // --esc-ink (dark theme, the default)
const logo = readFileSync(new URL('../public/zilla-logo-official.svg', import.meta.url), 'utf8')
  .replace(/<svg[^>]*>/, '').replace('</svg>', '');

// scale = share of the canvas the logo occupies (maskable keeps it inside the 80% safe zone)
const svg = (scale) => {
  const s = 1600 * scale, o = (1600 - s) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600"><rect width="1600" height="1600" fill="${BG}"/><g transform="translate(${o} ${o}) scale(${scale})">${logo}</g></svg>`);
};

const out = [
  ['public/icons/icon-192.png', 192, 0.9],
  ['public/icons/icon-512.png', 512, 0.9],
  ['public/icons/maskable-192.png', 192, 0.66],
  ['public/icons/maskable-512.png', 512, 0.66],
  ['src/app/apple-icon.png', 180, 0.82],
];
for (const [file, size, scale] of out) {
  await sharp(svg(scale), { density: 300 }).resize(size, size).png().toFile(new URL(`../${file}`, import.meta.url).pathname);
  console.log(file, size);
}

// favicon.ico for browsers and crawlers that request it directly: the same flat logo on the
// dark tile at 16, 32 and 48 px, stored as PNG images inside one ICO container.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(svg(0.9), { density: 300 }).resize(s, s).png().toBuffer()));
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] % 256, 0); e.writeUInt8(sizes[i] % 256, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('../src/app/favicon.ico', import.meta.url), Buffer.concat([header, ...entries, ...pngs]));
console.log('src/app/favicon.ico', sizes.join('/'));
