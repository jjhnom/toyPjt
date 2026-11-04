import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = await mkdtemp(join(tmpdir(), 'smash-browser-'));
const browserPath = process.env.SMASH_BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(browserPath, [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
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
    pending.set(++id, { resolve, reject });
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
    const path = join(profile, `${label}.png`);
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
  assert.equal(await evaluate("document.querySelectorAll('canvas').length"), 1);
  await waitFor("smash.scene.isActive('MenuScene')");
  await sleep(500); // Allow Phaser's first input/scale frame after scene creation.
  await capture('title');
  await tap(360, 910);
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs = smash.scene.getScene('GameScene'); undefined;");
  assert.equal(await evaluate('gs.squad.roster.units.length'), 2);
  await sleep(800);
  await capture('battle');
  await evaluate('gs.squad.health.maxHp = 100000; gs.squad.health.heal(100000)');

  // Finish the first room through the actual wave-completion branch.
  await evaluate(`gs.enemies.getChildren().forEach(enemy => enemy.deactivate());
    gs.roomState = 'LOCKED_WAVES'; gs.currentWave = gs.totalWavesInRoom = 1;`);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  assert.equal(await evaluate('gs.squad.roster.minerals'), 55);
  await capture('summoning');
  const frozen = await evaluate('gs.time.now');
  await sleep(250);
  assert.equal(await evaluate('gs.time.now'), frozen, 'combat clock must pause during management');

  await tap(570, 381); // Basic unit, 15 M.
  assert.equal(await evaluate('gs.squad.roster.units.length'), 3);
  assert.equal(await evaluate('gs.squad.roster.minerals'), 40);
  await tap(570, 526); // Gatling unit, 40 M.
  assert.equal(await evaluate('gs.squad.roster.minerals'), 0);
  await tap(360, 228); // Recipes.
  await capture('recipes');
  await tap(550, 488); // Two basics -> gatling.
  assert.equal(await evaluate("gs.squad.roster.units.filter(u => u.archetype === 'GATLING_BOT').length"), 2);
  await tap(550, 898); // Basic + gatling -> cryo.
  assert.equal(await evaluate("gs.squad.roster.units.filter(u => u.archetype === 'STUN_BOT').length"), 1);
  const afterCombine = await evaluate('JSON.stringify(gs.squad.roster.units)');
  await tap(550, 898); // Missing ingredients must not consume anything.
  assert.equal(await evaluate('JSON.stringify(gs.squad.roster.units)'), afterCombine);

  await tap(575, 228); // Deployment.
  await tap(570, 369);
  assert.equal(await evaluate('gs.squad.roster.units.filter(u => u.deployed).length'), 1);
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate('gs.squad.drones.length'), 1);
  assert.equal(await evaluate('gs.squad.drones[0].id === gs.squad.roster.units.find(u => u.deployed).id'), true);

  // Reopen with the on-screen management button; input must survive scene restart.
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  const mobileBounds = await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  assert.ok(mobileBounds.width <= 360 && mobileBounds.height <= 640 && mobileBounds.x >= 0);
  await tap(540, 1178);
  await waitFor("smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').input.enabled"), true);
  await capture('mobile360');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = join(profile, 'squad-management.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene')");

  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
  await sleep(600);

  // Hiding and returning to the app must not resume combat underneath the modal.
  await evaluate("gs.openSquadModal();");
  await waitFor("smash.scene.isActive('SquadScene')");
  await evaluate("smash.events.emit('hidden'); smash.events.emit('visible'); undefined;");
  assert.equal(await evaluate("smash.scene.isPaused('GameScene')"), true);
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene')");

  // Units approach enemies independently rather than orbiting the commander.
  const movement = await evaluate(`(() => {
    const drone = gs.squad.drones[0];
    gs.enemies.getChildren().forEach(enemy => enemy.deactivate());
    gs.enemies.spawnEnemy('TANK', 600, 300);
    drone.setPosition(100, 950);
    const x = drone.x, y = drone.y;
    drone.updateDrone(gs.time.now, 100, 100, 950, gs.enemies, 1, 1);
    return { moved: Math.hypot(drone.x - x, drone.y - y), y: drone.y };
  })()`);
  assert.ok(movement.moved > 0 && movement.moved < 30);
  assert.ok(movement.y < 950);

  const piercing = await evaluate(`(() => {
    gs.enemies.getChildren().forEach(enemy => enemy.deactivate());
    gs.bullets.getChildren().forEach(bullet => bullet.deactivate());
    const first = gs.enemies.spawnEnemy('TANK', 300, 300);
    const second = gs.enemies.spawnEnemy('TANK', 350, 300);
    const hp = first.health.currentHp;
    const bullet = gs.bullets.fireBullet({ x: 300, y: 300, angle: 0, speed: 0, damage: 1,
      color: 0xffffff, aoeRadius: 0, slowFactor: 1, slowDurationMs: 0, pierceCount: 5, chainCount: 0 });
    gs.onBulletHitEnemy(bullet, first);
    gs.onBulletHitEnemy(bullet, second);
    gs.onBulletHitEnemy(bullet, first);
    const once = first.health.currentHp === hp - 1 && second.health.currentHp === hp - 1;
    const oldLife = first.lifeId;
    first.deactivate();
    first.spawn('TANK', 300, 300);
    gs.onBulletHitEnemy(bullet, first);
    return { once, recycled: first.lifeId !== oldLife && first.health.currentHp === hp - 1 };
  })()`);
  assert.deepEqual(piercing, { once: true, recycled: true });
  const chain = await evaluate(`(() => {
    gs.enemies.getChildren().forEach(enemy => enemy.deactivate());
    const first = gs.enemies.spawnEnemy('TANK', 300, 300);
    const second = gs.enemies.spawnEnemy('TANK', 330, 300);
    const third = gs.enemies.spawnEnemy('TANK', 360, 300);
    const hp = first.health.currentHp;
    gs.triggerChainLightning(first, 5, 1, 1, 0, gs.time.now);
    return first.health.currentHp === hp && second.health.currentHp === hp - 1 && third.health.currentHp === hp - 1;
  })()`);
  assert.equal(chain, true, 'one chain must not bounce back to an already hit target');

  // Restart after death must reset currency, ownership, and scene listeners.
  await evaluate('gs.handlePlayerDeath()');
  await waitFor("smash.scene.isActive('GameOverScene')");
  await evaluate("smash.scene.getScene('GameOverScene').scene.start('GameScene'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  assert.deepEqual(await evaluate("({ count: smash.scene.getScene('GameScene').squad.roster.units.length, minerals: smash.scene.getScene('GameScene').squad.roster.minerals })"), { count: 2, minerals: 30 });
  await evaluate(`window.gs = smash.scene.getScene('GameScene');
    gs.enemies.getChildren().forEach(enemy => enemy.deactivate());
    gs.gridManager.getCurrentRoom().type = 'BOSS';
    gs.gridManager.getCurrentRoom().cleared = false;
    gs.roomState = 'LOCKED_WAVES'; gs.currentWave = gs.totalWavesInRoom = 1;`);
  await waitFor("smash.scene.isActive('GameOverScene')");
  assert.deepEqual(await evaluate('({ rooms: gs.stats.roomsCleared, boss: gs.stats.bossDefeated })'), { rooms: 1, boss: true });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify({ status: 'passed', viewport: '720x1280 touch', screenshotPath, screenshots,
    checks: ['room reward', 'combat pause', 'summon', 'same/mixed recipes', 'failed recipe rollback', 'deployment sync', 'modal reopen', 'visibility pause', 'independent movement', 'piercing and recycled targets', 'chain hit uniqueness', 'run restart', 'boss victory counted once', 'no runtime exceptions'] }, null, 2));
} finally {
  socket?.close();
  browser.kill();
}
