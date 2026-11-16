import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out='artifacts/twilight-slash-20261116',b=await browserSession();
try{
 await mkdir(out,{recursive:true});await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const battle=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.progression.index=4;
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('twilight_king');
  gs.squad.roster.units=[];gs.squad.syncRoster();gs.squad.health.maxHp=1000;gs.squad.health.currentHp=1000;gs.squad.health.invulnerableUntil=0;
  const cast=()=>{gs.hazards.clear();gs.squad.leader.setPosition(360,630);gs.bossPatternNumber=5;gs.bossPatternLeft=0;gs.updateBossPatterns(0);};
  const step=dt=>{gs.time.now+=dt;gs.bossVfx.update(dt);gs.hazards.update(dt,gs.squad.leader);};
  cast();const initial=gs.hazards.slots.filter(h=>h.active).length;
  gs.squad.leader.setPosition(440,710);step(999);const early=gs.squad.health.currentHp===1000;
  gs.backgroundPaused=true;gs.update(gs.time.now,500);gs.backgroundPaused=false;const paused=gs.squad.health.currentHp===1000;
  step(1);const firstHp=gs.squad.health.currentHp;step(750);const avoidedSecond=gs.squad.health.currentHp===firstHp;
  cast();gs.squad.health.currentHp=1000;gs.squad.health.invulnerableUntil=0;
  step(1000);const middleHp=gs.squad.health.currentHp;step(750);const bothHit=gs.squad.health.currentHp<middleHp&&middleHp<1000;
  step(1500);step(500);const clean=gs.bossVfx.activeCount===0,bossStayed=boss.x===360&&boss.y===300;
  gs.clearEncounter();return {initial,early,paused,firstHit:firstHp<1000,avoidedSecond,bothHit,clean,bossStayed};
 })()`);
 assert.equal(battle.initial,2);for(const key of ['early','paused','firstHit','avoidedSecond','bothHit','clean','bossStayed'])assert.equal(battle[key],true,key);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=twilight_king&pattern=SLASH'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  bossPreview.seek(1120);const s=bossPreview.scene,v=s.vfx.slots.filter(v=>v?.active),first=v[0];
  const aligned=Math.abs(first.flare.x-(first.state.fromX+first.state.x)/2)<1e-6&&Math.abs(first.flare.y-(first.state.fromY+first.state.y)/2)<1e-6&&first.flare.mask===first.mask;
  const frame=first.flare.frame.name,n=s.children.length;
  bossPreview.seek(1870);const second=s.vfx.slots[1].flare.visible;
  for(let i=0;i<12;i++){bossPreview.seek(1120);bossPreview.seek(1870);bossPreview.seek(bossPreview.total);}
  return {aligned,frame,second,same:n===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed};
 })()`);
 assert.equal(preview.aligned,true);assert.ok(preview.frame.startsWith('slash_'));assert.equal(preview.second,true);
 assert.equal(preview.same,true);assert.equal(preview.active,0);assert.equal(preview.failed,false);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 for(const [name,time]of [['first',1120],['second',1870]]){
  await b.evaluate('bossPreview.seek('+time+')');const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/'+name+'.png',Buffer.from(png.data,'base64'));
 }
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify({battle,preview},null,2));console.log(JSON.stringify({status:'passed',battle,preview}));
}finally{b.close();}
