import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');

for (const withUpload of [false, true]) {
 for (const bundled of [false, true]) {
  test(`startup loads templates ${withUpload ? 'with' : 'without'} upload controls, ${bundled ? 'offline app' : 'web'}`, async () => {
    const context = new Proxy({}, { get: (target, key) => {
      if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(800 * 900 * 4).fill(255) });
      return target[key] ?? (() => {});
    } });
    const element = () => ({
      value: '', children: [], dataset: {}, style: {},
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {}, addEventListener() {}, getContext: () => context,
      append(...items) { this.children.push(...items); if (!this.value && items[0]?.value) this.value = items[0].value; },
      replaceChildren() { this.children = []; this.value = ''; }
    });
    const elements = new Map();
    const document = {
      querySelector(selector) {
        if (!withUpload && ['#upload', '#drop'].includes(selector)) return null;
        if (!elements.has(selector)) elements.set(selector, element());
        return elements.get(selector);
      },
      querySelectorAll: () => [], createElement: element, addEventListener() {}
    };
    let requests = 0;
    const sandbox = {
      document, Path2D: class {},
      fetch: async () => { requests++; return { ok: true, json: async () => ({ seasons: [{ name: '시즌1', images: [{ name: '하츄핑', url: '/img/season1/test.png' }] }] }) }; }
    };
    if (bundled) {
      sandbox.__BUNDLED_TEMPLATES__ = [{ name: '시즌1', images: [{ name: '하츄핑', url: './img/season1/test.png' }] }];
      sandbox.fetch = () => { throw new Error('Native app must not request a server'); };
    }
    vm.runInNewContext(source, sandbox);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, bundled ? 0 : 1);
    assert.equal(elements.get('#season').disabled, false);
    assert.equal(elements.get('#templates').children.length, 1);
    assert.equal(elements.get('#refresh-library').disabled, false);
    assert.equal(typeof elements.get('#save').onclick, 'function');
    if (withUpload) assert.equal(typeof elements.get('#upload').onchange, 'function');
  });
 }
}
