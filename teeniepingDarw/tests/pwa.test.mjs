import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('manifest icons exist with declared PNG dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const png = await readFile(new URL(`..${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('service worker serves cached images offline and fails clearly for uncached ones', async () => {
  const listeners = {}, saved = new Map();
  let online = true;
  const sandbox = {
    URL, Response,
    self: { location: { origin: 'https://color.example' }, addEventListener: (name, handler) => listeners[name] = handler },
    caches: { open: async () => ({ put: async (request, response) => saved.set(request.url, response), match: async request => saved.get(request.url)?.clone(), keys: async () => [] }) },
    fetch: async () => { if (!online) throw new Error('Offline'); return new Response('image bytes'); }
  };
  vm.runInNewContext(await readFile(new URL('../sw.js', import.meta.url), 'utf8'), sandbox);
  const request = async pathname => {
    let result;
    listeners.fetch({ request: { method: 'GET', url: `https://color.example${pathname}` }, respondWith: promise => result = promise });
    return result;
  };
  assert.equal(await (await request('/img/season1/image.png')).text(), 'image bytes');
  online = false;
  assert.equal(await (await request('/img/season1/image.png')).text(), 'image bytes');
  assert.equal((await request('/img/season1/missing.png')).status, 503);
  assert.equal(await request('/unrelated'), undefined);
});
