import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession, sleep } from './helpers/browser-session.mjs';
import { load } from '../scripts/lib/load-typescript.mjs';

const browser=await browserSession();
const {evaluate,waitFor,tap,send,attach}=browser;
const ids=['squadAttack','squadSpeed','squadHealth','heroAttack','heroHealth','defense'];
const zero=Object.fromEntries(ids.map(id=>[id,0]));
const output='artifacts/upgrades';
const save=()=>evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const state=()=>evaluate(`({ upgrades:{...gs.squad.roster.upgrades},minerals:gs.squad.roster.minerals,
  hp:gs.squad.health.currentHp,maxHp:gs.squad.health.maxHp,hero:gs.squad.heroSnapshot(),
  units:gs.squad.drones.map(d=>({id:d.id,hp:d.health.currentHp,maxHp:d.health.maxHp,
    remaining:gs.revivalPause.remainingMs(d,gs.time.now),active:d.active,defense:d.health.damageReduction})) })`);
const click=async name=>{
  const point=await evaluate(`(() => {const b=smash.scene.getScene('SquadScene').children.getByName(${JSON.stringify(name)});return {x:b.x,y:b.y};})()`);
  await tap(point.x,point.y);
};
const close=async()=>{await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");};
try {
  await tap(360,910);await waitFor("smash.scene.isActive('GameScene')");
  const initial=await save();
  await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.clearEncounter();gs.roomState='LOCKED_WAVES';
    gs.squad.health.currentHp=23;gs.squad.drones[0].health.currentHp=1;
    gs.squad.drones[1].health.takeDamage(100000,gs.time.now);gs.squad.drones[1].reviveAt=gs.time.now+9000;
    gs.finishRoom(gs.gridManager.getCurrentRoom());undefined;`);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await click('upgrade-open');
  const insufficient=await state();await click('upgrade-buy-defense');assert.deepEqual(await state(),insufficient);
  await evaluate(`gs.squad.roster.grantReward(2000,0,'room','controlled-fixture');
    window.ss=smash.scene.getScene('SquadScene');ss.render();undefined;`);
  const funded=await state();
  await evaluate("window.oldBuy=ss.children.getByName('upgrade-buy-squadAttack').list.find(c=>c.input?.enabled);undefined;");
  for(const id of ids) {
    await click(`upgrade-buy-${id}`);
    const checkpoint=await save();assert.equal(checkpoint.roster.upgrades[id],1,`successful ${id} must save immediately`);
  }
  const first=await state();
  await evaluate("oldBuy.emit('pointerdown',{},0,0,{stopPropagation(){}});undefined;");assert.deepEqual(await state(),first);
  assert.deepEqual(first.upgrades,Object.fromEntries(ids.map(id=>[id,1])));
  assert.equal(first.minerals,funded.minerals-290);assert.equal(first.hp,23);assert.equal(first.maxHp,110);
  assert.deepEqual(first.units.map(d=>[d.hp,d.maxHp,d.active]),[[1,77,true],[0,77,false]]);
  assert.equal(first.units[1].remaining,9000);
  assert.ok(first.units.every(d=>d.defense===0.05));
  const ledger=await evaluate('gs.squad.roster.economy.report()');assert.equal(ledger.stages[0].byReason.upgrade,-290);
  await mkdir(output,{recursive:true});
  for(const width of [720,360]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width*1280/720,deviceScaleFactor:1,mobile:true});await sleep(200);
    const layout=await evaluate(`ss.children.getChildren().filter(c=>c.name.startsWith('upgrade-')&&c.name!=='upgrade-open').map(c=>{
      const r=c.getBounds();return {name:c.name,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})`);
    assert.equal(layout.filter(c=>c.name.startsWith('upgrade-buy-')).length,6);
    assert.ok(layout.every(r=>r.x>=24 && r.right<=696 && r.y>=150 && r.bottom<=930),JSON.stringify(layout));
    assert.equal(await evaluate("ss.children.getByName('upgrade-open').getBounds().bottom<=1150"),true);
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(`${output}/menu-${width}.png`,Buffer.from(screenshot.data,'base64'));
  }
  // Touch-cancel on a passive card cannot steer the paused leader or charge a purchase.
  const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const point=(x,y)=>({x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(120,350),point(450,550)]});
  await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.deepEqual(await state(),first);assert.equal(await evaluate('gs.joystick.dirX===0 && gs.joystick.dirY===0'),true);

  await evaluate("gs.squad.roster.grantReward(10000,0,'room','cap-fixture');ss.render();undefined;");
  for(let level=1;level<10;level++) await click('upgrade-buy-heroAttack');
  const capped=await state();assert.equal(capped.upgrades.heroAttack,10);
  assert.equal(await evaluate("ss.children.getByName('upgrade-buy-heroAttack').getByName('label').text"),'상한 도달');
  await click('upgrade-buy-heroAttack');assert.deepEqual(await state(),capped);
  assert.equal(capped.hp,23);assert.equal(capped.units[1].remaining,9000);
  await close();await evaluate('gs.scene.pause();undefined;');
  const combat=await evaluate(`(() => {
    gs.clearEncounter();gs.roomState='LOCKED_WAVES';gs.squad.setPositionImmediate(360,650);
    const enemy=gs.enemies.spawnEnemy('TANK',420,650);enemy.health.reset(10000);
    gs.squad.update(gs.time.now+1000,0,0,0,gs.enemies,2,8,0,true);
    const bullets=gs.bullets.getChildren().filter(b=>b.active);
    const hero=bullets.find(b=>b.sourceKind==='hero'),unit=bullets.find(b=>b.sourceKind==='unit');
    const heroDamage=hero.damage,unitDamage=unit.damage;
    gs.onBulletHitEnemy(hero,enemy);gs.onBulletHitEnemy(unit,enemy);
    gs.squad.health.applyShield(10,gs.time.now+5000);gs.squad.health.takeDamage(20,gs.time.now);
    const hp=gs.squad.health.currentHp;
    gs.squad.health.currentHp=23;gs.squad.health.clearShield();gs.clearEncounter();gs.roomState='CLEARED';
    return {heroDamage,unitDamage,targetLost:10000-enemy.health.currentHp,hp,heroCooldown:gs.squad.heroSnapshot().attackRemainingMs};
  })()`);
  assert.deepEqual({...combat,heroCooldown:0},{heroDamage:18,unitDamage:38,targetLost:56,hp:14,heroCooldown:0});
  assert.equal(combat.heroCooldown,1100);
  await evaluate("gs.openSquadModal('강화 복원 검증');undefined;");await waitFor("smash.scene.isActive('SquadScene')");
  await click('upgrade-open');await click('upgrade-buy-heroHealth'); // A real purchase persists active cooldown as well.
  const beforePause=await state();await sleep(250);await evaluate("smash.events.emit('hidden');undefined;");await sleep(200);
  await tap(360, 1210);await waitFor("!smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("smash.scene.isPaused('GameScene')"),true);assert.deepEqual(await state(),beforePause);
  const checkpoint=await save();
  assert.equal(checkpoint.roster.upgrades.heroHealth,2);assert.equal(checkpoint.hero.attackRemainingMs,1100);
  await send('Page.reload',{ignoreCache:true});await attach();await tap(360, 910);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');window.ss=smash.scene.getScene('SquadScene');undefined;");
  const restored=await state();assert.deepEqual(restored,beforePause);assert.deepEqual(await save(),checkpoint);
  await click('upgrade-open');
  for(let i=0;i<3;i++) {
    await close();await evaluate("gs.openSquadModal('중복 가산 검증');undefined;");await waitFor("smash.scene.isActive('SquadScene')");
    const current=await state();assert.equal(current.maxHp,120);assert.equal(current.hp,23);
    assert.deepEqual(current.units.map(d=>[d.hp,d.maxHp]),[[1,77],[0,77]]);
  }
  // Exercise the real stage-transition callback with controlled progression, avoiding invalid mutated grids.
  await close();await evaluate(`gs.scene.pause();gs.progression.clearBoss();gs.stats.bossesDefeated=gs.progression.bossesDefeated;
    gs.openSquadModal('스테이지 전환 검증',true);undefined;`);
  await waitFor("smash.scene.isActive('SquadScene')");await close();await evaluate('gs.scene.pause();undefined;');
  const next=await state();assert.deepEqual(next.upgrades,restored.upgrades);
  assert.equal(next.maxHp,120);assert.equal(next.hp,71);assert.deepEqual(next.units.map(d=>[d.hp,d.maxHp]),[[39,77],[39,77]]);
  assert.equal((await save()).stats.stageIndex,1);assert.deepEqual((await save()).roster.upgrades,restored.upgrades);
  await evaluate('gs.handlePlayerDeath();gs.scene.resume();undefined;');await waitFor("smash.scene.isActive('GameOverScene')");
  await tap(360,945);await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();undefined;");
  const restarted=await state();assert.deepEqual(restarted.upgrades,zero);assert.equal(restarted.maxHp,100);
  assert.ok(restarted.units.every(d=>d.maxHp===70 && d.defense===0));
  for(const version of [1,2]) {
    const legacy=structuredClone(initial);legacy.version=version;delete legacy.roster.upgrades;delete legacy.hero;
    legacy.leaderHealth={currentHp:23,maxHp:120};legacy.unitHealth.forEach(d=>d.currentHp=35);
    if(version===1){delete legacy.runId;delete legacy.phase;delete legacy.currentRoomId;legacy.unitHealth=legacy.unitHealth.map(({id,currentHp})=>({id,currentHp}));}
    const raw=JSON.stringify(legacy);
    await evaluate(`gs.returnToTitle();localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(raw)});undefined;`);
    await waitFor("smash.scene.isActive('MenuScene')");await tap(360, 910);await waitFor("smash.scene.isActive('GameScene')");
    await evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();undefined;");
    const old=await state();assert.deepEqual(old.upgrades,zero);assert.equal(old.hp,23);assert.equal(old.maxHp,120);
    assert.equal(old.minerals,legacy.roster.minerals);assert.deepEqual(old.units.map(d=>[d.hp,d.maxHp]),[[35,70],[35,70]]);
    assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"),raw);
  }
  assert.deepEqual(browser.errors,[]);
  const report={browser:await send('Browser.getVersion'),scenario:'controlled funded fixture; stage progression injected, actual UI purchases/save/collision callbacks',
    first,combat,restored,next,restarted,legacy:[1,2],cap:true,duplicate:true,touchCancel:true,widths:[720,360],errors:browser.errors};
  const {upgradeCost}=load('src/config/upgradeData.ts');
  report.costs=ids.map(id=>({id,first:upgradeCost(id,0),totalToLevel3:[0,1,2].reduce((sum,level)=>sum+upgradeCost(id,level),0),
    totalToLevel10:Array.from({length:10},(_,level)=>upgradeCost(id,level)).reduce((a,b)=>a+b,0)}));
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,types:6,purchases:true,HPpreserved:true,cap:true,saveRestore:true,
    stagePreserved:true,restart:true,legacy:[1,2],widths:[720,360],report:`${output}/report.json`}));
} finally {browser.close();}
