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
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000);
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
  assert.equal(await evaluate("smash.scene.getScene('MenuScene').children.getByName('title-art').texture.key"), 'art_title');
  await capture('title');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  await capture('title-mobile360');
  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  await tap(360, 998); // No save: the Continue button is disabled.
  assert.equal(await evaluate("smash.scene.isActive('MenuScene')"), true);
  await tap(360, 910);
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs = smash.scene.getScene('GameScene'); undefined;");
  assert.equal(await evaluate("gs.children.getByName('dungeon-art').texture.key"), 'art_dungeon');
  assert.equal(await evaluate('gs.squad.roster.units.length'), 2);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1')).stats.stageIndex"), 0);
  await sleep(800);
  await capture('battle');
  const hudLayout = await evaluate(`(() => {
    const hp = gs.hudHpText.getBounds(), room = gs.hudRoomText.getBounds(), wave = gs.hudWaveText.getBounds();
    const currency = gs.hudMineralText.getBounds(), squad = gs.hudSquadText.getBounds();
    return { hpFits: hp.left >= 111 && hp.right <= 351 && hp.top >= 26 && hp.bottom <= 56,
      roomFits: room.left >= 112 && room.right <= 546 && room.bottom <= wave.top,
      waveFits: wave.right <= 546 && wave.bottom <= 115,
      currencyFits: currency.left >= 410 && currency.right <= 532 && currency.bottom <= 70,
      partyFits: squad.right <= 246, portraits: gs.hudUnitPortraits.length,
      fpsHidden: !gs.hudFpsText.visible };
  })()`);
  assert.deepEqual(hudLayout, { hpFits: true, roomFits: true, waveFits: true, currencyFits: true, partyFits: true, portraits: 6, fpsHidden: true });
  await evaluate('gs.squad.health.maxHp = 100000; gs.squad.health.heal(100000)');

  // Finish the first room through the actual wave-completion branch.
  await evaluate(`gs.enemies.getChildren().forEach(enemy => enemy.deactivate());
    gs.pendingSpawns.length = 0; gs.hazards.clear();
    gs.squad.roster.minerals = 30;
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
  await tap(570, 359);
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
  await capture('battle-mobile360');
  const point = (x, y, id) => ({ x: mobileBounds.x + x * mobileBounds.width / 720, y: mobileBounds.y + y * mobileBounds.height / 1280, id });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(160, 1160, 11)] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(215, 1160, 11)] });
  await sleep(100);
  assert.ok(await evaluate('gs.joystick.dirX > 0.5'), 'joystick must still respond to dragging');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(215, 1160, 11), point(540, 1178, 12)] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor("smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate('gs.joystick.dirX === 0 && gs.joystick.dirY === 0'), true, 'opening the book with a second touch clears movement');
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').input.enabled"), true);
  await capture('mobile360');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = join(profile, 'squad-management.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene')");

  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  const fullBounds = await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const fullPoint = (x, y) => ({ x: fullBounds.x + x * fullBounds.width / 720, y: fullBounds.y + y * fullBounds.height / 1280, id: 21 });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [fullPoint(160, 1160)] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [fullPoint(220, 1160)] });
  await send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await sleep(100);
  assert.equal(await evaluate('gs.joystick.dirX === 0 && gs.joystick.dirY === 0'), true, 'touch cancellation clears movement');

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

  // New type sprites, aggro, healing, individual defeat, and room revival.
  const unitRoles = await evaluate(`(() => {
    gs.clearEncounter();
    gs.squad.roster.minerals = 1000;
    gs.squad.roster.summon('STONE_GUARD'); gs.squad.roster.summon('HERBAL_PRIEST');
    gs.squad.syncRoster();
    const tank = gs.squad.drones.find(d => d.archetype === 'STONE_GUARD');
    const healer = gs.squad.drones.find(d => d.archetype === 'HERBAL_PRIEST');
    tank.setPosition(320, 400); gs.squad.leader.setPosition(320, 450);
    const target = gs.squad.findEnemyTarget(320, 450);
    gs.squad.health.currentHp = gs.squad.health.maxHp - 20;
    healer.lastHealAt = gs.time.now - 3001;
    const hp = gs.squad.health.currentHp;
    gs.squad.update(gs.time.now, 16, 0, 0, gs.enemies, 1, 1, 0);
    const healed = gs.squad.health.currentHp > hp;
    tank.health.takeDamage(tank.health.maxHp, gs.time.now);
    const defeated = tank.health.isDead && !tank.visible && !tank.active;
    gs.squad.reviveFallen();
    return { tankTarget: target.id === tank.id, healed, defeated,
      revived: tank.active && tank.visible && tank.health.ratio === 0.5 };
  })()`);
  assert.deepEqual(unitRoles, { tankTarget: true, healed: true, defeated: true, revived: true });

  // Material selection is reviewable and can be changed before a touch confirmation.
  await evaluate('gs.openSquadModal()');
  await waitFor("smash.scene.isActive('SquadScene')");
  await tap(570, 381); await tap(570, 381);
  const beforeManual = await evaluate('gs.squad.roster.units.length');
  await tap(360, 228); await tap(170, 488);
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').editingRecipe.id"), 'gatling');
  await tap(570, 374);
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').selectedIds.length"), 1);
  await tap(570, 374);
  await capture('manual-ingredients');
  await tap(530, 1040);
  assert.equal(await evaluate('gs.squad.roster.units.length'), beforeManual - 1);
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').editingRecipe"), null);
  await tap(145, 228);
  await tap(570, 1030); // More T1 offers, including new class sprites.
  await capture('new-unit-offers');
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene')");

  const promotion = await evaluate(`(() => {
    gs.squad.roster.summon('BASIC_LASER'); gs.squad.roster.summon('BASIC_LASER'); gs.squad.roster.summon('BASIC_LASER');
    const combined = gs.squad.roster.combine('promote_BASIC_LASER_1'); gs.squad.syncRoster();
    const unit = gs.squad.drones.find(d => d.archetype === 'BASIC_LASER' && d.star === 2);
    unit.health.takeDamage(unit.health.maxHp, gs.time.now);
    unit.reviveAt = gs.time.now - 1;
    gs.squad.update(gs.time.now, 16, 0, 0, gs.enemies, 1, 1, 0);
    return { combined, maxHp: unit.health.maxHp, resurrected: unit.active && unit.health.currentHp === Math.round(unit.health.maxHp * 0.5) };
  })()`);
  assert.deepEqual(promotion, { combined: true, maxHp: 105, resurrected: true });

  const poolAndWarning = await evaluate(`(() => {
    gs.clearEncounter();
    for (let i = 0; i < 80; i++) gs.enemies.spawnEnemy('SWARMER', 100 + i, 300);
    gs.queueEnemy('BOSS_CORE', 360, 300); gs.processSpawns(1000);
    const queued = gs.pendingSpawns.length === 1;
    gs.enemies.getChildren().forEach(e => e.deactivate()); gs.processSpawns(1000);
    const retried = gs.pendingSpawns.length === 0 && gs.enemies.countActive(true) === 1;
    gs.clearEncounter();
    const enemy = gs.enemies.spawnEnemy('TANK', 300, 300, 3, 2, 1.2);
    const scaled = enemy.health.maxHp === 525 && enemy.spec.contactDamage === 40 && enemy.spec.speed === 110.39999999999999;
    enemy.deactivate(); enemy.spawn('TANK', 300, 300);
    const reset = enemy.health.maxHp === 175 && enemy.spec.contactDamage === 20 && enemy.spec.speed === 92;
    gs.clearEncounter();
    gs.squad.health.invulnerableUntil = 0;
    const hp = gs.squad.health.currentHp;
    gs.hazards.add('METEOR', gs.squad.leader.x, gs.squad.leader.y, 7, 0);
    gs.hazards.update(799);
    const warned = gs.squad.health.currentHp === hp;
    gs.hazards.update(1);
    const hitAfterWarning = gs.squad.health.currentHp === hp - 7;
    gs.clearEncounter();
    return { queued, retried, scaled, reset, warned, hitAfterWarning };
  })()`);
  assert.deepEqual(poolAndWarning, { queued: true, retried: true, scaled: true, reset: true, warned: true, hitAfterWarning: true });

  const performance = await evaluate(`(async () => {
    gs.clearEncounter(); gs.roomState = 'TRANSITION';
    gs.squad.health.invulnerableUntil = gs.time.now + 60000;
    for (const unit of gs.squad.drones) { unit.health.maxHp = unit.health.currentHp = 100000; }
    for (let i = 0; i < 28; i++) gs.enemies.spawnEnemy('TANK', 100 + (i % 7) * 80, 250 + Math.floor(i / 7) * 180, 1000, 1, 1.24);
    const fps = []; let peakBullets = 0;
    for (let sample = 0; sample < 20; sample++) {
      const count = gs.bullets.countActive(true);
      for (let i = count; i < 150; i++) gs.bullets.fireBullet({ x: 100 + (i % 7) * 80, y: 220 + (i % 9) * 85,
        angle: i * 2.4, speed: 420, damage: 1, color: 0xffffff, aoeRadius: 0,
        slowFactor: 1, slowDurationMs: 0, pierceCount: 1, chainCount: 0 });
      peakBullets = Math.max(peakBullets, gs.bullets.countActive(true));
      await new Promise(resolve => setTimeout(resolve, 500));
      fps.push(gs.game.loop.actualFps);
    }
    return { browser: navigator.userAgent, durationSeconds: 10, enemies: gs.enemies.countActive(true), peakBullets,
      averageFps: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length * 10) / 10,
      minFps: Math.round(Math.min(...fps) * 10) / 10 };
  })()`);
  assert.equal(performance.enemies, 28);
  assert.equal(performance.peakBullets, 150);
  await capture('combat-stress');

  // Restart after death must reset currency, ownership, and scene listeners.
  await evaluate('gs.handlePlayerDeath()');
  await waitFor("smash.scene.isActive('GameOverScene')");
  await evaluate("smash.scene.getScene('GameOverScene').scene.start('GameScene'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  assert.deepEqual(await evaluate("({ count: smash.scene.getScene('GameScene').squad.roster.units.length, minerals: smash.scene.getScene('GameScene').squad.roster.minerals })"), { count: 2, minerals: 30 });
  await evaluate(`window.gs = smash.scene.getScene('GameScene'); gs.squad.roster.combine('gatling'); gs.squad.syncRoster();
    window.survivorId = gs.squad.roster.units[0].id; gs.stats.damageMultiplier = 1.7;`);
  for (let stage = 0; stage < 5; stage++) {
    const result = await evaluate(`(() => {
      gs.clearEncounter();
      gs.squad.health.currentHp = 30;
      const room = gs.gridManager.getCurrentRoom(); room.type = 'BOSS'; room.cleared = false;
      gs.startRoomLogic(room); gs.spawnNextWave(room); gs.processSpawns(1000);
      const boss = gs.enemies.getChildren().find(e => e.active && e.spec.archetype === 'BOSS_CORE');
      boss.receiveDamage(boss.health.maxHp, gs.time.now); gs.handleEnemyKilled(boss);
      const minerals = gs.squad.roster.minerals;
      gs.handleEnemyKilled(boss); gs.finishRoom(room);
      return { stage: gs.stats.stageIndex, bosses: gs.stats.bossesDefeated,
        clean: gs.enemies.countActive(true) === 0 && gs.bullets.countActive(true) === 0 && gs.pendingSpawns.length === 0,
        once: gs.squad.roster.minerals === minerals };
    })()`);
    assert.deepEqual(result, { stage, bosses: stage + 1, clean: true, once: true });
    if (stage < 4) {
      await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
      assert.equal(await evaluate("smash.scene.isActive('GameOverScene')"), false);
      await capture(`stage${stage + 1}-clear`);
      if (stage === 1) await evaluate("smash.events.emit('hidden'); smash.events.emit('visible'); undefined;");
      assert.equal(await evaluate("smash.scene.isPaused('GameScene')"), true);
      await tap(360, 1150);
      await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
      assert.deepEqual(await evaluate(`({ stage: gs.stats.stageIndex, hp: gs.squad.health.currentHp,
        multiplier: gs.stats.damageMultiplier, units: gs.squad.roster.units.map(u => u.id),
        fresh: gs.gridManager.grid.flat().filter(Boolean).every(r => !r.cleared),
        width: gs.gridManager.grid[0].length, height: gs.gridManager.grid.length })`),
      { stage: stage + 1, hp: 70, multiplier: 1.7, units: [await evaluate('survivorId')], fresh: true,
        width: [3, 4, 4, 5][stage], height: [4, 4, 5, 5][stage] });
      if (stage === 3) await capture('stage5-battle');
    } else {
      await waitFor("smash.scene.isActive('GameOverScene')");
      assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), null, 'victory clears the checkpoint');
    }
  }
  assert.deepEqual(await evaluate('({ rooms: gs.stats.roomsCleared, boss: gs.stats.bossDefeated, bosses: gs.stats.bossesDefeated })'), { rooms: 5, boss: true, bosses: 5 });
  // A death during a later stage also resets the stage gate and all run state.
  await evaluate("smash.scene.getScene('GameOverScene').scene.start('GameScene'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`(async () => {
    window.gs = smash.scene.getScene('GameScene'); gs.progression.index = gs.stats.stageIndex = 2; gs.squad.roster.stageIndex = 2;
    const { RoomGridManager } = await import('/src/systems/RoomGridManager.ts');
    gs.gridManager = new RoomGridManager(gs.progression.current);
    gs.handlePlayerDeath();
  })()`);
  await waitFor("smash.scene.isActive('GameOverScene')");
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), null, 'defeat clears the checkpoint');
  await evaluate("smash.scene.getScene('GameOverScene').scene.start('GameScene'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  assert.deepEqual(await evaluate(`(() => { const scene = smash.scene.getScene('GameScene');
    return { stage: scene.progression.index, bosses: scene.stats.bossesDefeated, units: scene.squad.roster.units.length,
      minerals: scene.squad.roster.minerals, vouchers: scene.squad.roster.freeSummons }; })()`),
    { stage: 0, bosses: 0, units: 2, minerals: 30, vouchers: 0 });

  // Capture a real stage-2 boundary after boss reward and management transactions.
  await evaluate(`(() => {
    window.gs = smash.scene.getScene('GameScene'); gs.clearEncounter();
    const room = gs.gridManager.getCurrentRoom(); room.type = 'BOSS'; room.cleared = false;
    gs.startRoomLogic(room); gs.spawnNextWave(room); gs.processSpawns(1000);
    const boss = gs.enemies.getChildren().find(e => e.active && e.spec.archetype === 'BOSS_CORE');
    boss.receiveDamage(boss.health.maxHp, gs.time.now); gs.handleEnemyKilled(boss);
  })()`);
  await waitFor("smash.scene.isActive('SquadScene')");
  await evaluate(`(() => {
    const roster = gs.squad.roster; roster.minerals = 400;
    roster.combine('gatling');
    for (let i = 0; i < 3; i++) roster.summon('SPARK_SPIRIT');
    roster.combine('promote_SPARK_SPIRIT_1');
    roster.summon('HERBAL_PRIEST'); roster.toggleDeployment(roster.units.at(-1).id);
    roster.summon('SHADOW_DAGGER'); roster.sell(roster.units.at(-1).id);
    roster.freeSummons = 2; gs.squad.syncRoster();
    gs.squad.drones[0].health.currentHp = 45;
    gs.squad.health.currentHp = 30;
    gs.stats.damageMultiplier = 1.6; gs.stats.attackSpeedMultiplier = 1.2; gs.stats.moveSpeedBonus = 10;
  })()`);
  await tap(360, 1150);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  const savedText = await evaluate("localStorage.getItem('smash.run-checkpoint.v1')");
  const savedCheckpoint = JSON.parse(savedText);
  assert.equal(savedCheckpoint.stats.stageIndex, 1);
  assert.equal(savedCheckpoint.stats.bossesDefeated, 1);
  assert.equal(savedCheckpoint.leaderHealth.currentHp, 70);
  assert.equal(savedCheckpoint.roster.units.some(unit => unit.id === 'unit_1' || unit.id === 'unit_2'), false);
  assert.equal(savedCheckpoint.roster.units.some(unit => unit.star === 2), true);
  await tap(510, 1120); // Stop through the new in-game title button.
  await waitFor("smash.scene.isActive('MenuScene')");
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), savedText);
  await tap(360, 910);
  assert.equal(await evaluate("!!smash.scene.getScene('MenuScene').children.getByName('new-run-confirmation')"), true);
  await tap(210, 700); // Cancel overwriting the saved run.
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), savedText);
  await capture('continue-menu');

  // A full browser reload proves that restoration is not using in-memory scene data.
  await send('Page.reload');
  await sleep(600);
  await waitFor("document.querySelector('canvas') !== null");
  await evaluate(`(async () => {
    const entry = document.querySelector('script[type="module"][src*="/src/main.ts"]');
    window.smash = (await import(entry.src)).game;
  })()`);
  await waitFor("smash.scene.isActive('MenuScene')");
  await sleep(300);
  for (let attempt = 0; attempt < 3; attempt++) {
    await tap(360, 998);
    await waitFor("smash.scene.isActive('GameScene')");
    const restored = await evaluate(`(() => {
      window.gs = smash.scene.getScene('GameScene'); gs.scene.pause();
      return { stats: gs.stats, roster: gs.squad.roster.snapshot(),
        leaderHealth: { currentHp: gs.squad.health.currentHp, maxHp: gs.squad.health.maxHp },
        unitHealth: gs.squad.drones.map(d => ({ id: d.id, currentHp: d.health.currentHp })), grid: gs.gridManager.grid,
        clean: gs.enemies.countActive(true) === 0 && gs.bullets.countActive(true) === 0 && gs.pendingSpawns.length === 0,
        bosses: gs.progression.bossesDefeated, state: gs.progression.state };
    })()`);
    assert.deepEqual(restored, { stats: savedCheckpoint.stats, roster: savedCheckpoint.roster,
      leaderHealth: savedCheckpoint.leaderHealth, unitHealth: savedCheckpoint.unitHealth, grid: savedCheckpoint.grid,
      clean: true, bosses: 1, state: 'PLAYING' });
    assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), savedText, 'Continue never rewrites the boundary');
    if (attempt === 0) await capture('restored-stage');
    if (attempt < 2) {
      await evaluate('gs.returnToTitle()');
      await waitFor("smash.scene.isActive('MenuScene')");
    }
  }
  const newId = await evaluate(`(() => { gs.squad.roster.summon('STONE_GUARD'); return gs.squad.roster.units.at(-1).id; })()`);
  assert.equal(newId, `unit_${savedCheckpoint.roster.nextId + 1}`);
  await evaluate('gs.returnToTitle()');
  await waitFor("smash.scene.isActive('MenuScene')");
  await tap(360, 910); await tap(510, 700); // Explicitly replace the old checkpoint.
  await waitFor("smash.scene.isActive('GameScene')");
  assert.deepEqual(await evaluate(`(() => { window.gs = smash.scene.getScene('GameScene');
    return { stage: gs.stats.stageIndex, count: gs.squad.roster.units.length, minerals: gs.squad.roster.minerals }; })()`),
    { stage: 0, count: 2, minerals: 30 });
  await evaluate(`gs.returnToTitle(); localStorage.setItem('smash.run-checkpoint.v1', '{broken');`);
  await waitFor("smash.scene.isActive('MenuScene')");
  await capture('invalid-save-menu');
  await tap(360, 998);
  assert.equal(await evaluate("smash.scene.isActive('MenuScene')"), true);
  await tap(360, 910);
  await waitFor("smash.scene.isActive('GameScene')");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1')).version"), 1);
  // A valid saved ID must hydrate its saved type/star rather than reuse default starter sprites.
  await evaluate(`(() => {
    window.gs = smash.scene.getScene('GameScene');
    const data = JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'));
    data.roster.units[0].archetype = 'STONE_GUARD'; data.roster.units[0].star = 2;
    data.unitHealth[0].currentHp = 120;
    localStorage.setItem('smash.run-checkpoint.v1', JSON.stringify(data));
    gs.returnToTitle();
  })()`);
  await waitFor("smash.scene.isActive('MenuScene')");
  await tap(360, 998);
  await waitFor("smash.scene.isActive('GameScene')");
  assert.deepEqual(await evaluate(`(() => {
    window.gs = smash.scene.getScene('GameScene');
    const d = gs.squad.drones[0];
    return { type: d.archetype, star: d.star, maxHp: d.health.maxHp, hp: d.health.currentHp };
  })()`), { type: 'STONE_GUARD', star: 2, maxHp: 270, hp: 120 });
  await evaluate('gs.returnToTitle()');
  await waitFor("smash.scene.isActive('MenuScene')");
  await evaluate("localStorage.removeItem('smash.run-checkpoint.v1')");
  await tap(360, 998); // The save disappeared after the menu was rendered.
  await waitFor("smash.scene.isActive('MenuScene') && !smash.scene.isActive('GameScene')");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify({ status: 'passed', viewport: '720x1280 touch', screenshotPath, screenshots, performance,
    checks: ['room reward', 'combat pause', 'summon', 'same/mixed recipes', 'failed recipe rollback', 'deployment sync', 'modal reopen', 'visibility pause', 'independent movement', 'piercing and recycled targets', 'chain hit uniqueness', 'unit health and revival', 'vanguard aggro', 'support healing', 'required spawn retry', 'spawn stat reset', '800ms hazard warning', 'run restart', 'five stage transitions', 'state preservation', 'boss rewards counted once', 'final boss victory only', 'stage checkpoint autosave', 'continue after browser reload', 'three resumes without bonus rewards or healing', 'sold and consumed IDs preserved', 'save overwrite confirmation and cancel', 'invalid save recovery', 'victory and defeat clear save', 'no runtime exceptions'] }, null, 2));
} finally {
  socket?.close();
  browser.kill();
}
