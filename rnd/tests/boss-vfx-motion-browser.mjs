import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'after',out='artifacts/boss-vfx-motion-20261112';
const b=await browserSession(),{evaluate,send,click,waitFor}=b,report={phase,cases:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor('smash.scene.isActive("GameScene")');
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);
  window.resolves=[];window.originalResolve=gs.resolveHazard.bind(gs);gs.resolveHazard=(...args)=>{resolves.push(args.slice(0,5));originalResolve(...args);};
  window.sampleVfx=(cell)=>{const s=gs.bossVfx.slots.find(s=>s?.active);if(!s)return[];
   const h=s.state,ctx=strip.getContext('2d'),cx=h.fromX===null?h.x:(h.fromX+h.x)/2,cy=h.fromY===null?h.y:(h.fromY+h.y)/2;
   const size=h.fromX===null?h.radius*2+16:Math.max(Math.abs(h.x-h.fromX),Math.abs(h.y-h.fromY))+h.radius*2+16,k=192/size;
   const px=x=>cell*192+96+(x-cx)*k,py=y=>96+(y-cy)*k;
   ctx.save();ctx.beginPath();
   if(h.fromX===null){ctx.arc(px(h.x),py(h.y),h.radius*k,0,Math.PI*2);ctx.clip();}
   else{ctx.beginPath();const angle=Math.atan2(h.y-h.fromY,h.x-h.fromX),nx=-Math.sin(angle)*h.radius,ny=Math.cos(angle)*h.radius;
    ctx.moveTo(px(h.fromX+nx),py(h.fromY+ny));ctx.lineTo(px(h.x+nx),py(h.y+ny));ctx.arc(px(h.x),py(h.y),h.radius*k,angle+Math.PI/2,angle-Math.PI/2,true);ctx.lineTo(px(h.fromX-nx),py(h.fromY-ny));ctx.arc(px(h.fromX),py(h.fromY),h.radius*k,angle-Math.PI/2,angle+Math.PI/2,true);ctx.closePath();ctx.clip();}
   const frames=[];for(const image of[s.floor,s.flare])if(image.visible){
    const f=image.frame,w=image.displayWidth*k,h=image.displayHeight*k;ctx.globalAlpha=image.alpha;ctx.imageSmoothingEnabled=false;
    ctx.save();ctx.translate(px(image.x),py(image.y));if(image.flipX)ctx.scale(-1,1);
    ctx.drawImage(f.source.image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,-image.originX*w,-image.originY*h,w,h);ctx.restore();frames.push(image.texture.key+'/'+f.name);
   }ctx.restore();return frames;};undefined;`);
 for(let stage=0;stage<5;stage++){
  const info=await evaluate(`(async()=>{gs.clearEncounter();const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');const {BOSS_IDS,BOSS_PROFILES}=await import('/src/config/bossData.ts');
   gs.progression.index=${stage};gs.gridManager=new RoomGridManager(gs.progression.current);const room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');gs.gridManager.restoreCurrentRoom(room.id);
   gs.currentWave=0;gs.startRoomLogic(room);gs.spawnNextWave(room);gs.processSpawns(10000);gs.drawArenaForRoom(room);gs.refreshHud();gs.bannerContainer.setVisible(false);
   window.boss=gs.enemies.getChildren().find(e=>e.active&&e.bossId);return{id:BOSS_IDS[${stage}],patterns:BOSS_PROFILES[BOSS_IDS[${stage}]].patterns};})()`);
  for(const [sequence,kind]of info.patterns.entries()){
   const data=await evaluate(`(()=>{gs.hazards.clear();boss.spawn('BOSS_CORE',360,300,1);boss.applyBossProfile('${info.id}');gs.squad.setPositionImmediate(360,650);gs.squad.health.maxHp=gs.squad.health.currentHp=100000;
    resolves.length=0;gs.bossPatternNumber=${sequence};gs.bossPatternLeft=0;gs.updateBossPatterns(0);window.firstHazard=gs.hazards.slots.find(h=>h.active);
    window.strip=document.createElement('canvas');strip.width=32*192;strip.height=192;
    return{warning:firstHazard.warningMs,attacks:gs.hazards.slots.filter(h=>h.active).map(h=>({kind:h.kind,x:h.x,y:h.y,radius:h.radius,warning:h.warningMs,duration:h.duration,fromX:h.fromX,fromY:h.fromY})),stats:[boss.health.maxHp,boss.spec.speed,boss.spec.contactDamage,boss.body.width,boss.body.height]};})()`);
   const times=[0,Math.round(data.warning*.5),Math.round(data.warning*.65),Math.round(data.warning*.75),Math.round(data.warning*.85),data.warning-1,
    ...[0,40,80,120,160,200,240,280,320,360,400,440,480,560,640,720,800,1000].map(t=>data.warning+t)];
   let previous=0;const samples=[];
   for(const [i,age]of times.entries()){
    const delta=age-previous;
    const frames=await evaluate(`(()=>{boss.update(gs.time.now+${age},${delta});gs.bossVfx.update(${delta});gs.hazards.update(${delta});return sampleVfx(${i});})()`);
    samples.push({age,frames});previous=age;
   }
   const png=await evaluate("strip.toDataURL('image/png').split(',')[1]");await writeFile(`${out}/${phase}-${info.id}-${kind}-strip.png`,Buffer.from(png,'base64'));
   const mechanics=await evaluate(`({resolves:[...resolves],stats:[boss.health.maxHp,boss.spec.speed,boss.spec.contactDamage,boss.body.width,boss.body.height]})`);
   if(phase==='after')assert.ok(samples.some(s=>s.frames.some(f=>f.startsWith(kind==='CHARGE'?'boss_vfx_v2/':'boss_ground_hd_'))),info.id+'/'+kind+' needs its configured animation');
   // Persistent fields keep their original lifetime; all transient visual tails must finish too.
   await evaluate('gs.bossVfx.update(4000);gs.hazards.update(4000);gs.bossVfx.update(4000);undefined;');
   assert.equal(await evaluate('gs.bossVfx.activeCount'),0,'effects must expire');
   report.cases.push({id:info.id,kind,...data,samples,mechanics});
  }
  // Use one representative impact in the real battle at the two target widths.
  await evaluate(`gs.hazards.clear();boss.spawn('BOSS_CORE',360,300,1);boss.applyBossProfile('${info.id}');gs.bossPatternNumber=0;gs.bossPatternLeft=0;gs.updateBossPatterns(0);gs.hazards.update(firstHazard.warningMs+120);undefined;`);
  for(const width of[360,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(100);
   const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${phase}-${info.id}-${width}.png`,Buffer.from(png.data,'base64'));}
 }
 if(phase==='after'){
  const before=JSON.parse(await readFile(`${out}/before-result.json`,'utf8'));
  assert.deepEqual(report.cases.map(({id,kind,stats,attacks,mechanics})=>({id,kind,stats,attacks,mechanics})),before.cases.map(({id,kind,stats,attacks,mechanics})=>({id,kind,stats,attacks,mechanics})),'VFX must preserve actual attack plans and damage callbacks');
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${phase}-result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'passed',phase,patterns:report.cases.length,samples:report.cases.reduce((n,c)=>n+c.samples.length,0),mobile:[360,390]}));
}finally{b.close();}
