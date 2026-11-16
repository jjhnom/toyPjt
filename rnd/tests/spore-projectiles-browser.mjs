import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out='artifacts/swamp-spores-20261116',b=await browserSession();
try{
 await mkdir(out,{recursive:true});await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const battle=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.progression.index=1;
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('swamp_lord');
  gs.squad.roster.units=[{id:'spore-guard',archetype:'BASIC_LASER',tier:1,deployed:true,star:1}];gs.squad.syncRoster();
  const drone=gs.squad.drones[0];drone.health.maxHp=1000;drone.health.currentHp=1000;drone.health.invulnerableUntil=0;drone.setPosition(360,500);
  gs.squad.health.maxHp=1000;gs.squad.health.currentHp=1000;gs.squad.health.invulnerableUntil=0;gs.squad.leader.setPosition(360,700);
  const cast=()=>{gs.hazards.clear();gs.bossPatternNumber=2;gs.bossPatternLeft=0;gs.updateBossPatterns(0);};
  const step=dt=>{gs.bossVfx.update(dt);gs.hazards.update(dt,gs.squad.leader);};
  cast();const initial=gs.hazards.slots.filter(s=>s.active).length;
  step(999);const early=drone.health.currentHp===1000&&gs.squad.health.currentHp===1000;
  const before=gs.hazards.slots.filter(s=>s.active).map(s=>[s.x,s.y]);
  gs.backgroundPaused=true;gs.update(gs.time.now,1000);gs.backgroundPaused=false;
  const paused=gs.hazards.slots.filter(s=>s.active).every((s,i)=>s.x===before[i][0]&&s.y===before[i][1]);
  step(1);step(1000);
  const droneHit=drone.health.currentHp<1000,leaderProtected=gs.squad.health.currentHp===1000;
  const hp=drone.health.currentHp;step(2000);step(500);const noPierce=drone.health.currentHp===hp&&gs.squad.health.currentHp===1000;
  drone.setPosition(600,900);cast();step(1000);step(3000);
  const leaderHit=gs.squad.health.currentHp<1000;
  gs.clearEncounter();return {initial,early,paused,droneHit,leaderProtected,noPierce,leaderHit,active:gs.bossVfx.activeCount};
 })()`);
 assert.equal(battle.initial,5);for(const key of ['early','paused','droneHit','leaderProtected','noPierce','leaderHit'])assert.equal(battle[key],true,key);
 assert.equal(battle.active,0);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=swamp_lord&pattern=SPORES'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  bossPreview.seek(1000);const s=bossPreview.scene,start=s.hazards.slots.filter(h=>h.active).map(h=>[h.x,h.y]);
  bossPreview.seek(2000);const end=s.hazards.slots.filter(h=>h.active).map(h=>[h.x,h.y]);
  const visible=s.vfx.slots.filter(v=>v?.active&&v.flare.visible).length,n=s.children.length;
  for(let i=0;i<12;i++){bossPreview.seek(2000);bossPreview.seek(bossPreview.total);}
  return {moved:Math.hypot(end[2][0]-start[2][0],end[2][1]-start[2][1]),visible,same:n===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed};
 })()`);
 assert.ok(Math.abs(preview.moved-160)<1e-6);assert.equal(preview.visible,5);assert.equal(preview.same,true);assert.equal(preview.active,0);assert.equal(preview.failed,false);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate('bossPreview.seek(2100)');
 const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(png.data,'base64'));
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify({battle,preview},null,2));console.log(JSON.stringify({status:'passed',battle,preview}));
}finally{b.close();}
