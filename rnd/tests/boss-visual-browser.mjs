import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'after',out='artifacts/boss-redesign-20261112';
const b=await browserSession(),{evaluate,send,click,waitFor}=b,report={phase,cases:[],shots:[],visualChecks:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor('smash.scene.isActive("GameScene")');
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);
  window.resolveEvents=[];window.realBossResolve=gs.resolveHazard.bind(gs);gs.resolveHazard=(...args)=>{resolveEvents.push(args.slice(0,5));realBossResolve(...args);};undefined;`);
 const shot=async(name,width)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(100);
  const data=await send('Page.captureScreenshot',{format:'png'}),file=`${phase}-${name}-${width}.png`;
  await writeFile(out+'/'+file,Buffer.from(data.data,'base64'));report.shots.push(file);
 };
 for(let index=0;index<5;index++){
  const profile=await evaluate(`(async()=>{
   gs.clearEncounter();const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');
   const {BOSS_IDS,BOSS_PROFILES}=await import('/src/config/bossData.ts');gs.progression.index=${index};gs.stats.stageIndex=${index};
   gs.gridManager=new RoomGridManager(gs.progression.current);const room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');gs.gridManager.restoreCurrentRoom(room.id);
   gs.currentWave=0;gs.startRoomLogic(room);gs.spawnNextWave(room);gs.processSpawns(10000);
   window.boss=gs.enemies.getChildren().find(e=>e.active&&e.spec.archetype==='BOSS_CORE');if(!boss)throw Error('Missing real boss spawn');
   gs.squad.setPositionImmediate(360,650);gs.squad.health.maxHp=100000;gs.squad.health.currentHp=100000;
   gs.bannerContainer.setVisible(false);gs.drawArenaForRoom(room);gs.refreshHud();
   return{id:BOSS_IDS[${index}],patterns:BOSS_PROFILES[BOSS_IDS[${index}]].patterns,warningMs:BOSS_PROFILES[BOSS_IDS[${index}]].warningMs};})()`);
  for(let sequence=0;sequence<profile.patterns.length;sequence++){
   const initial=await evaluate(`(()=>{
    gs.hazards.clear();gs.particles.clear(true,true);boss.setPosition(360,300);boss.spawn('BOSS_CORE',360,300,1);boss.applyBossProfile('${profile.id}');
    gs.squad.setPositionImmediate(360,650);gs.bossPatternNumber=${sequence};gs.bossPatternLeft=0;resolveEvents.length=0;gs.updateBossPatterns(0);
    const attacks=gs.hazards.slots.filter(s=>s.active).map(s=>({kind:s.kind,x:s.x,y:s.y,radius:s.radius,warningMs:s.warningMs,duration:s.duration,fromX:s.fromX,fromY:s.fromY}));
    return{boss:{hp:boss.health.maxHp,speed:boss.spec.speed,damage:boss.spec.contactDamage,body:[boss.body.width,boss.body.height,boss.body.radius,boss.body.offset.x,boss.body.offset.y],scale:boss.scaleX},attacks};})()`);
   const warning=Math.floor(profile.warningMs*.7);
   await evaluate(`gs.hazards.update(${warning});boss.update(gs.time.now,${warning});gs.bossVfx?.update(0);undefined;`);
   assert.equal(await evaluate('resolveEvents.length'),0);
   for(const width of [360,390])await shot(profile.id+'-'+profile.patterns[sequence]+'-warning',width);
   await evaluate(`gs.hazards.update(${profile.warningMs-warning});boss.update(gs.time.now,0);gs.bossVfx?.update(0);undefined;`);
   const count=await evaluate('resolveEvents.length');assert.equal(count,initial.attacks.length);
   if(phase==='after'){
    const visual=await evaluate(`(()=>{const slots=gs.bossVfx.slots.filter(s=>s?.active);
     return{frame:boss.bossVisual.frame.name,shown:boss.bossVisual.visible,bodyAlpha:boss.alpha,failed:gs.hazards.visualFailed,
      visibleSlots:slots.filter(s=>s.floor.visible||s.flare.visible).length,masked:slots.every(s=>s.floor.mask===s.mask&&s.flare.mask===s.mask)};})()`);
    assert.ok(visual.frame.startsWith(profile.id+'_'));assert.equal(visual.shown,true);assert.equal(visual.bodyAlpha,0);
    assert.equal(visual.failed,false);assert.equal(visual.visibleSlots,initial.attacks.length);assert.equal(visual.masked,true);
    if(profile.id==='twilight_king'&&profile.patterns[sequence]==='CHARGE')assert.match(visual.frame,/^twilight_king_motion_[0-3]$/);
    report.visualChecks.push({id:profile.id,kind:profile.patterns[sequence],...visual});
   }
   for(const width of [360,390])await shot(profile.id+'-'+profile.patterns[sequence]+'-impact',width);
   report.cases.push({id:profile.id,kind:profile.patterns[sequence],...initial,resolves:count});
  }
 }
 if(phase==='after'){
  const before=JSON.parse(await readFile(out+'/before-result.json','utf8'));
  assert.deepEqual(report.cases,before.cases,'Boss stats, hitboxes, attacks and damage timing must remain identical');
  report.lifecycle=await evaluate(`(()=>{
   const persistent=[];for(const kind of ['POISON','FROST']){
    gs.hazards.clear();gs.hazards.add(kind,360,650,10,boss.lifeId,{bossId:'twilight_king',warningMs:1000,durationMs:2200});
    gs.hazards.update(1000);const alive=gs.bossVfx.activeCount;gs.hazards.update(2200);persistent.push({kind,alive,expired:gs.bossVfx.activeCount});
   }
   gs.hazards.clear();gs.pendingSpawns.length=0;gs.bossPatternNumber=4;gs.bossPatternLeft=0;gs.updateBossPatterns(0);gs.hazards.update(1000);
   const queued=gs.pendingSpawns.length,birthsBefore=gs.bossVfx.arrivals.filter(a=>a.active).length,real=gs.enemies.spawnEnemy;
   gs.enemies.spawnEnemy=()=>null;try{gs.processSpawns(10000);}finally{gs.enemies.spawnEnemy=real;}
   const blocked=gs.bossVfx.arrivals.filter(a=>a.active).length,pendingAfterFailure=gs.pendingSpawns.length;
   gs.processSpawns(10000);gs.processSpawns(10000);const birthsAfter=gs.bossVfx.arrivals.filter(a=>a.active).length;
   gs.bossVfx.phaseChanged(boss,1);gs.bossVfx.phaseChanged(boss,2);gs.bossVfx.update(350);
   const phaseHalf=gs.bossVfx.phaseLeft;gs.bossVfx.update(350);const phaseDone=gs.bossVfx.phaseLeft;
   return{persistent,queued,birthsBefore,blocked,pendingAfterFailure,birthsAfter,phaseHalf,phaseDone};})()`);
  for(const s of report.lifecycle.persistent){assert.ok(s.alive>0);assert.equal(s.expired,0,s.kind);}
  assert.equal(report.lifecycle.queued,2);assert.equal(report.lifecycle.birthsBefore,0);assert.equal(report.lifecycle.blocked,0);
  assert.equal(report.lifecycle.pendingAfterFailure,2);assert.equal(report.lifecycle.birthsAfter,2);
  assert.equal(report.lifecycle.phaseHalf,350);assert.equal(report.lifecycle.phaseDone,0);
  report.reset=await evaluate(`(()=>{gs.hazards.clear();const old=gs.enemies.getLength();boss.deactivate();boss.spawn('SWARMER',250,400);
   return{bossId:boss.bossId,normalAlpha:boss.alpha,visualHidden:!boss.bossVisual||!boss.bossVisual.visible,vfxActive:gs.bossVfx.activeCount};})()`);
  assert.equal(report.reset.bossId,null);assert.equal(report.reset.normalAlpha,1);assert.equal(report.reset.visualHidden,true);assert.equal(report.reset.vfxActive,0);
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(out+'/'+phase+'-result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({phase,status:report.status,cases:report.cases.length,shots:report.shots.length}));
}finally{b.close();}
