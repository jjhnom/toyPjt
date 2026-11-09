import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = 'artifacts/combat-status';
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
  await evaluate(`(async () => {
    window.gs = smash.scene.getScene('GameScene');
    gs.scene.pause();
    const { UNIT_TYPES } = await import('/src/config/unitData.ts');
    gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES'; gs.currentWave = gs.totalWavesInRoom = 1;
    gs.squad.roster.units = ['PHOENIX_LORD','EARTH_DEITY','BASIC_LASER','WORLD_DRUID','BASIC_LASER','HERBAL_PRIEST']
      .map((archetype, i) => ({ id: 'unit_' + (100 + i), archetype, tier: UNIT_TYPES[archetype].tier, star: 1, deployed: true }));
    gs.squad.syncRoster();
    const now = gs.time.now;
    gs.squad.drones[0].lastSkillAt = now - 4000; gs.squad.drones[1].lastSkillAt = now - 1000;
    const fallen = gs.squad.drones[2]; fallen.health.takeDamage(fallen.health.maxHp, now);
    const tank = gs.enemies.spawnEnemy('TANK', 500, 900, 10000);
    tank.movement.baseSpeed = 0; tank.spec.contactDamage = 0;
    gs.squad.health.invulnerableUntil = now + 1000000;
    gs.refreshHud();
    gs.scene.resume();
  })()`);
  assert.equal(await evaluate('gs.hudUnitStatuses[0].kind'), 'cooldown');
  assert.equal(await evaluate('gs.hudUnitStatuses[1].kind'), 'cooldown');
  assert.equal(await evaluate('gs.hudUnitStatuses[2].kind'), 'revive');
  await tap(630, 1130);
  assert.equal(await evaluate('gs.hudStatusDetail.visible && gs.selectedHudUnitId === gs.squad.drones[0].id'), true);
  assert.equal(await evaluate("gs.hudStatusRows[0].state.text.includes('불사조 재림')"), true);
  const clockBefore = await evaluate('gs.time.now'); await sleep(200);
  assert.ok(await evaluate('gs.time.now') > clockBefore, 'the detail panel must not pause combat');
  assert.equal(await evaluate('gs.joystick.dirX === 0 && gs.joystick.dirY === 0'), true);
  const touchBounds = await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const touch = (x, y) => ({ x: touchBounds.x + x * touchBounds.width / 720, y: touchBounds.y + y * touchBounds.height / 1280 });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(100, 400)] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(145, 425)] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await evaluate('gs.joystick.dirX === 0 && gs.joystick.dirY === 0'), true, 'detail touches must not steer the leader');
  await capture('cooldowns-720');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  // The summary panel shows all six units, including the fallen third unit.
  assert.equal(await evaluate("gs.hudStatusRows[2].state.text.includes('자동 부활')"), true);
  await capture('revive-detail-360');
  const layout = await evaluate(`(() => {
    const detail = gs.hudStatusDetail.getBounds();
    return { inside: detail.left >= 0 && detail.right <= 720 && detail.bottom <= 1080,
      labels: gs.hudUnitStatusTexts.every(t => !t.visible || t.getBounds().width <= 78),
      hp: gs.hudHpText.getBounds().top >= 36 && gs.hudHpText.getBounds().bottom <= 66,
      wave: gs.hudWaveText.getBounds().bottom <= 115 };
  })()`);
  assert.deepEqual(layout, { inside: true, labels: true, hp: true, wave: true });

  await evaluate("gs.openSquadModal('전투 상태 표시 검사'); undefined;");
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  const frozen = await evaluate('JSON.stringify({ time: gs.time.now, states: gs.hudUnitStatuses })');
  await sleep(350);
  assert.equal(await evaluate('JSON.stringify({ time: gs.time.now, states: gs.hudUnitStatuses })'), frozen);
  await tap(360, 1210);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  await evaluate("smash.events.emit('hidden'); undefined;");
  await waitFor("smash.scene.isPaused('GameScene')");
  const background = await evaluate('gs.time.now');
  await sleep(200);
  assert.equal(await evaluate('gs.time.now'), background);
  await evaluate("smash.events.emit('visible'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  // Advance a paused real Phaser scene to exact deadlines; presentation must follow real skill changes.
  const transitions = await evaluate(`(() => {
    gs.scene.pause();
    const [phoenix, deity, ally] = gs.squad.drones;
    const now = gs.time.now;
    gs.time.now = ally.reviveAt;
    gs.squad.update(gs.time.now, 0, 0, 0, gs.enemies, 1, 1, 0, false);
    gs.updateHudVitals();
    const naturalRevive = !ally.health.isDead && !gs.hudUnitStatusTexts[2].visible;
    ally.health.invulnerableUntil = 0;
    ally.health.takeDamage(ally.health.maxHp, gs.time.now);
    phoenix.lastSkillAt = gs.time.now - 10000;
    deity.lastSkillAt = gs.time.now - 8000;
    gs.squad.update(gs.time.now, 0, 0, 0, gs.enemies, 1, 1, 0, true);
    gs.updateHudVitals();
    const phoenixRevive = !ally.health.isDead && gs.hudUnitStatuses[0].seconds === 10
      && gs.hudUnitStatuses[0].kind === 'cooldown' && !gs.hudUnitStatusTexts[2].visible;
    const revivalDiagnostic = { now: gs.time.now, phoenixHp: phoenix.health.currentHp, allyHp: ally.health.currentHp,
      lastSkillAt: phoenix.lastSkillAt, status: {...gs.hudUnitStatuses[0]}, allyStatus: {...gs.hudUnitStatuses[2]} };
    deity.health.invulnerableUntil = 0; deity.health.takeDamage(12, gs.time.now);
    gs.selectedHudUnitId = deity.id; gs.nextStatusDetailAt = 0; gs.updateHudVitals();
    const shield = gs.hudUnitStatuses[1].shieldHp === 18 && gs.hudStatusRows[1].state.text.includes('보호막 18');
    gs.time.now += 4000; gs.nextStatusDetailAt = 0; gs.updateHudVitals();
    const expiredShield = !gs.hudStatusRows[1].state.text.includes('보호막') && gs.hudUnitStatuses[1].shieldHp === 0;
    gs.time.now = phoenix.lastSkillAt + 10000; gs.updateHudVitals();
    const ready = gs.hudUnitStatusTexts[0].text === '준비' && gs.hudUnitStatuses[0].progress === 1;
    return { naturalRevive, phoenixRevive, shield, expiredShield, ready, revivalDiagnostic };
  })()`);
  for (const key of ['naturalRevive', 'phoenixRevive', 'shield', 'expiredShield', 'ready'])
    assert.equal(transitions[key], true, `${key}: ${JSON.stringify(transitions.revivalDiagnostic)}`);
  await evaluate(`gs.selectedHudUnitId = gs.squad.drones[0].id; gs.nextStatusDetailAt = 0; gs.updateHudVitals(); undefined;`);
  await capture('phoenix-ready-360');
  const cleanup = await evaluate(`(() => {
    const [phoenix, deity] = gs.squad.drones;
    gs.selectedHudUnitId = phoenix.id;
    gs.squad.roster.units = gs.squad.roster.units.filter(u => u.id !== phoenix.id && u.id !== deity.id);
    gs.squad.syncRoster(); gs.updateHudVitals();
    const removed = !gs.hudStatusDetail.visible && !gs.hudUnitSkillIcons[0].visible
      && !gs.hudUnitStatusTexts[0].visible && !gs.hudUnitPortraits[4].visible;
    gs.enterRoom(gs.gridManager.getCurrentRoom(), null); gs.updateHudVitals();
    const roomReset = gs.selectedHudUnitId === null && !gs.hudStatusDetail.visible;
    return { removed, roomReset };
  })()`);
  assert.deepEqual(cleanup, { removed: true, roomReset: true });
  await evaluate("gs.scene.start('GameScene'); undefined;");
  await waitFor("smash.scene.isActive('GameScene') && gs.squad.drones.length === 2");
  assert.equal(await evaluate('gs.selectedHudUnitId === null && gs.hudUnitStatusTexts.every(t => !t.visible)'), true);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const result = { status: 'passed', layout, transitions, cleanup, screenshots,
    checks: ['six portrait status slots', 'mobile detail touch', 'combat continues', 'HUD bounds', 'management pause',
      'background pause', 'natural revival', 'phoenix revival and cooldown', 'shield absorption and expiry',
      'phoenix ready', 'removed roster slots', 'room transition', 'restart', 'no runtime exceptions'] };
  await writeFile(join(output, 'browser-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { socket?.close(); browser.kill(); }
