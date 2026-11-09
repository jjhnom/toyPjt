import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = 'artifacts/quick-craft';
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'smash-browser-'));
const browserPath = process.env.SMASH_BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(browserPath, [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
  ...(process.env.SMASH_BROWSER_NO_SANDBOX==='1'?['--no-sandbox','--disable-gpu']:[]),
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await sleep(100); }
  }
  assert.ok(port, 'Chrome debugging port must become available');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 45000);
    pending.set(++id, { resolve: result => { clearTimeout(timer); resolve(result); },
      reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    const context = await evaluate("JSON.stringify({ scenes: window.smash?.scene.scenes.map(s => [s.sys.settings.key, s.sys.settings.status]), canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON() })");
    throw new Error(`Timed out: ${expression}; context=${context}; errors=${JSON.stringify(errors)}`);
  };
  const tap = async (x, y) => {
    const bounds = await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + x * bounds.width / 720, y: bounds.y + y * bounds.height / 1280 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
  };
  const screenshots = {};
  const capture = async label => {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    const path = join(output, `${label}.png`);
    await writeFile(path, Buffer.from(result.data, 'base64'));
    screenshots[label] = path;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await send('Page.navigate', { url: process.env.SMASH_TEST_URL ?? 'http://127.0.0.1:5173/' });
  await waitFor("document.querySelector('canvas') !== null");
  // Vite may append an HMR timestamp to the entry URL. Reuse that exact module;
  // importing a second URL would create a second Phaser game/canvas.
  await evaluate(`(async () => {
    const entry = document.querySelector('script[type="module"][src*="/src/main.ts"]');
    window.smash = (await import(entry.src)).game;
  })()`);
  await waitFor("smash.scene.isActive('MenuScene')");
  await evaluate("smash.scene.getScene('MenuScene').scene.start('GameScene'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`window.gs = smash.scene.getScene('GameScene');
    gs.clearEncounter(); gs.roomState = 'CLEARED'; gs.gridManager.getCurrentRoom().cleared = true;
    gs.squad.roster.minerals = 250; gs.squad.roster.freeSummons = 2;
    window.ownedBefore = JSON.stringify(gs.squad.roster.units);
    gs.openSquadModal();`);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await evaluate("window.ss = smash.scene.getScene('SquadScene'); undefined;");
  const click = async name => {
    const point = await evaluate(`(() => { const scene = smash.scene.isActive('SquadScene') ? ss : gs;
      const control = scene.children.getByName(${JSON.stringify(name)});
      if (!control) throw Error('Missing control: ' + ${JSON.stringify(name)});
      return {x: control.x, y: control.y}; })()`);
    await tap(point.x, point.y);
  };
  await click('quick-craft-open');
  assert.equal(await evaluate('ss.quickMode'), true);
  await click('quick-tier-4');
  assert.equal(await evaluate('ss.quickTier'), 4);
  assert.equal(await evaluate("ss.children.getChildren().filter(c => c.name.startsWith('quick-craft-') && !['quick-craft-open'].includes(c.name)).length"), 4);
  await capture('list-720');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(300); await capture('list-360');
  await click('quick-craft-PHOENIX_LORD');
  assert.deepEqual(await evaluate('({ id: ss.quickQuote.unitTypeId, cost: ss.quickQuote.totalCost })'),
    { id: 'PHOENIX_LORD', cost: 250 });
  await capture('quote-360');
  await evaluate("window.oldConfirm = ss.children.getByName('quick-craft-confirm').list.find(c => c.input?.enabled); undefined;");
  await tap(520, 930);
  await evaluate("oldConfirm.emit('pointerdown', {}, 0, 0, { stopPropagation() {} }); undefined;");
  assert.deepEqual(await evaluate(`({ minerals: gs.squad.roster.minerals, count: gs.squad.roster.units.length,
    vouchers: gs.squad.roster.freeSummons, result: gs.squad.roster.units.at(-1).archetype,
    preserved: JSON.stringify(gs.squad.roster.units.slice(0, 2)) === ownedBefore })`),
    { minerals: 0, count: 3, vouchers: 2, result: 'PHOENIX_LORD', preserved: true });
  assert.equal(await evaluate("ss.message.includes('불사조 군주 ★1 제작 완료')"), true);
  await capture('crafted-360');
  // Insufficient funds must disable the commit action and leave all state untouched.
  await click('quick-craft-PHOENIX_LORD');
  const afterCraft = await evaluate('JSON.stringify(gs.squad.roster.snapshot())');
  assert.equal(await evaluate("!!ss.children.getByName('quick-craft-confirm').list.find(c => c.input?.enabled)"), false);
  await tap(520, 930);
  assert.equal(await evaluate('JSON.stringify(gs.squad.roster.snapshot())'), afterCraft);
  await capture('insufficient-360');
  await tap(190, 930);
  await evaluate(`gs.squad.roster.minerals = 5000;
    while (gs.squad.roster.units.length < 16) gs.squad.roster.summon('BASIC_LASER');
    gs.squad.roster.freeSummons = 2; ss.render();`);
  await click('quick-craft-EARTH_DEITY');
  assert.equal(await evaluate('ss.quickQuote.unitTypeId'), 'EARTH_DEITY');
  const full = await evaluate('JSON.stringify(gs.squad.roster.snapshot())');
  assert.equal(await evaluate("!!ss.children.getByName('quick-craft-confirm').list.find(c => c.input?.enabled)"), false);
  await tap(520, 930);
  assert.equal(await evaluate('JSON.stringify(gs.squad.roster.snapshot())'), full);
  await capture('full-roster-360');
  await tap(360, 1210);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("gs.squad.drones.some(d => d.archetype === 'PHOENIX_LORD')"), true);
  assert.equal(await evaluate('gs.squad.drones.length'), 6);
  await click('squad-open');
  await waitFor("smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').quickQuote"), null);
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').quickMode"), false);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const result = { status: 'passed', screenshots,
    checks: ['quick entry', 'tier filter', 'T4 list', 'mobile quote', '250 mineral phoenix',
      'owned units and vouchers preserved', 'duplicate input', 'insufficient funds', 'full roster',
      'deployment sync', 'clean reopen', 'no runtime exceptions'] };
  await writeFile(join(output, 'browser-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { socket?.close(); browser.kill(); }
