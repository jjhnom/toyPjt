import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'after',out='artifacts/boss-area-fit-20261112',b=await browserSession();
const {evaluate,send,click,waitFor}=b,report={phase,cases:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);
 window.resolves=[];const real=gs.resolveHazard.bind(gs);gs.resolveHazard=(...args)=>{resolves.push(args.slice(0,5));real(...args);};undefined;`);
 for(let stage=0;stage<5;stage++){
  const info=await evaluate(`(async()=>{gs.clearEncounter();const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');
   const {BOSS_IDS,BOSS_PROFILES}=await import('/src/config/bossData.ts');gs.progression.index=${stage};
   gs.gridManager=new RoomGridManager(gs.progression.current);const room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');gs.gridManager.restoreCurrentRoom(room.id);
   gs.drawArenaForRoom(room);gs.currentWave=1;gs.totalWavesInRoom=1;gs.roomState='LOCKED_WAVES';gs.refreshHud();
   window.boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile(BOSS_IDS[${stage}]);
   gs.squad.setPositionImmediate(360,940);gs.squad.health.maxHp=gs.squad.health.currentHp=100000;gs.squad.health.invulnerableUntil=0;
   return{id:boss.bossId,patterns:BOSS_PROFILES[boss.bossId].patterns};})()`);
  for(const [sequence,kind]of info.patterns.entries()){
   const plan=await evaluate(`(async()=>{gs.hazards.clear();resolves.length=0;gs.pendingSpawns.length=0;
    const {planBossAttack}=await import('/src/config/bossData.ts');const p=planBossAttack('${info.id}',2,${sequence},{x:360,y:300,speed:boss.spec.speed},{x:360,y:630});
    for(const a of p.attacks)gs.hazards.add(a.kind,a.x,a.y,10,boss.lifeId,{...a,bossId:'${info.id}'});
    return p;})()`);
   await evaluate(`gs.hazards.update(${plan.attacks[0].warningMs-1});undefined;`);assert.equal(await evaluate('resolves.length'),0);
   await evaluate('gs.hazards.update(1);undefined;');assert.equal(await evaluate('resolves.length'),plan.attacks.length);
   await evaluate('gs.bossVfx.update(360);gs.hazards.update(360);undefined;');
   if(kind!=='CHARGE')for(const width of [720,360]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(80);
    const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${phase}-${info.id}-${kind}-${width}.png`,Buffer.from(png.data,'base64'));
   }
   const data=await evaluate(`(()=>{const slots=gs.bossVfx.slots.filter(s=>s?.active);
    const geometry=[];for(const s of slots)for(const image of [s.floor,s.flare])if(image.visible){
     const crop=image.isCropped?{x:image._crop.x,y:image._crop.y,w:image._crop.width,h:image._crop.height}:null;
     geometry.push({frame:image.frame.name,layer:image===s.floor?'floor':'flare',cropped:!!crop,atlas:image.texture.key,
      cropBounds:crop?{x:image.x+(crop.x-image.originX*96)*image.scaleX,y:image.y+(crop.y-image.originY*96)*image.scaleY,width:crop.w*image.scaleX,height:crop.h*image.scaleY}:image.getBounds(),
      hazard:{x:s.state.x,y:s.state.y,radius:s.state.radius,kind:s.state.kind}});
    }return{geometry,resolves:[...resolves]};})()`);
   if(phase==='after'&&(kind==='POISON'||kind==='FROST')){
    const floors=data.geometry.filter(g=>g.layer==='floor');assert.equal(floors.length,plan.attacks.length);
    for(const f of floors){assert.ok(f.atlas.startsWith('boss_ground_'));const r=f.hazard.radius;
     assert.ok(Math.abs(f.cropBounds.x-(f.hazard.x-r))<.001&&Math.abs(f.cropBounds.y-(f.hazard.y-r))<.001);
     assert.ok(Math.abs(f.cropBounds.width-2*r)<.001&&Math.abs(f.cropBounds.height-2*r)<.001);
    }
   }
   report.cases.push({id:info.id,kind,plan,...data});
   await evaluate('gs.hazards.update(5000);gs.bossVfx.update(5000);undefined;');assert.equal(await evaluate('gs.bossVfx.activeCount'),0);
  }
 }
 if(phase==='after'){
  const raw=await readFile(out+'/before-result.json','utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(raw)assert.deepEqual(report.cases.map(({id,kind,plan,resolves})=>({id,kind,plan,resolves})),JSON.parse(raw).cases.map(({id,kind,plan,resolves})=>({id,kind,plan,resolves})));
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${phase}-result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'passed',phase,patterns:report.cases.length}));
}finally{b.close();}
