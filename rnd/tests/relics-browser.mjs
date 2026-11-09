import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const browser=await browserSession(),{evaluate,waitFor,tap,send,attach}=browser;
const output='artifacts/relics';
const save=()=>evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const roster=()=>evaluate('gs.squad.roster.snapshot()');
const click=async name=>{const p=await evaluate(`(()=>{const c=smash.scene.getScene('SquadScene').children.getByName(${JSON.stringify(name)});return{x:c.x,y:c.y};})()`);await tap(p.x,p.y);};
const close=async()=>{await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");};
const reload=async data=>{
  if(data) await evaluate(`localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(JSON.stringify(data))});undefined;`);
  await send('Page.reload',{ignoreCache:true});await attach();await tap(360, 910);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');window.ss=smash.scene.getScene('SquadScene');undefined;");
};
try {
  await tap(360,910);await waitFor("smash.scene.isActive('GameScene')");
  const initial=await save();
  await evaluate("window.gs=smash.scene.getScene('GameScene');gs.clearEncounter();gs.finishRoom(gs.gridManager.getCurrentRoom());undefined;");
  await waitFor("smash.scene.isActive('SquadScene')");assert.deepEqual((await roster()).relicRewards,[]);await close();
  const path=await evaluate(`(()=>{const start=gs.gridManager.getCurrentRoom(),queue=[start],previous=new Map([[start.id,null]]);let target;
    for(const room of queue){if(room.type==='ELITE'){target=room;break;}
      for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){const next=gs.gridManager.grid[room.gridY+dy]?.[room.gridX+dx];
        if(next && next.type!=='BOSS' && !previous.has(next.id)){previous.set(next.id,room);queue.push(next);}}}
    const path=[];for(let room=target;room && room!==start;room=previous.get(room.id))path.unshift(room.id);return path;})()`);
  assert.ok(path.length);
  for(const id of path) {
    await evaluate(`(()=>{gs.scene.pause();const room=gs.gridManager.grid.flat().find(r=>r?.id===${JSON.stringify(id)}),current=gs.gridManager.getCurrentRoom();
      const direction=room.gridX>current.gridX?'right':room.gridX<current.gridX?'left':room.gridY>current.gridY?'bottom':'top';
      gs.gridManager.moveTo(direction);gs.enterRoom(room,direction);gs.clearEncounter();
      if(room.type==='ELITE'){gs.squad.health.currentHp=23;gs.squad.drones[0].health.currentHp=30;}
      if(room.type==='EVENT' || room.type==='RECOVERY' || room.cleared)gs.startRoomLogic(room);else gs.finishRoom(room);
      if(!gs.rewardModalOpen)gs.scene.resume();})()`);
    if(await evaluate("gs.rewardModalOpen && gs.gridManager.getCurrentRoom().type==='EVENT' && !gs.gridManager.getCurrentRoom().cleared")) {
      await waitFor("smash.scene.isActive('SummoningCircleScene')");await tap(360,1010);
      await waitFor("!smash.scene.isActive('SummoningCircleScene')");
    }
    if(await evaluate('gs.rewardModalOpen')) {
      await waitFor("smash.scene.isActive('SquadScene')");
      if(id!==path.at(-1))await close();
    }
  }
  await evaluate("window.ss=smash.scene.getScene('SquadScene');undefined;");
  const pending=await save();assert.equal(pending.roster.relicRewards.length,1);assert.equal(pending.roster.relicRewards[0].relicId,null);
  assert.equal(await evaluate('ss.relicMode'),true);
  await mkdir(output,{recursive:true});
  for(const width of [720,360]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width*1280/720,deviceScaleFactor:1,mobile:true});await sleep(200);
    const bounds=await evaluate(`ss.children.getChildren().filter(c=>c.name.startsWith('relic-')&&c.name!=='relic-open').map(c=>{const r=c.getBounds();return{name:c.name,x:r.x,right:r.right,y:r.y,bottom:r.bottom};})`);
    assert.equal(bounds.filter(c=>c.name.startsWith('relic-select-')).length,3);
    assert.ok(bounds.every(r=>r.x>=24 && r.right<=696 && r.y>=260 && r.bottom<=1000),JSON.stringify(bounds));
    assert.equal(await evaluate("ss.children.getByName('relic-open').getBounds().bottom<=1150"),true);
    const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/choice-${width}.png`,Buffer.from(png.data,'base64'));
  }
  const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const touch=(x,y)=>({x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(12,380),touch(708,580)]});
  await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await roster(),pending.roster);
  await click('relic-open');assert.equal(await evaluate('ss.relicMode'),false);
  assert.deepEqual(await roster(),pending.roster,'deferring cannot consume a reward');
  await close();await evaluate("gs.openSquadModal('보류한 유물 검증');undefined;");await waitFor("smash.scene.isActive('SquadScene')");
  const deferred=await save();await reload();assert.deepEqual(await roster(),deferred.roster);
  assert.equal(await evaluate('ss.relicMode'),true);
  await evaluate("window.oldChoice=ss.children.getByName('relic-select-COMMAND_BANNER').list.find(c=>c.input?.enabled);undefined;");
  await click('relic-select-COMMAND_BANNER');
  const banner=await save();assert.equal(banner.roster.relicRewards[0].relicId,'COMMAND_BANNER');
  assert.equal(banner.roster.minerals,deferred.roster.minerals);assert.deepEqual(banner.roster.units,deferred.roster.units);
  await evaluate("oldChoice.emit('pointerdown',{},0,0,{stopPropagation(){}});gs.finishRoom(gs.gridManager.getCurrentRoom());undefined;");
  assert.deepEqual(await roster(),banner.roster);await reload();assert.deepEqual(await roster(),banner.roster);
  const bannerDamage=await evaluate(`(()=>{gs.squad.roster.upgrades.squadAttack=2;gs.squad.syncRoster();
    gs.squad.setPositionImmediate(360,650);const e=gs.enemies.spawnEnemy('TANK',420,650);e.health.reset(10000);
    gs.squad.update(gs.time.now+1000,0,0,0,gs.enemies,1,1,0,true);
    const shots=gs.bullets.getChildren().filter(b=>b.active);const result={hero:shots.find(b=>b.sourceKind==='hero').damage,unit:shots.find(b=>b.sourceKind==='unit').damage};
    gs.clearEncounter();return result;})()`);
  assert.deepEqual(bannerDamage,{hero:8,unit:22});

  // Independent choices reuse the same real elite checkpoint to test every item without fabricating source rooms.
  await reload(pending);await click('relic-select-SEED_CHALICE');
  assert.equal((await save()).roster.relicRewards[0].relicId,'SEED_CHALICE');
  await evaluate(`gs.squad.health.currentHp=23;gs.squad.drones[0].health.currentHp=30;
    gs.squad.update(gs.time.now,1200,0,0,gs.enemies,1,1,0,true);undefined;`);
  assert.equal(await evaluate('gs.squad.relicHealingRemaining()'),3800);
  await click('upgrade-open');await click('upgrade-buy-heroHealth');
  const chalice=await save();assert.equal(chalice.relicHealRemainingMs,3800);assert.equal(chalice.leaderHealth.currentHp,23);
  await evaluate("smash.events.emit('hidden');undefined;");await sleep(250);await tap(360, 1210);
  await waitFor("!smash.scene.isActive('SquadScene')");assert.equal(await evaluate("smash.scene.isPaused('GameScene')"),true);
  assert.equal(await evaluate('gs.squad.relicHealingRemaining()'),3800);await reload();
  assert.equal(await evaluate('gs.squad.relicHealingRemaining()'),3800);assert.equal(await evaluate('gs.squad.health.currentHp'),23);
  const heal=await evaluate(`(()=>{gs.squad.update(gs.time.now,10000,0,0,gs.enemies,1,1,0,false);
    const frozen=gs.squad.relicHealingRemaining();gs.squad.update(gs.time.now,3799,0,0,gs.enemies,1,1,0,true);
    const before=gs.squad.health.currentHp;gs.squad.update(gs.time.now,1,0,0,gs.enemies,1,1,0,true);
    return{frozen,before,after:gs.squad.health.currentHp,ally:gs.squad.drones[0].health.currentHp};})()`);
  assert.deepEqual(heal,{frozen:3800,before:23,after:25,ally:32});

  await reload(pending);await click('relic-select-ARTISAN_SEAL');
  await evaluate("gs.squad.roster.grantReward(1000,0,'room','controlled-fixture');ss.dataSource.onChanged();ss.render();undefined;");
  const beforeCraft=await roster();await click('quick-craft-open');await click('quick-tier-4');await click('quick-craft-PHOENIX_LORD');
  const quote=await evaluate('ss.quickQuote');assert.equal(quote.unitTypeId,'PHOENIX_LORD');assert.ok(quote.totalCost<250);
  assert.equal(quote.totalCost,quote.summonCost+quote.combinationCost);
  const quotePng=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/discount-360.png`,Buffer.from(quotePng.data,'base64'));
  await tap(520,930);const afterCraft=await roster();
  assert.equal(afterCraft.minerals,beforeCraft.minerals-quote.totalCost);
  assert.deepEqual(afterCraft.units.slice(0,beforeCraft.units.length),beforeCraft.units);
  assert.equal(afterCraft.units.at(-1).archetype,'PHOENIX_LORD');assert.equal(afterCraft.freeSummons,beforeCraft.freeSummons);
  const artisan=await save();await reload();assert.deepEqual(await roster(),artisan.roster);
  const bad=structuredClone(artisan);bad.roster.relicRewards[0].relicId='unknown';
  await evaluate(`localStorage.setItem('smash.run-checkpoint.backup',${JSON.stringify(JSON.stringify(artisan))});undefined;`);
  await reload(bad);assert.deepEqual(await roster(),artisan.roster);
  assert.equal(await evaluate("gs.saveStatusText.text.includes('이전 정상')"),true);
  await close();await evaluate('gs.handlePlayerDeath();undefined;');await waitFor("smash.scene.isActive('GameOverScene')");
  await tap(360,945);await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();undefined;");
  assert.deepEqual((await roster()).relicRewards,[]);assert.equal(await evaluate('gs.squad.relicHealingRemaining()'),5000);
  assert.equal(await evaluate("gs.squad.roster.combinationCost('paladin')"),25);
  // Legacy fields absent: no items, no passive tick and no storage rewrite.
  const legacy=structuredClone(initial);delete legacy.roster.relicRewards;delete legacy.relicHealRemainingMs;
  legacy.leaderHealth.currentHp=23;const raw=JSON.stringify(legacy);
  await evaluate(`gs.returnToTitle();localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(raw)});undefined;`);
  await waitFor("smash.scene.isActive('MenuScene')");await tap(360, 910);await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();undefined;");
  assert.deepEqual((await roster()).relicRewards,[]);assert.equal(await evaluate('gs.squad.health.currentHp'),23);
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"),raw);
  assert.deepEqual(browser.errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({browser:await send('Browser.getVersion'),
    scenario:'connected real elite; controlled encounter completion/component ticks; independent reward choices reuse one checkpoint',
    source:pending.currentRoomId,deferred:true,bannerDamage,heal,quote,pending:pending.roster.relicRewards,
    chosen:[banner.roster.relicRewards,chalice.roster.relicRewards,artisan.roster.relicRewards],fallback:true,restart:true,widths:[720,360],errors:browser.errors},null,2));
  console.log(JSON.stringify({ok:true,items:3,eliteSource:true,defer:true,duplicate:true,healing:true,discount:quote.totalCost,
    reload:true,fallback:true,restart:true,widths:[720,360],report:`${output}/report.json`}));
} finally {browser.close();}
