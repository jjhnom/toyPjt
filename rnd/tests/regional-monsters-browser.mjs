import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const b=await browserSession(),out='artifacts/regional-monsters-20261116';await mkdir(out,{recursive:true});const report=[];
try{
 await b.click('MenuScene','new-run');await b.waitFor("smash.scene.isActive('GameScene')");
 await b.evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);undefined");
 for(let stage=0;stage<6;stage++){
  const row=await b.evaluate(`(async()=>{
   gs.clearEncounter();gs.progression.index=${stage};gs.progression.state='PLAYING';gs.rewardModalOpen=false;
   const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');const {REGIONAL_MONSTERS}=await import('/src/config/monsterData.ts');
   gs.gridManager=new RoomGridManager(gs.progression.current);gs.roomState='LOCKED_WAVES';gs.currentWave=1;gs.totalWavesInRoom=1;gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());
   gs.squad.setPositionImmediate(360,760);gs.squad.health.maxHp=gs.squad.health.currentHp=100000;gs.squad.health.invulnerableUntil=0;
   for(const [i,type]of ['SWARMER','SPORE_SHOOTER','SUMMONER'].entries())gs.queueEnemy(type,180+i*180,420);
   for(let i=0;i<3;i++)gs.processSpawns(1000);
   const enemies=gs.enemies.getChildren().filter(e=>e.active),calls=[];const real=gs.resolveHazard.bind(gs);gs.hazards.resolve=(...a)=>{calls.push(a);real(...a);};
   for(const e of enemies){e.setTargetPosition(360,740);e.update(gs.time.now+1700,16);}
   window.monsterCastCalls=calls;gs.hazards.update(500);gs.refreshHud();
   return{stage:${stage},region:gs.progression.current.bossId,monsters:enemies.map(e=>({id:e.monster.id,name:e.spec.name,role:e.monster.role,texture:e.texture.key,frame:e.frame.name,filter:e.frame.source.glTexture.magFilter,body:e.body.radius})),hazards:gs.hazards.slots.filter(h=>h.active).map(h=>({kind:h.kind,radius:h.radius,warning:h.warningMs,color:h.color,shotX:h.shotX})),early:calls.length};
  })()`);
  assert.equal(row.monsters.length,3);assert.deepEqual(row.monsters.map(m=>m.role),['melee','ranged','caster']);for(const m of row.monsters){assert.equal(m.texture,'regional_monsters_v1');assert.ok(m.frame.startsWith(m.id));assert.equal(m.filter,9728);assert.ok(m.body>0);}
  assert.equal(row.early,0);assert.equal(row.hazards.length,2);assert.equal(row.hazards[0].kind,'SHOT');assert.equal(row.hazards[0].shotX,360);assert.equal(row.hazards[1].kind,['FROST','POISON','METEOR','FROST','SUMMON','POISON'][stage]);
  await b.send('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1,mobile:true});await sleep(60);let png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${row.region}-warning.png`,Buffer.from(png.data,'base64'));
  await b.evaluate('gs.hazards.update(501);undefined');assert.ok(await b.evaluate('monsterCastCalls.length')>=2);
  await b.send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});await sleep(60);png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${row.region}-360.png`,Buffer.from(png.data,'base64'));
  await b.evaluate('gs.hazards.clear();gs.pendingSpawns.length=0;undefined');assert.equal(await b.evaluate('gs.hazards.slots.filter(h=>h.active).length'),0);report.push(row);
 }
 const reused=await b.evaluate(`(()=>{const e=gs.enemies.getChildren().find(e=>e.active);e.spawn('BOSS_CORE',360,420);return{monster:e.monster,texture:e.texture.key};})()`);assert.equal(reused.monster,null);assert.ok(reused.texture!=='regional_monsters_v1');
 assert.deepEqual(b.errors,[]);await writeFile(`${out}/browser-result.json`,JSON.stringify({regions:report,reused,status:'passed'},null,2));console.log('All 6 regions / 18 monsters: real queued spawning, pixel sprites, ranged flight and caster hazards, warning/damage, cleanup and boss pool reuse passed.');
}finally{b.close();}
