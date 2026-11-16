import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out='artifacts/forest-roots-20261116',b=await browserSession();
try{
 await mkdir(out,{recursive:true});await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const battle=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.progression.index=0;
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('forest_guardian');
  gs.squad.leader.setPosition(360,630);gs.bossPatternNumber=2;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
  const hazards=gs.hazards.slots.filter(s=>s.active),initial=hazards.length,positions=hazards.map(s=>[s.x,s.y]);
  const resolve=gs.hazards.resolve,seen=new Set();gs.hazards.resolve=(kind,x,y)=>{if(kind==='ROOTS')seen.add(x+','+y);};
  const step=dt=>{gs.bossVfx.update(dt);gs.hazards.update(dt,gs.squad.leader);};
  gs.squad.leader.setPosition(500,800);step(999);const early=seen.size;
  gs.backgroundPaused=true;gs.update(gs.time.now,1000);gs.backgroundPaused=false;const paused=seen.size===early;
  step(1);const counts=[seen.size];for(let i=0;i<6;i++){step(100);counts.push(seen.size);}
  const fixed=hazards.every((h,i)=>h.x===positions[i][0]&&h.y===positions[i][1]);
  step(1000);step(600);const cleaned=gs.bossVfx.activeCount;
  gs.hazards.resolve=resolve;gs.clearEncounter();return {initial,early,paused,counts,fixed,cleaned};
 })()`);
 assert.equal(battle.initial,7);assert.equal(battle.early,0);assert.equal(battle.paused,true);assert.equal(battle.fixed,true);
 assert.deepEqual(battle.counts,[1,2,3,4,5,6,7]);assert.equal(battle.cleaned,0);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=forest_guardian&pattern=ROOTS'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  bossPreview.seek(1300);const s=bossPreview.scene,v=s.vfx.slots.filter(v=>v?.active);
  const frames=v.map(v=>({floor:v.floor.frame.name,air:v.flare.visible?v.flare.frame.name:null}));
  const aligned=v.every(v=>v.floor.x===v.state.x&&v.floor.y===v.state.y&&v.floor.displayWidth===v.state.radius*2);
  const n=s.children.length;for(let i=0;i<12;i++){bossPreview.seek(1300);bossPreview.seek(bossPreview.total);}
  return {frames,aligned,same:n===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed};
 })()`);
 assert.ok(preview.frames.some(v=>v.floor==='warn'));assert.ok(preview.frames.some(v=>v.air?.startsWith('root_')));
 assert.equal(preview.aligned,true);assert.equal(preview.same,true);assert.equal(preview.active,0);assert.equal(preview.failed,false);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate('bossPreview.seek(1650)');
 const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(png.data,'base64'));
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify({battle,preview},null,2));console.log(JSON.stringify({status:'passed',battle,preview}));
}finally{b.close();}
