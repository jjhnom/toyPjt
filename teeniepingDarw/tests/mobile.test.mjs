import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('mobile build contains all listed images and uses only local resources', async () => {
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../scripts/build-mobile.mjs', import.meta.url))]);
  const base = new URL('../www/', import.meta.url);
  const html = await readFile(new URL('index.html', base), 'utf8');
  assert.ok(!html.includes('pwa.js'));
  assert.ok(!html.includes('install-guide'));
  assert.ok(html.indexOf('capacitor-runtime.js') < html.indexOf('native.js'));
  const css = await readFile(new URL('style.css', base), 'utf8');
  assert.ok(!css.includes('fonts.googleapis.com'));
  const context = {};
  vm.runInNewContext(await readFile(new URL('templates.js', base), 'utf8'), context);
  assert.ok(context.__BUNDLED_TEMPLATES__.length > 0);
  for (const season of context.__BUNDLED_TEMPLATES__) for (const image of season.images) {
    assert.ok((await readFile(new URL(image.url, base))).length > 0);
  }
});

test('native save writes a PNG to app cache and opens platform share menu', async () => {
  const calls = [];
  const plugins = {
    Filesystem: { writeFile: async options => calls.push(options), getUri: async () => ({ uri: 'file:///cache/coloring-day.png' }) },
    Share: { share: async options => calls.push(options) }
  };
  const window = { Capacitor: { isNativePlatform: () => true, registerPlugin: name => plugins[name] } };
  vm.runInNewContext(await readFile(new URL('../native.js', import.meta.url), 'utf8'), { window });
  await window.saveNativeDrawing({ toDataURL: () => 'data:image/png;base64,abc' });
  assert.equal(calls[0].directory, 'CACHE');
  assert.equal(calls[0].data, 'abc');
  assert.equal(calls[1].files[0], 'file:///cache/coloring-day.png');
});
