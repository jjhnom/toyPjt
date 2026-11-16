import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'after',out='artifacts/twilight-vfx-fix-20261112';
const b=await browserSession(),{evaluate,click,send,waitFor}=b,report={phase,cases:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);
 window.resolves=[];const real=gs.resolveHazard.bind(gs);gs.resolveHazard=(...args)=>{resolves.push(args.slice(0,5));real(...args);};undefined;`);
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});await sleep(100);
 // Do not clear between the first two hazards: the expired queen slot is reused by the king.
 for(const [index,id]of ['frost_queen','twilight_king','frost_queen','twilight_king'].entries()){
  await evaluate(`window.boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile('${id}');
   resolves.length=0;gs.squad.setPositionImmediate(360,650);gs.squad.health.maxHp=gs.squad.health.currentHp=10000;gs.squad.health.invulnerableUntil=0;
   gs.squad.movement.clearModifiers();gs.hazards.add('FROST',360,650,10,boss.lifeId,{bossId:'${id}',radius:85,warningMs:1000,durationMs:2200});
   gs.hazards.update(999);undefined;`);
  assert.equal(await evaluate('resolves.length'),0);
  const frames=[];
  for(const delta of [1,200,600]){
   const view=await evaluate(`(()=>{gs.hazards.update(${delta});const s=gs.bossVfx.slots.find(s=>s?.active);
    return{frames:[s.floor,s.flare].filter(i=>i.visible).map(i=>i.frame.name),slot:gs.bossVfx.slots.indexOf(s)};})()`);
   assert.ok(view.frames.length>0);assert.ok(view.frames.every(f=>f.startsWith(id+'_')));
   if(phase==='after'&&id==='twilight_king')assert.ok(view.frames.every(f=>/^twilight_king_(summon|impact)_/.test(f)),JSON.stringify(view));
   if(id==='frost_queen')assert.ok(view.frames.every(f=>/^frost_queen_(field|impact)_/.test(f)));
   assert.equal(view.slot,0);frames.push(view);
  }
  const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${phase}-${index}-${id}.png`,Buffer.from(png.data,'base64'));
  const mechanics=await evaluate(`({resolves:[...resolves],hp:gs.squad.health.currentHp,slow:gs.squad.movement.slowFactor,until:Math.round((gs.squad.movement.slowUntil-gs.time.now)*1000)/1000})`);
  assert.equal(mechanics.slow,.65);assert.equal(mechanics.until,800);assert.equal(mechanics.hp,9990);
  assert.deepEqual(mechanics.resolves,Array.from({length:3},()=>['FROST',360,650,85,10]));
  await evaluate('gs.hazards.update(1400);undefined;');assert.equal(await evaluate('gs.bossVfx.activeCount'),0);
  await evaluate('boss.deactivate();undefined;');report.cases.push({id,frames,mechanics});
 }
 if(phase==='after'){
  const raw=await readFile(out+'/before-result.json','utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(raw){const before=JSON.parse(raw);assert.deepEqual(report.cases.map(c=>c.mechanics),before.cases.map(c=>c.mechanics));}
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(out+'/'+phase+'-result.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'passed',phase,cases:report.cases.length}));
}finally{b.close();}
