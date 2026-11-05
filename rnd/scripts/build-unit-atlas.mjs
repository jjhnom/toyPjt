import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { launchChrome } from './lib/chrome-cdp.mjs';

// Asset preparation only: preserves source PNGs and packs alpha-trimmed copies.
// Nothing runs during game frames; the shipped game loads one small atlas.
const root = new URL('../src/assets/units-v3/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('sources/manifest.json', root), 'utf8'));
assert.equal(manifest.length, 22);
assert.equal(new Set(manifest.map(unit => unit.id)).size, 22);
const images = await Promise.all(manifest.map(async unit => ({
  id: unit.id, data: `data:image/png;base64,${(await readFile(new URL(`sources/${unit.file}`, root))).toString('base64')}`
})));
const chrome = await launchChrome();
try {
  const atlas = await chrome.evaluate(`(async () => {
    const entries = ${JSON.stringify(images)};
    const atlas = document.createElement('canvas'); atlas.width = 768; atlas.height = 512;
    const out = atlas.getContext('2d');
    out.imageSmoothingEnabled = true; out.imageSmoothingQuality = 'high';
    const bounds = [];
    for (let i = 0; i < entries.length; i++) {
      const image = new Image(); image.src = entries[i].data; await image.decode();
      const sample = document.createElement('canvas'); sample.width = image.width; sample.height = image.height;
      const ctx = sample.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
      let left = image.width, top = image.height, right = 0, bottom = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (pixels[(y * image.width + x) * 4 + 3] <= 24) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right <= left || bottom <= top) throw new Error('Empty unit source: ' + entries[i].id);
      const w = right - left + 1, h = bottom - top + 1, scale = 112 / Math.max(w, h);
      const dw = Math.round(w * scale), dh = Math.round(h * scale);
      const x = (i % 6) * 128 + Math.floor((128 - dw) / 2), y = Math.floor(i / 6) * 128 + Math.floor((128 - dh) / 2);
      out.drawImage(image, left, top, w, h, x, y, dw, dh);
      bounds.push({ id: entries[i].id, frame: i, source: { left, top, width: w, height: h }, atlas: { x, y, width: dw, height: dh } });
    }
    return { png: atlas.toDataURL('image/png').split(',')[1], bounds };
  })()`);
  const png = Buffer.from(atlas.png, 'base64');
  await writeFile(new URL('units-atlas.png', root), png);
  await writeFile(new URL('atlas-layout.json', root), JSON.stringify({ cell: 128, columns: 6, frames: atlas.bounds }, null, 2));
  console.log(JSON.stringify({ units: atlas.bounds.length, dimensions: '768x512', bytes: png.length }));
} finally { chrome.close(); }
