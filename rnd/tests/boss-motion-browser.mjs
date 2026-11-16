import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'after',out='artifacts/boss-motion-20261112';
const b=await browserSession(),{evaluate,send,click,waitFor}=b,report={phase,bosses:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor('smash.scene.isActive("GameScene")');
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();undefined;`);
 for(let stage=0;stage<5;stage++){
  const info=await evaluate(`(async()=>{
   gs.clearEncounter();const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');
   const {BOSS_IDS,BOSS_PROFILES}=await import('/src/config/bossData.ts');gs.progression.index=${stage};
   gs.gridManager=new RoomGridManager(gs.progression.current);const room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');gs.gridManager.restoreCurrentRoom(room.id);
   gs.currentWave=0;gs.startRoomLogic(room);gs.spawnNextWave(room);gs.processSpawns(10000);
   window.boss=gs.enemies.getChildren().find(e=>e.active&&e.bossId);gs.squad.setPositionImmediate(500,650);
   gs.bannerContainer.setVisible(false);gs.drawArenaForRoom(room);gs.refreshHud();
   window.motionCanvas=document.createElement('canvas');motionCanvas.width=16*192;motionCanvas.height=192;
   window.motionContext=motionCanvas.getContext('2d');motionContext.imageSmoothingEnabled=false;
   window.sampleFrame=(i)=>{const v=boss.bossVisual,f=v.frame;motionContext.drawImage(f.source.image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,i*192,0,192,192);return f.name;};
   return{id:BOSS_IDS[${stage}],patterns:BOSS_PROFILES[BOSS_IDS[${stage}]].patterns};})()`);
  const reset=`gs.hazards.clear();boss.spawn('BOSS_CORE',300,330,1);boss.applyBossProfile('${info.id}');boss.setTargetPosition(650,330);`;
  const walk=await evaluate(`(()=>{${reset}const frames=[];for(let i=0;i<16;i++){boss.setPosition(300+i*7,330);boss.update(gs.time.now+i*80,80);frames.push(sampleFrame(i));}
   return{frames,png:motionCanvas.toDataURL('image/png').split(',')[1],stats:[boss.health.maxHp,boss.spec.speed,boss.spec.contactDamage,boss.body.width,boss.body.height]};})()`);
  await writeFile(`${out}/${phase}-${info.id}-walk.png`,Buffer.from(walk.png,'base64'));delete walk.png;
  const kind=info.patterns.find(p=>p!=='CHARGE'),sequence=info.patterns.indexOf(kind);
  const cast=await evaluate(`(()=>{${reset}gs.bossPatternNumber=${sequence};gs.bossPatternLeft=0;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
   const warning=gs.hazards.slots.find(s=>s.active).warningMs,times=[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1,1.08,1.16,1.24,1.32,1.48],frames=[];let previous=0;
   for(let i=0;i<times.length;i++){const age=Math.round(warning*times[i]),delta=age-previous;boss.update(gs.time.now+age,delta);gs.hazards.update(delta);gs.bossVfx.update(0);frames.push(sampleFrame(i));previous=age;}
   return{frames,warning,png:motionCanvas.toDataURL('image/png').split(',')[1]};})()`);
  await writeFile(`${out}/${phase}-${info.id}-cast.png`,Buffer.from(cast.png,'base64'));delete cast.png;
  if(phase==='after'){
   assert.ok(new Set(walk.frames).size>=4,info.id+' must have four actual walking frames');
   assert.ok(new Set(cast.frames).size>=8,info.id+' must have cast and recovery frames');
   const stable=await evaluate(`(()=>{const f=boss.bossVisual.frame.name;boss.update(gs.time.now,0);boss.update(gs.time.now,0);return f===boss.bossVisual.frame.name;})()`);assert.equal(stable,true,'zero delta must not advance motion');
  }
  // Capture the real Phaser battle at both target mobile widths, at the held cast pose.
  await evaluate(`(()=>{${reset}gs.bossPatternNumber=${sequence};gs.bossPatternLeft=0;gs.updateBossPatterns(0);const dt=gs.hazards.slots.find(s=>s.active).warningMs*.8;boss.update(gs.time.now+dt,dt);gs.hazards.update(dt);})()`);
  for(const width of[360,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(100);
   const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${phase}-${info.id}-${width}.png`,Buffer.from(png.data,'base64'));}
  report.bosses.push({id:info.id,walk,cast});
 }
 if(phase==='after'){
  const before=JSON.parse(await readFile(`${out}/before-result.json`,'utf8'));
  assert.deepEqual(report.bosses.map(b=>b.walk.stats),before.bosses.map(b=>b.walk.stats),'physical stats must stay identical');
 }
 assert.deepEqual(b.errors,[]);await writeFile(`${out}/${phase}-result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'passed',phase,bosses:report.bosses.map(b=>({id:b.id,walkFrames:new Set(b.walk.frames).size,castFrames:new Set(b.cast.frames).size})),mobile:[360,390]}));
}finally{b.close();}
