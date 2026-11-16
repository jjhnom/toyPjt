import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out='artifacts/desert-fangs-20261116',b=await browserSession();
try{
 await mkdir(out,{recursive:true});await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const battle=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.progression.index=5;
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('desert_emperor');
  gs.squad.leader.setPosition(360,630);gs.bossPatternNumber=0;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
  const interval=gs.bossPatternLeft;
  let hits=0;const resolve=gs.hazards.resolve;gs.hazards.resolve=kind=>{if(kind==='SPIKES')hits++;};
  const step=dt=>{gs.bossVfx.update(dt);gs.hazards.update(dt,gs.squad.leader);};
  step(interval);gs.updateBossPatterns(interval);
  const hazards=gs.hazards.slots.filter(s=>s.active),initial=hazards.length;
  const onlyFangs=hazards.every(h=>h.kind==='SPIKES'),positions=hazards.map(h=>[h.x,h.y]);
  gs.squad.leader.setPosition(500,800);
  step(999);const early=hits;gs.backgroundPaused=true;gs.update(gs.time.now,500);const paused=hits===early;gs.backgroundPaused=false;
  step(1);const counts=[hits];for(let i=0;i<4;i++){step(180);counts.push(hits);}
  const fixed=hazards.every((h,i)=>h.x===positions[i][0]&&h.y===positions[i][1]);
  step(1000);step(600);const cleaned=gs.bossVfx.activeCount;
  gs.hazards.resolve=resolve;gs.clearEncounter();return {initial,early,paused,counts,cleaned,fixed,onlyFangs,interval};
 })()`);
 assert.equal(battle.initial,5);assert.equal(battle.onlyFangs,true);assert.equal(battle.interval,4000);
 assert.equal(battle.early,0);assert.equal(battle.paused,true);assert.equal(battle.fixed,true);
 assert.deepEqual(battle.counts,[1,2,3,4,5]);assert.equal(battle.cleaned,0);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=desert_emperor&pattern=SPIKES'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  bossPreview.seek(1300);const s=bossPreview.scene,v=s.vfx.slots.filter(v=>v?.active);
  const frames=v.map(v=>({floor:v.floor.frame.name,air:v.flare.visible?v.flare.frame.name:null}));
  const aligned=v.every(v=>v.floor.x===v.state.x&&v.floor.y===v.state.y&&v.floor.displayWidth===v.state.radius*2);
  const n=s.children.length;for(let i=0;i<10;i++){bossPreview.seek(1300);bossPreview.seek(bossPreview.total);}
  return {frames,aligned,same:n===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed};
 })()`);
 assert.ok(preview.frames.some(v=>v.floor==='warn'));assert.ok(preview.frames.some(v=>v.air?.startsWith('fang_')));
 assert.equal(preview.aligned,true);assert.equal(preview.same,true);assert.equal(preview.active,0);assert.equal(preview.failed,false);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate('bossPreview.seek(1380)');
 const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(png.data,'base64'));
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify({battle,preview},null,2));
 console.log(JSON.stringify({status:'passed',battle,preview}));
}finally{b.close();}
