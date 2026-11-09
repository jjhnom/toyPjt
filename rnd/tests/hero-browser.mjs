import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession, sleep } from './helpers/browser-session.mjs';

const browser = await browserSession();
const { evaluate, waitFor, tap, send, attach } = browser;
const output = 'artifacts/hero';
const saved = () => evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const state = () => evaluate(`({ hero: gs.squad.heroSnapshot(), hp: gs.squad.health.currentHp,
  maxHp: gs.squad.health.maxHp, minerals: gs.squad.roster.minerals, defeated: gs.stats.enemiesDefeated })`);
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
  const initial = await saved();
  assert.equal(initial.hero.level, 1); assert.equal(initial.hero.xp, 0);
  const collision = await evaluate(`(() => {
    window.gs = smash.scene.getScene('GameScene'); gs.scene.pause(); gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES';
    gs.squad.setPositionImmediate(360,650); gs.squad.health.currentHp = 23;
    for (const d of gs.squad.drones) d.weapon.tryFire = () => null;
    window.unitOnKills = 0; const onKill = gs.squad.onKill.bind(gs.squad);
    gs.squad.onKill = (...args) => { unitOnKills++; onKill(...args); };
    const target = gs.enemies.spawnEnemy('SWARMER', 480,650); target.health.currentHp = 8;
    target.body.moves = false; const life = target.lifeId;
    gs.physics.world.resume(); gs.physics.world.fixedStep = false;
    for (let frame = 1; frame <= 24; frame++) {
      const delta = 1000/60, time = gs.time.now + frame * delta;
      gs.squad.update(time, delta, 0, 1, gs.enemies, 9, 9, 0, true);
      for (const b of gs.bullets.getChildren()) if (b.active) b.update(time,delta);
      gs.physics.world.update(time,delta); gs.physics.world.postUpdate();
    }
    const beforeDuplicate = gs.squad.roster.minerals;
    gs.handleEnemyKilled(target, 'hero', 'hero'); gs.physics.world.pause();
    window.firstEnemy = target; window.firstLife = life;
    return { hero: gs.squad.heroSnapshot(), dead: !target.active, unitOnKills,
      duplicateCurrency: gs.squad.roster.minerals - beforeDuplicate, moved: gs.squad.leader.y > 650,
      defeated: gs.stats.enemiesDefeated, hp: gs.squad.health.currentHp };
  })()`);
  assert.equal(collision.dead, true, 'actual projectile overlap must kill');
  assert.equal(collision.hero.kills.hero, 1); assert.equal(collision.hero.xp, 2);
  assert.equal(collision.unitOnKills, 0, 'hero cannot trigger a summoned-unit kill skill');
  assert.equal(collision.duplicateCurrency, 0); assert.equal(collision.defeated, 1);
  assert.equal(collision.moved, true); assert.equal(collision.hp, 23);

  const routes = await evaluate(`(() => {
    const owner = gs.squad.drones[0].id;
    const spawn = (x=400,y=500) => { const e = gs.enemies.spawnEnemy('SWARMER',x,y); e.health.currentHp=1; return e; };
    const recycled = spawn(), sameObject = recycled === firstEnemy, newLife = recycled.lifeId !== firstLife;
    const config = { x:400,y:500,angle:0,speed:640,damage:10,color:0xffffff,aoeRadius:0,
      slowFactor:1,slowDurationMs:0,pierceCount:0,chainCount:0,sourceUnitId:owner,sourceKind:'unit',unitTypeId:'BASIC_LASER' };
    gs.onBulletHitEnemy(gs.bullets.fireBullet(config), recycled);
    // Splash and chain kills retain their parent source after the primary victim dies.
    const a=spawn(400,500), b=spawn(430,500);
    gs.onBulletHitEnemy(gs.bullets.fireBullet({...config,aoeRadius:60}),a);
    const c=spawn(400,500), d=spawn(450,500);
    gs.onBulletHitEnemy(gs.bullets.fireBullet({...config,chainCount:1}),c);
    const burn=spawn(); burn.onBurnTick(burn,10,owner);
    const poison=spawn(); poison.onPoisonTick(poison,10,owner);
    const environment=spawn(); if(environment.receiveDamage(10,gs.time.now)) gs.handleEnemyKilled(environment);
    return { sameObject,newLife,hero:gs.squad.heroSnapshot(),defeated:gs.stats.enemiesDefeated,unitOnKills };
  })()`);
  assert.equal(routes.sameObject, true); assert.equal(routes.newLife, true);
  assert.deepEqual(routes.hero.kills, { hero: 1, unit: 7, environment: 1 });
  assert.equal(routes.hero.xp, 18); assert.equal(routes.defeated, 9); assert.equal(routes.unitOnKills, 7);
  const level = await evaluate(`(() => {
    gs.squad.hero.xp = 39;
    const target=gs.enemies.spawnEnemy('SWARMER',400,500);
    if(target.receiveDamage(10000,gs.time.now)) gs.handleEnemyKilled(target,gs.squad.drones[0].id);
    gs.refreshHud(); gs.updateHudVitals();
    return { hero:gs.squad.heroSnapshot(),hp:gs.squad.health.currentHp,maxHp:gs.squad.health.maxHp,
      name:gs.children.getByName('hero-name').text,xpText:gs.children.getByName('hero-xp').text };
  })()`);
  assert.equal(level.hero.level, 2); assert.equal(level.hero.xp, 1);
  assert.equal(level.hp, 23); assert.equal(level.maxHp, 105);
  assert.match(level.name, /견습 소환사 · Lv.2/); assert.equal(level.xpText, 'XP 1/47');

  await mkdir(output, { recursive: true });
  for (const width of [720,360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:width*1280/720, deviceScaleFactor:1, mobile:true });
    await sleep(200);
    const bounds = await evaluate(`['hero-name','hero-xp'].map(name => {
      const t=gs.children.getByName(name),r=t.getBounds(); return {name,x:r.x,y:r.y,right:r.right,bottom:r.bottom}; })`);
    assert.ok(bounds.every(b => b.x>=12 && b.right<=370 && b.y>=10 && b.bottom<=114));
    assert.ok(bounds[0].bottom < 36, 'hero name must stay above the HP bar');
    const image = await send('Page.captureScreenshot', { format:'png' });
    await writeFile(`${output}/hud-${width}.png`, Buffer.from(image.data,'base64'));
  }

  // Remaining attack time is frozen under both management and hidden reasons.
  await evaluate("gs.finishRoom(gs.gridManager.getCurrentRoom()); undefined;");
  await waitFor("smash.scene.isActive('SquadScene')");
  const beforePause = await state(); await sleep(200);
  await evaluate("smash.events.emit('hidden'); undefined;"); await sleep(200);
  await tap(360, 1210); await waitFor("!smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("smash.scene.isPaused('GameScene')"), true);
  assert.deepEqual(await state(), beforePause);
  const checkpoint = await saved();
  assert.deepEqual(checkpoint.hero,beforePause.hero);
  assert.equal(checkpoint.leaderHealth.currentHp,23); assert.equal(checkpoint.leaderHealth.maxHp,105);
  // Reload while hidden: continuing must preserve HP, resources, XP and cooldown without rewards.
  await send('Page.reload', { ignoreCache:true }); await attach();
  await tap(360, 910); await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene'); undefined;");
  const restored = await state();
  assert.equal(restored.hero.level,checkpoint.hero.level); assert.equal(restored.hero.xp,checkpoint.hero.xp);
  assert.deepEqual(restored.hero.kills,checkpoint.hero.kills);
  assert.equal(restored.hero.attackRemainingMs,checkpoint.hero.attackRemainingMs);
  assert.equal(restored.hp,23); assert.equal(restored.maxHp,105);
  assert.equal(restored.minerals,checkpoint.roster.minerals); assert.equal(restored.defeated,checkpoint.stats.enemiesDefeated);
  assert.deepEqual(await saved(),checkpoint,'loading must not rewrite the checkpoint');
  await tap(360, 1210); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate('gs.scene.pause(); undefined;');

  for (const version of [1,2]) {
    const legacy=structuredClone(initial); legacy.version=version; delete legacy.hero;
    legacy.leaderHealth={currentHp:23,maxHp:120}; legacy.stats.enemiesDefeated=90;
    if(version===1) { delete legacy.phase; delete legacy.runId; delete legacy.currentRoomId;
      legacy.unitHealth=legacy.unitHealth.map(({id,currentHp})=>({id,currentHp})); }
    const raw=JSON.stringify(legacy);
    await evaluate(`gs.returnToTitle(); localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(raw)}); undefined;`);
    await waitFor("smash.scene.isActive('MenuScene')");
    await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
    await evaluate("window.gs=smash.scene.getScene('GameScene'); gs.scene.pause(); undefined;");
    const restoredLegacy=await state();
    assert.equal(restoredLegacy.hero.level,1); assert.equal(restoredLegacy.hero.xp,0);
    assert.deepEqual(restoredLegacy.hero.kills,{hero:0,unit:0,environment:0});
    assert.equal(restoredLegacy.hp,23); assert.equal(restoredLegacy.maxHp,120);
    assert.equal(restoredLegacy.minerals,legacy.roster.minerals); assert.equal(restoredLegacy.defeated,90);
    assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"),raw);
  }
  // Summaries show legacy unclassified kills as 'other'; restart resets hero progression and all source counters.
  await evaluate(`gs.squad.health.takeDamage(10000,gs.time.now); gs.scene.resume(); undefined;`);
  await waitFor("smash.scene.isActive('GameOverScene')");
  const summary=await evaluate(`(() => {const s=smash.scene.getScene('GameOverScene');
    return [s.children.getByName('hero-summary').text,s.children.getByName('hero-kills').text];})()`);
  assert.match(summary[0],/Lv.1/); assert.equal(summary[1],'영웅 처치 0 · 분대 0 · 기타 90');
  await tap(360,945); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene'); gs.scene.pause(); undefined;");
  const restarted=await state();
  assert.equal(restarted.hp,100); assert.equal(restarted.maxHp,100); assert.equal(restarted.defeated,0);
  assert.equal(restarted.hero.level,1); assert.equal(restarted.hero.xp,0);
  assert.deepEqual(restarted.hero.kills,{hero:0,unit:0,environment:0});
  assert.deepEqual(browser.errors,[]);
  const report={ browser:await send('Browser.getVersion'),scenario:'controlled Phaser collision, source routes and persistence; no human balance measurement',
    collision,routes,level,checkpoint:checkpoint.hero,restored,restarted,summary,widths:[720,360],errors:browser.errors };
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,collisionKills:collision.hero.kills,routeKills:routes.hero.kills,level:level.hero.level,
    saveRestore:true,legacyVersions:[1,2],pause:true,restart:true,widths:[720,360],report:`${output}/report.json`}));
} finally { browser.close(); }
