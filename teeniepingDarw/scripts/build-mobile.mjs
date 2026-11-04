import { readFile, writeFile, mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'www');
// Only this fixed generated directory is replaced; original img/ files are never modified.
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'www') throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const seasons = [];
const sorted = entries => entries.sort((a,b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
for (const folder of sorted(await readdir(path.join(root, 'img'), { withFileTypes: true }))) {
  if (!folder.isDirectory()) continue;
  const images = [];
  const destination = path.join(output, 'img', folder.name);
  await mkdir(destination, { recursive: true });
  for (const file of sorted(await readdir(path.join(root, 'img', folder.name), { withFileTypes: true }))) {
    if (!file.isFile() || !/\.(png|jpe?g|webp)$/i.test(file.name)) continue;
    await copyFile(path.join(root, 'img', folder.name, file.name), path.join(destination, file.name));
    images.push({ name: path.parse(file.name).name, url: `./img/${encodeURIComponent(folder.name)}/${encodeURIComponent(file.name)}` });
  }
  seasons.push({ name: folder.name, images });
}
await writeFile(path.join(output, 'templates.js'), `globalThis.__BUNDLED_TEMPLATES__ = ${JSON.stringify(seasons)};\n`);
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<details class="install-guide"[\s\S]*?<\/details>/, '')
  .replace(/<link[^>]+(?:manifest|apple-touch-icon|rel="icon")[^>]*>/g, '')
  .replace('<script src="app.js"></script><script src="pwa.js"></script>', '<script src="templates.js"></script><script src="capacitor-runtime.js"></script><script src="native.js"></script><script src="app.js"></script>');
await writeFile(path.join(output, 'index.html'), html);
const css = (await readFile(path.join(root, 'style.css'), 'utf8')).replace(/@import url\([^;]+;/g, '');
await writeFile(path.join(output, 'style.css'), css);
await copyFile(path.join(root, 'app.js'), path.join(output, 'app.js'));
// Initialize the JS runtime on top of Capacitor's injected native bridge.
await copyFile(path.join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(output, 'capacitor-runtime.js'));
await copyFile(path.join(root, 'native.js'), path.join(output, 'native.js'));
console.log(`Bundled ${seasons.length} seasons and ${seasons.reduce((sum, season) => sum + season.images.length, 0)} images into www/. No external server required.`);
