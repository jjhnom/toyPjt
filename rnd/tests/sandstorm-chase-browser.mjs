import assert from 'node:assert/strict';
import {browserSession} from './helpers/browser-session.mjs';
const b=await browserSession();
try{
 await b.click('MenuScene','new-run');await b.waitFor('smash.scene.isActive("GameScene")');
 const result=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);boss.applyBossProfile('desert_emperor');
  gs.squad.leader.setPosition(500,600);
  gs.hazards.add('POISON',300,600,10,boss.lifeId,{bossId:'desert_emperor',radius:90,warningMs:1200,durationMs:2400});
  const visual=gs.bossVfx.slots.find(s=>s?.active),shape=visual.shape,fill=shape.fillCircle;
  let maskCenter;
  shape.fillCircle=function(x,y,r){maskCenter={x,y,r};return fill.call(this,x,y,r);};
  let hit;const resolve=gs.hazards.resolve;gs.hazards.resolve=(...args)=>{hit={x:args[1],y:args[2]};};
  gs.hazards.update(1200,gs.squad.leader);
  gs.hazards.update(500,gs.squad.leader);
  const forward={x:visual.state.x,y:visual.state.y,floorX:visual.floor.x,floorY:visual.floor.y,mask:maskCenter,hit};
  gs.squad.leader.setPosition(200,600);
  gs.hazards.update(250,gs.squad.leader);
  const reverse=visual.state.x;
  const before=visual.state.age;
  gs.backgroundPaused=true;gs.update(gs.time.now,500);
  const paused=visual.state.age===before&&visual.state.x===reverse;
  gs.backgroundPaused=false;
  gs.hazards.resolve=resolve;shape.fillCircle=fill;
  gs.clearEncounter();
  return {forward,reverse,paused,active:gs.bossVfx.activeCount};
 })()`);
 assert.equal(result.forward.x,322.5);assert.equal(result.forward.floorX,322.5);
 assert.deepEqual(result.forward.mask,{x:322.5,y:600,r:90});
 assert.deepEqual(result.forward.hit,{x:322.5,y:600});
 assert.equal(result.reverse,311.25);assert.equal(result.paused,true);assert.equal(result.active,0);
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=desert_emperor&pattern=POISON'});
 await b.waitFor('!!window.bossPreview');
 const preview=await b.evaluate(`(()=>{
  document.getElementById('phase').value='2';document.getElementById('phase').dispatchEvent(new Event('change'));
  bossPreview.seek(1200);const start=bossPreview.scene.hazards.slots.filter(s=>s.active).map(s=>s.x);
  bossPreview.seek(1700);const end=bossPreview.scene.hazards.slots.filter(s=>s.active).map(s=>s.x);
  bossPreview.seek(1700);const replay=bossPreview.scene.hazards.slots.filter(s=>s.active).map(s=>s.x);
  return {start,end,replay};
 })()`);
 assert.equal(preview.start.length,2);
 assert.ok(Math.abs(preview.end[1]-preview.start[1]+22.5)<1e-6);
 assert.deepEqual(preview.end,preview.replay);assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({status:'passed',game:result,preview}));
}finally{b.close();}
