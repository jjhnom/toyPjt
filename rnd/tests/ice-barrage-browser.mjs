import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out='artifacts/ice-barrage-20261116',b=await browserSession();
try{
 await mkdir(out,{recursive:true});await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const battle=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.progression.index=3;
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('frost_queen');
  gs.squad.leader.setPosition(360,630);gs.squad.roster.units=[];gs.squad.syncRoster();
  gs.bossPatternNumber=2;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
  const initial=gs.hazards.slots.filter(s=>s.active).length;
  let hits=0;const resolve=gs.hazards.resolve;gs.hazards.resolve=()=>hits++;
  const step=dt=>{gs.bossVfx.update(dt);gs.hazards.update(dt,gs.squad.leader);};
  step(1099);const early=hits;gs.backgroundPaused=true;gs.update(gs.time.now,500);const paused=hits===early;gs.backgroundPaused=false;
  step(1);const counts=[hits];for(let i=0;i<9;i++){step(180);counts.push(hits);}
  step(1200);step(300);const cleaned=gs.bossVfx.activeCount;
  gs.hazards.resolve=resolve;gs.clearEncounter();return {initial,early,paused,counts,cleaned};
 })()`);
 assert.equal(battle.initial,10);assert.equal(battle.early,0);assert.equal(battle.paused,true);
 assert.deepEqual(battle.counts,[1,2,3,4,5,6,7,8,9,10]);assert.equal(battle.cleaned,0);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=frost_queen&pattern=METEOR'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  bossPreview.seek(1200);const s=bossPreview.scene;
  const frames=s.vfx.slots.filter(v=>v?.active).map(v=>({floor:v.floor.visible?v.floor.frame.name:null,air:v.flare.visible?v.flare.frame.name:null}));
  const n=s.children.length;for(let i=0;i<10;i++){bossPreview.seek(1600);bossPreview.seek(bossPreview.total);}
  return {frames,same:n===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed};
 })()`);
 assert.ok(preview.frames.some(v=>v.air==='fall'));assert.ok(preview.frames.some(v=>v.air?.startsWith('burst_')));
 assert.equal(preview.same,true);assert.equal(preview.active,0);assert.equal(preview.failed,false);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate('bossPreview.seek(1450)');
 const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(png.data,'base64'));
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify({battle,preview},null,2));
 console.log(JSON.stringify({status:'passed',battle,preview}));
}finally{b.close();}
