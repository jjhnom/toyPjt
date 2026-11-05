import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = 'artifacts/summoning-circle';
await mkdir(output, { recursive: true });
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
    window.startCheckpoint = JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'));
    window.enterCircle = () => {
      gs.clearEncounter();
      const room = gs.gridManager.grid.flat().find(r => r?.type === 'EVENT');
      room.cleared = false; delete room.circleChoice;
      gs.gridManager.currentX = room.gridX; gs.gridManager.currentY = room.gridY;
      gs.enterRoom(room, null);
    };
    gs.squad.roster.minerals = 5000;
    while (gs.squad.roster.units.length < 16) gs.squad.roster.summon('BASIC_LASER');
    gs.squad.roster.freeSummons = 0;
    window.initialClears = gs.stats.roomsCleared;
    enterCircle();`);
  await waitFor("smash.scene.isActive('SummoningCircleScene') && smash.scene.isPaused('GameScene')");
  const frozen = await evaluate('gs.time.now');
  await sleep(250); assert.equal(await evaluate('gs.time.now'), frozen);
  assert.equal(await evaluate('gs.joystick.dirX === 0 && gs.joystick.dirY === 0'), true);
  await capture('choice-720');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(300); await capture('choice-360');
  await evaluate("window.staleChoice = smash.scene.getScene('SummoningCircleScene').sys.settings.data.onChoose; undefined;");
  const minerals = await evaluate('gs.squad.roster.minerals');
  await tap(360, 566);
  await waitFor("smash.scene.isActive('SquadScene') && !smash.scene.isActive('SummoningCircleScene')");
  await evaluate("staleChoice('CHALLENGE'); staleChoice('SAFE'); undefined;");
  assert.deepEqual(await evaluate(`({ vouchers: gs.squad.roster.freeSummons, units: gs.squad.roster.units.length,
    minerals: gs.squad.roster.minerals, clears: gs.stats.roomsCleared - initialClears,
    choice: gs.gridManager.getCurrentRoom().circleChoice, cleared: gs.gridManager.getCurrentRoom().cleared })`),
  { vouchers: 1, units: 16, minerals, clears: 1, choice: 'SAFE', cleared: true });
  await capture('safe-reward');
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  await evaluate('gs.startRoomLogic(gs.gridManager.getCurrentRoom()); undefined;');
  await sleep(100);
  assert.equal(await evaluate("smash.scene.isActive('SummoningCircleScene')"), false);
  assert.equal(await evaluate('gs.squad.roster.freeSummons'), 1);

  await evaluate('enterCircle();');
  await waitFor("smash.scene.isActive('SummoningCircleScene')");
  const skippedBefore = await evaluate('({ minerals: gs.squad.roster.minerals, vouchers: gs.squad.roster.freeSummons })');
  await tap(360, 1010);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SummoningCircleScene')");
  assert.deepEqual(await evaluate('({ minerals: gs.squad.roster.minerals, vouchers: gs.squad.roster.freeSummons })'), skippedBefore);
  assert.equal(await evaluate("gs.roomState === 'CLEARED' && gs.input.enabled && gs.gridManager.getCurrentRoom().circleChoice === 'SKIP'"), true);

  await evaluate('enterCircle();');
  await waitFor("smash.scene.isActive('SummoningCircleScene')");
  await evaluate("smash.events.emit('hidden'); undefined;");
  await tap(360, 859);
  await waitFor("!smash.scene.isActive('SummoningCircleScene')");
  assert.equal(await evaluate("smash.scene.isPaused('GameScene') && gs.roomState === 'LOCKED_WAVES'"), true);
  await evaluate("smash.events.emit('visible'); gs.scene.pause(); undefined;");
  const challenge = await evaluate(`(() => {
    const room = gs.gridManager.getCurrentRoom();
    const before = { minerals: gs.squad.roster.minerals, vouchers: gs.squad.roster.freeSummons,
      clears: gs.stats.roomsCleared };
    gs.spawnNextWave(room);
    const queued = gs.pendingSpawns.map(s => s.archetype);
    gs.processSpawns(1000);
    const firstSpawn = gs.enemies.getChildren().find(e => e.active);
    firstSpawn.setActive(false);
    gs.update(gs.time.now, 16);
    const waitsForSpawns = !room.cleared && gs.pendingSpawns.length > 0 && gs.currentWave === 1;
    firstSpawn.setActive(true);
    while (gs.pendingSpawns.length) gs.processSpawns(1000);
    for (const enemy of gs.enemies.getChildren()) {
      if (!enemy.active) continue;
      enemy.receiveDamage(1000000, gs.time.now); gs.handleEnemyKilled(enemy);
    }
    const afterKills = gs.squad.roster.minerals;
    gs.update(gs.time.now, 16);
    gs.finishRoom(room); gs.finishRoom(room);
    return { queued, waitsForSpawns, voucherGain: gs.squad.roster.freeSummons - before.vouchers,
      clearGain: gs.stats.roomsCleared - before.clears, completionReward: gs.squad.roster.minerals - afterKills,
      choice: room.circleChoice, cleared: room.cleared,
      clean: gs.bullets.countActive(true) === 0 && gs.hazards.slots.every(slot => !slot.active) };
  })()`);
  assert.deepEqual(challenge, { queued: ['ELITE_BRUTE', 'SWARMER', 'SWARMER'], waitsForSpawns: true,
    voucherGain: 1, clearGain: 1, completionReward: 25, choice: 'CHALLENGE', cleared: true, clean: true });
  await waitFor("smash.scene.isActive('SquadScene')");
  await capture('challenge-reward');
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  // A real old-version checkpoint must retain the same roster, resources and health on Continue.
  await evaluate(`startCheckpoint.grid.flat().find(r => r?.type === 'EVENT').type = 'SHOP';
    localStorage.setItem('smash.run-checkpoint.v1', JSON.stringify(startCheckpoint)); gs.returnToTitle();`);
  await waitFor("smash.scene.isActive('MenuScene')");
  await tap(360, 998);
  await waitFor("smash.scene.isActive('GameScene')");
  assert.deepEqual(await evaluate(`(() => {
    window.gs = smash.scene.getScene('GameScene');
    return { events: gs.gridManager.grid.flat().filter(r => r?.type === 'EVENT').length,
      shops: gs.gridManager.grid.flat().filter(r => r?.type === 'SHOP').length,
      minerals: gs.squad.roster.minerals, vouchers: gs.squad.roster.freeSummons, hp: gs.squad.health.currentHp };
  })()`), { events: 1, shops: 0, minerals: 30, vouchers: 0, hp: 100 });
  await evaluate('enterCircle();');
  await waitFor("smash.scene.isActive('SummoningCircleScene')");
  await evaluate("staleChoice('SAFE'); undefined;");
  assert.equal(await evaluate('gs.squad.roster.freeSummons'), 0, 'callbacks from an old run must be ignored');
  await tap(360, 859);
  await waitFor("smash.scene.isActive('GameScene')");
  assert.equal(await evaluate("gs.roomState === 'LOCKED_WAVES' && !gs.gridManager.getCurrentRoom().cleared"), true);
  await evaluate('gs.handlePlayerDeath();');
  await waitFor("smash.scene.isActive('GameOverScene')");
  assert.equal(await evaluate("smash.scene.isActive('SummoningCircleScene') || smash.scene.isActive('SquadScene')"), false);
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), null);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const result = { status: 'passed', screenshots, challenge,
    checks: ['mobile choices', 'paused clock', 'safe reward at full roster', 'duplicate callbacks', 'revisit',
      'skip', 'background pause during choice', 'one guardian wave', 'wait for pending spawns',
      'single victory reward', 'legacy Continue', 'old run callback', 'challenge death'] };
  await writeFile(join(output, 'browser-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { socket?.close(); browser.kill(); }
