import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = 'artifacts/skill-effects';
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
    const context = await evaluate("JSON.stringify({ scenes: window.smash?.scene.scenes.map(s => [s.sys.settings.key, s.sys.settings.status]), loader: window.smash?.scene.getScene('BootScene').load.progress, files: window.smash?.scene.getScene('BootScene').load.inflight.getArray().map(f => [f.key, f.state, f.url]), canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON() })");
    throw new Error(`Timed out: ${expression}; context=${context}; errors=${JSON.stringify(errors)}`);
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
  await evaluate("window.gs = smash.scene.getScene('GameScene'); gs.scene.pause(); undefined;");

  // Real Phaser, textures and physics bodies. Pause the scene for deterministic skill checks.
  const combat = await evaluate(`(async () => {
    const { UNIT_TYPES } = await import('/src/config/unitData.ts');
    const { UNIT_COMBAT_STYLES } = await import('/src/config/skillData.ts');
    const types = Object.keys(UNIT_TYPES);
    const now = gs.time.now;
    gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES';
    gs.squad.roster.units = ['LAVA_GOLEM','WORLD_DRUID','PHOENIX_LORD','EARTH_DEITY','SHADOW_ASSASSIN','BASIC_LASER']
      .map((archetype, i) => ({ id: 'skill_' + i, archetype, tier: UNIT_TYPES[archetype].tier, star: 1, deployed: true }));
    gs.squad.syncRoster();
    gs.squad.drones.forEach(d => { d.setPosition(360, 650); d.lastSkillAt = now - 10000; });
    const [lava, druid, phoenix, deity, assassin, ally] = gs.squad.drones;
    const enemy = gs.enemies.spawnEnemy('TANK', 400, 650);
    // This formation grants 5% vanguard defense; ensure an actual death before testing revival.
    ally.health.takeDamage(ally.health.maxHp * 2, now);
    if(!ally.health.isDead)throw Error('Revival fixture must begin with a fallen ally');
    gs.squad.update(now, 0, 0, 0, gs.enemies, 1, 1, 0, true);
    const skills = { burn: enemy.burn.damage === 6 && enemy.burn.sourceUnitId === lava.id,
      buff: assassin.attackBuffMultiplier === 1.15,
      revive: ally.active && ally.health.currentHp === Math.round(ally.health.maxHp / 2),
      shield: ally.health.shieldHp === 30 && gs.squad.health.shieldHp === 30 };
    const beforeKills = gs.stats.enemiesDefeated;
    gs.clearEncounter();
    const victim = gs.enemies.spawnEnemy('SWARMER', 360, 500);
    const bullet = gs.bullets.fireBullet({ sourceUnitId: assassin.id, unitTypeId: assassin.archetype,
      x: 360, y: 500, angle: 0, speed: 100, damage: 100, aoeRadius: 0, color: 0xffffff,
      slowFactor: 1, slowDurationMs: 0, chainCount: 0, pierceCount: 0 });
    const firedAt = assassin.weapon.lastFiredAt;
    gs.onBulletHitEnemy(bullet, victim);
    skills.assassin = assassin.weapon.lastFiredAt === firedAt - 120 && gs.stats.enemiesDefeated === beforeKills + 1;
    gs.clearEncounter();
    const textures = types.every(unit => gs.textures.exists('skill_projectile_' + unit)
      && gs.textures.exists('skill_glyph_' + UNIT_COMBAT_STYLES[unit].shape)
      && gs.textures.exists('skill_wave_' + UNIT_COMBAT_STYLES[unit].shape));
    return { skills, textures, types: types.length, clean: gs.particles.countActive(true) === 0 };
  })()`);
  assert.deepEqual(combat, { skills: { burn: true, buff: true, revive: true, shield: true, assassin: true },
    textures: true, types: 22, clean: true });

  const projectiles = await evaluate(`(() => {
    const now = gs.time.now;
    const fire = (unitTypeId, extra = {}) => gs.bullets.fireBullet({ unitTypeId, sourceUnitId: 'skill_0',
      x: 360, y: 500, angle: 0, speed: 900, damage: 25, color: 0xffffff,
      aoeRadius: 0, slowFactor: 1, slowDurationMs: 0, pierceCount: 0, chainCount: 0, ...extra });
    gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES';
    const poisoned = gs.enemies.spawnEnemy('TANK', 360, 500);
    const thorn = fire('THORN_GUARD', { damage: 42 });
    gs.onBulletHitEnemy(thorn, poisoned);
    const applied = poisoned.health.currentHp === 133 && poisoned.poison.damage === 3;
    poisoned.update(now + 999, 0);
    const delayed = poisoned.health.currentHp === 133;
    poisoned.update(now + 1000, 0);
    const tick = poisoned.health.currentHp === 130;
    poisoned.health.currentHp = 3;
    const kills = gs.stats.enemiesDefeated;
    poisoned.update(now + 2000, 0); poisoned.update(now + 3000, 0);
    const killedOnce = gs.stats.enemiesDefeated === kills + 1;
    poisoned.spawn('TANK', 360, 500);
    const cleanPoison = poisoned.poison.damage === 0;
    gs.clearEncounter();
    const primary = gs.enemies.spawnEnemy('TANK', 360, 500);
    const first = gs.enemies.spawnEnemy('TANK', 430, 460);
    const second = gs.enemies.spawnEnemy('TANK', 430, 540);
    const outside = gs.enemies.spawnEnemy('TANK', 550, 500);
    const parent = fire('STORM_ARCHER', { pierceCount: 2 });
    gs.onBulletHitEnemy(parent, primary);
    const children = gs.bullets.getChildren().filter(b => b.active && b.isFragment);
    const split = children.length === 2 && children.every(b => b.damage === 6 && !b.splitPending
      && b.remainingChains === 0 && b.remainingPierces === 0 && b.hitEnemyLives.has(primary.lifeId));
    const primaryHp = primary.health.currentHp;
    gs.onBulletHitEnemy(children[0], primary);
    const noOriginalHit = primary.health.currentHp === primaryHp && children[0].active;
    gs.onBulletHitEnemy(children[0], first); gs.onBulletHitEnemy(children[1], second);
    const childDamage = first.health.currentHp === 169 && second.health.currentHp === 169 && outside.health.currentHp === 175;
    gs.onBulletHitEnemy(parent, outside);
    const singleSplit = !parent.splitPending && gs.bullets.countActive(true) === 1;
    gs.clearEncounter();
    const solo = gs.enemies.spawnEnemy('TANK', 360, 500);
    gs.onBulletHitEnemy(fire('STORM_ARCHER'), solo);
    const noTargets = gs.bullets.countActive(true) === 0;
    gs.clearEncounter();
    const crowded = gs.enemies.spawnEnemy('TANK', 360, 500);
    gs.enemies.spawnEnemy('TANK', 430, 500);
    const fullParent = fire('STORM_ARCHER');
    while (gs.bullets.countActive(true) < 160) fire('BASIC_LASER');
    gs.onBulletHitEnemy(fullParent, crowded);
    const fullPool = !gs.bullets.getChildren().some(b => b.active && b.isFragment) && crowded.health.currentHp === 150;
    gs.clearEncounter();
    const target = gs.enemies.spawnEnemy('TANK', 360, 800);
    const homing = fire('SPARK_SPIRIT', { target });
    homing.update(now, 100);
    const tracking = Math.abs(homing.rotation - 0.3) < 1e-8 && Math.abs(homing.body.velocity.length() - 900) < 1e-8;
    target.deactivate(); target.spawn('TANK', 100, 500);
    homing.update(now, 100);
    const lifeSafe = Math.abs(homing.rotation - 0.3) < 1e-8;
    gs.clearEncounter();
    return { applied, delayed, tick, killedOnce, cleanPoison, split, noOriginalHit, childDamage,
      singleSplit, noTargets, fullPool, tracking, lifeSafe,
      cleared: gs.bullets.countActive(true) === 0 && gs.enemies.getChildren().every(e => e.poison.damage === 0) };
  })()`);
  for (const [key, value] of Object.entries(projectiles)) assert.equal(value, true, key);

  // Render the same gallery with the saved pre-edit implementation when it is available.
  // Baselines are optional local artifacts; fresh checkouts still validate the current renderer.
  await evaluate(`(async () => {
    window.currentEffects = (await import('/src/entities/EffectParticlePool.ts')).EffectParticleGroup;
    window.oldEffects = null;
    const path = '/artifacts/skill-effects/before/EffectParticlePool.ts';
    if ((await fetch(path)).headers.get('content-type')?.includes('javascript'))
      window.oldEffects = (await import(path)).EffectParticleGroup;
    window.drawGallery = async (before) => {
      gs.children.getChildren().forEach(child => child.setVisible(false));
      const Pool = before ? oldEffects : currentEffects;
      const pool = new Pool(gs);
      const bg = gs.add.graphics().setDepth(0);
      bg.fillStyle(0x101720).fillRect(0, 0, 720, 1280);
      const text = (x, y, value, size = 18, color = '#b6c0c8') => gs.add.text(x, y, value,
        { fontFamily: 'Malgun Gothic', fontSize: size, color }).setDepth(60);
      text(34, 32, before ? '개선 전 · 스킬 이펙트' : '개선 후 · 스킬 이펙트', 28, '#f5f1dd');
      text(34, 77, '동일 위치 · 동일 판정 반경 · 발동 후 80ms');
      const rows = [
        ['ROCKET_BOT', '화염 폭발', 85], ['STUN_BOT', '서리 파동', 85],
        ['BLACKHOLE_MISSILE', '황혼 파동', 85], ['EARTH_DEITY', '대지 충격', 85]
      ];
      for (let i = 0; i < rows.length; i++) {
        const [unit, label, radius] = rows[i];
        const x = i % 2 ? 530 : 190, y = 240 + Math.floor(i / 2) * 260;
        bg.lineStyle(1, 0x64717c, 0.4).strokeCircle(x, y, radius);
        text(x - 80, y + 110, label, 20, '#f5f1dd');
        if (before) pool.emitShockwave(x, y, radius, ({ ROCKET_BOT: 0xff8a2a, STUN_BOT: 0x67d8ff,
          BLACKHOLE_MISSILE: 0x8c54d8, EARTH_DEITY: 0xbda17b })[unit]);
        else pool.emitExplosion(unit, x, y, radius);
        pool.emitHit(unit, x, y);
      }
      const { unitTexture } = await import('/src/ui/pixelCharacters.ts');
      const events = [['heal','HERBAL_PRIEST','치유'],['shield','EARTH_DEITY','보호막'],
        ['summon','WORLD_DRUID','소환'],['revive','PHOENIX_LORD','부활']];
      for (let i = 0; i < events.length; i++) {
        const [kind, unit, label] = events[i], x = 105 + i * 170, y = 800;
        gs.add.sprite(x, y, unitTexture(unit), 0).setDepth(24);
        pool.emitSkill(kind, x, y, unit);
        text(x - 30, y + 70, label, 20, '#f5f1dd');
      }
      pool.emitLightning(100, 1030, 310, 1010, 0xffd65c, 0);
      pool.emitLightning(310, 1010, 525, 1060, 0xffd65c, 3);
      text(210, 1110, '대상 사이 연쇄 번개', 20, '#f5f1dd');
      for (const p of pool.getChildren()) p.update(gs.time.now, 80);
      return pool.getChildren().length;
    };
  })()`);
  if (await evaluate('!!oldEffects')) {
    await evaluate('drawGallery(true)'); await sleep(100); await capture('before');
  }
  await evaluate('drawGallery(false)'); await sleep(100); await capture('after');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(150); await capture('after-mobile360');
  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
  await evaluate(`(() => {
    gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES';
    gs.children.getChildren().forEach(child => child.setVisible(false));
    const bg = gs.add.graphics().setDepth(0);
    bg.fillStyle(0x101720).fillRect(0, 0, 720, 1280);
    const label = (x, y, value, size = 20, color = '#f5f1dd') => gs.add.text(x, y, value,
      { fontFamily: 'Malgun Gothic', fontSize: size, color }).setDepth(60);
    label(32, 32, '신규 스킬 · 독 / 분열 / 추적', 28);
    label(32, 100, '가시 수호자 · 맹독 가시');
    label(32, 136, '1초마다 8% · 3초 지속 · 중첩 없음', 18, '#b2f06a');
    const fire = (unitTypeId, x, y, extra = {}) => gs.bullets.fireBullet({ unitTypeId, x, y,
      angle: 0, speed: 900, damage: 25, color: 0xffffff, sourceUnitId: 'skill_0',
      aoeRadius: 0, slowFactor: 1, slowDurationMs: 0, pierceCount: 0, chainCount: 0, ...extra });
    const poisoned = gs.enemies.spawnEnemy('TANK', 360, 260);
    gs.onBulletHitEnemy(fire('THORN_GUARD', 360, 260, { damage: 42 }), poisoned);
    label(395, 245, '중독 3 × 3회', 18, '#b2f06a');
    label(32, 400, '폭풍 궁수 · 분열 화살');
    label(32, 436, '첫 적중에서 파편 2개 · 각 25% · 재분열 없음', 18, '#b78cff');
    const primary = gs.enemies.spawnEnemy('TANK', 320, 560);
    gs.enemies.spawnEnemy('TANK', 450, 510); gs.enemies.spawnEnemy('TANK', 450, 610);
    const parent = fire('STORM_ARCHER', 320, 560, { pierceCount: 2 });
    gs.onBulletHitEnemy(parent, primary); parent.setPosition(350, 560);
    for (const child of gs.bullets.getChildren()) {
      if (!child.active || !child.isFragment) continue;
      child.setPosition(child.x + child.body.velocity.x * 0.07, child.y + child.body.velocity.y * 0.07);
      bg.lineStyle(2, 0xb78cff, 0.5).lineBetween(320, 560, child.x, child.y);
    }
    label(32, 730, '번개 정령 · 추적 전격');
    label(32, 766, '초당 최대 3rad 회전 · 최초 표적만 추적', 18, '#ffd65c');
    const target = gs.enemies.spawnEnemy('TANK', 450, 1080);
    const homing = fire('SPARK_SPIRIT', 170, 900, { target });
    let x = homing.x, y = homing.y;
    for (let i = 0; i < 6; i++) {
      homing.update(gs.time.now, 50);
      homing.setPosition(homing.x + homing.body.velocity.x * 0.05, homing.y + homing.body.velocity.y * 0.05);
      bg.lineStyle(2, 0xffd65c, 0.75).lineBetween(x, y, homing.x, homing.y);
      x = homing.x; y = homing.y;
    }
    label(32, 1180, '실제 발사·적중·추적 코드를 실행한 고정 화면', 18, '#b6c0c8');
    gs.enemies.getChildren().forEach(e => e.clearTint());
    gs.unitOverlayGraphics.setVisible(true); gs.skillGroundGraphics.setVisible(true);
    const hiddenDrones = gs.squad.drones; gs.squad.drones = [];
    gs.drawUnitOverlays(); gs.squad.drones = hiddenDrones;
    for (const p of gs.particles.getChildren()) p.update(gs.time.now, 60);
    gs.squad.drones.forEach(d => d.setVisible(false));
  })()`);
  await sleep(100); await capture('new-projectile-skills');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const result = { status: 'passed', combat, projectiles, screenshots };
  await writeFile(join(output, 'browser-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  socket?.close();
  browser.kill();
}
