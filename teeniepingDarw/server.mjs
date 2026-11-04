import http from 'node:http';
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
const imageRoot = fileURLToPath(new URL('./img/', import.meta.url));
const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const sortByName = (a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true });
async function catalog() {
  let entries;
  try { entries = await readdir(imageRoot, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return Promise.all(entries.filter(entry => entry.isDirectory()).sort(sortByName).map(async season => ({
    name: season.name,
    images: (await readdir(path.join(imageRoot, season.name), { withFileTypes: true }))
      .filter(entry => entry.isFile() && imageTypes[path.extname(entry.name).toLowerCase()]).sort(sortByName)
      .map(entry => ({ name: path.parse(entry.name).name, url: `/img/${encodeURIComponent(season.name)}/${encodeURIComponent(entry.name)}` }))
  })));
}
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
Object.assign(files, {
  '/pwa.js': ['pwa.js', 'text/javascript; charset=utf-8'],
  '/sw.js': ['sw.js', 'text/javascript; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ...Object.fromEntries(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(name => [`/icons/${name}`, [`icons/${name}`, 'image/png']]))
});
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/templates') {
    try { const seasons = await catalog(); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ seasons })); }
    catch { res.writeHead(500); res.end('Unable to load templates'); }
    return;
  }
  if (pathname.startsWith('/img/')) {
    try {
      const parts = pathname.slice(5).split('/').map(decodeURIComponent);
      if (parts.length !== 2 || parts.some(part => !part || part === '.' || part === '..' || /[\\/\0:]/.test(part))) throw new Error('Invalid path');
      const type = imageTypes[path.extname(parts[1]).toLowerCase()];
      if (!type) throw new Error('Unsupported type');
      const root = await realpath(imageRoot), target = await realpath(path.join(root, ...parts));
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid path');
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
    return;
  }
  const file = files[pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const data = await readFile(new URL(file[0], import.meta.url)); res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' }); res.end(data); }
  catch { res.writeHead(500); res.end('Unable to load file'); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => {
  const port = server.address().port;
  console.log(`Coloring studio: http://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) for (const address of addresses || []) {
    if (address.family === 'IPv4' && !address.internal) console.log(`Phone (same Wi-Fi): http://${address.address}:${port}`);
  }
});
