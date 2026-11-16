import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out='artifacts/lava-fissure-20261116',b=await browserSession();
try{
 await mkdir(out,{recursive:true});await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const battle=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.progression.index=2;
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('lava_colossus');
  gs.squad.leader.setPosition(360,630);gs.bossPatternNumber=1;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
  const hazards=gs.hazards.slots.filter(s=>s.active),initial=hazards.length;
  const positions=hazards.map(s=>[s.x,s.y]);gs.squad.leader.setPosition(500,800);
  let hits=0;const resolve=gs.hazards.resolve;gs.hazards.resolve=()=>hits++;
  const step=dt=>{gs.bossVfx.update(dt);gs.hazards.update(dt,gs.squad.leader);};
  step(1099);const early=hits;gs.backgroundPaused=true;gs.update(gs.time.now,500);const paused=hits===early;gs.backgroundPaused=false;
  step(1);const counts=[hits];for(let i=0;i<5;i++){step(150);counts.push(hits);}
  const fixed=hazards.every((h,i)=>h.x===positions[i][0]&&h.y===positions[i][1]);
  step(1200);step(600);const cleaned=gs.bossVfx.activeCount;
  gs.hazards.resolve=resolve;gs.clearEncounter();return {initial,early,paused,counts,cleaned,fixed,bossX:boss.x,bossY:boss.y};
 })()`);
 assert.equal(battle.initial,6);assert.equal(battle.early,0);assert.equal(battle.paused,true);assert.equal(battle.fixed,true);
 assert.deepEqual(battle.counts,[1,2,3,4,5,6]);assert.equal(battle.cleaned,0);
 assert.equal(battle.bossX,360);assert.equal(battle.bossY,300);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=lava_colossus&pattern=FISSURE'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  bossPreview.seek(1300);const s=bossPreview.scene;
  const v=s.vfx.slots.filter(v=>v?.active),frames=v.map(v=>({floor:v.floor.frame.name,air:v.flare.visible?v.flare.frame.name:null}));
  const aligned=v.every(v=>v.floor.x===v.state.x&&v.floor.y===v.state.y&&v.floor.displayWidth===v.state.radius*2);
  const n=s.children.length;for(let i=0;i<10;i++){bossPreview.seek(1300);bossPreview.seek(bossPreview.total);}
  return {frames,aligned,same:n===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed};
 })()`);
 assert.ok(preview.frames.some(v=>v.floor==='warn'));assert.ok(preview.frames.some(v=>v.air?.startsWith('column_')));
 assert.equal(preview.aligned,true);assert.equal(preview.same,true);assert.equal(preview.active,0);assert.equal(preview.failed,false);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate('bossPreview.seek(1430)');
 const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(png.data,'base64'));
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify({battle,preview},null,2));
 console.log(JSON.stringify({status:'passed',battle,preview}));
}finally{b.close();}
