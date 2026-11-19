import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const out='artifacts/boss-telegraph-20261118';
const browser=await browserSession(),{evaluate,send,click,waitFor}=browser;
const report={cases:[],screenshots:[],collisionSamples:[]};
try{
 await mkdir(out,{recursive:true});
 await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  gs.bannerContainer.setVisible(false);gs.squad.health.maxHp=gs.squad.health.currentHp=100000;
  window.resolutions=[];window.impacts=[];
  const resolve=gs.resolveHazard.bind(gs);gs.resolveHazard=(...args)=>{resolutions.push(args);return resolve(...args);};
  const draw=gs.bossVfx.draw.bind(gs.bossVfx);gs.bossVfx.draw=(index,state,impact)=>{
   if(impact)impacts.push({index,kind:state.kind,age:state.age,warningMs:state.warningMs,x:state.x,y:state.y,radius:state.radius});
   return draw(index,state,impact);
  };undefined;`);
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});
 const profiles=await evaluate(`(async()=>{const {BOSS_IDS,BOSS_PROFILES}=await import('/src/config/bossData.ts');return BOSS_IDS.map(id=>({id,patterns:BOSS_PROFILES[id].patterns}));})()`);
 const representative={forest_guardian:'METEOR',swamp_lord:'POISON',lava_colossus:'METEOR',frost_queen:'METEOR',twilight_king:'SLASH',desert_emperor:'SPIKES'};
 const capture=async name=>{
  await sleep(60);const png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${out}/${name}.png`,Buffer.from(png.data,'base64'));report.screenshots.push(name+'.png');
 };
 for(const profile of profiles){
  await evaluate(`gs.clearEncounter();window.boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile('${profile.id}');
   gs.roomState='LOCKED_WAVES';gs.squad.setPositionImmediate(360,1000);undefined;`);
  for(const [sequence,kind]of profile.patterns.entries()){
   const plan=await evaluate(`(async()=>{
    gs.hazards.clear();resolutions.length=0;impacts.length=0;
    const {planBossAttack}=await import('/src/config/bossData.ts');
    const plan=planBossAttack('${profile.id}',2,${sequence},{x:360,y:300,speed:boss.spec.speed},{x:360,y:630});
    for(const attack of plan.attacks)gs.hazards.add(attack.kind,attack.x,attack.y,boss.spec.contactDamage,boss.lifeId,{...attack,bossId:'${profile.id}',patternId:${sequence}});
    return plan;
   })()`);
   const deadlines=[...new Set(plan.attacks.map(a=>a.warningMs))].sort((a,b)=>a-b);
   let age=0;
   for(const [step,deadline]of deadlines.entries()){
    await evaluate(`gs.hazards.update(${deadline-1-age});undefined;`);age=deadline-1;
    if(step===0){
     assert.equal(await evaluate('resolutions.length'),0,`${profile.id}/${kind}: no early resolution`);
     assert.equal(await evaluate('impacts.length'),0,`${profile.id}/${kind}: no early impact`);
     if(kind===representative[profile.id])await capture(`${profile.id}-warning-360`);
    }
    await evaluate('gs.hazards.update(1);undefined;');age=deadline;
    const events=await evaluate(`impacts.filter(e=>e.warningMs===${deadline})`);
    const expected=plan.attacks.filter(a=>a.warningMs===deadline);
    assert.equal(events.length,expected.length,`${profile.id}/${kind}: scheduled impacts`);
    for(let i=0;i<events.length;i++)assert.deepEqual(
     [events[i].kind,events[i].age,events[i].x,events[i].y,events[i].radius],
     [expected[i].kind,deadline,expected[i].x,expected[i].y,expected[i].radius]);
    assert.equal(await evaluate('gs.hazards.visualFailed'),false,`${profile.id}/${kind}: visual observer`);
    if(step===0&&kind===representative[profile.id])await capture(`${profile.id}-impact-360`);
   }
   const state=await evaluate('({impacts:[...impacts],activeVfx:gs.bossVfx.activeCount})');
   assert.equal(state.impacts.length,plan.attacks.length);assert.ok(state.activeVfx<=32);
   report.cases.push({id:profile.id,kind,plan,...state});
   if(!['CHARGE','SLASH','SPORES','SUMMON'].includes(kind)){
    const sample=await evaluate(`(()=>{
     const a=${JSON.stringify(plan.attacks[0])},results=[];
     for(const offset of [-1,1]){
      gs.squad.leader.setPosition(a.x+a.radius+offset,a.y);
      gs.squad.health.currentHp=100000;gs.squad.health.invulnerableUntil=0;
      gs.resolveHazard(a.kind,a.x,a.y,a.radius,10,boss.lifeId);
      results.push(100000-gs.squad.health.currentHp);
     }
     gs.squad.leader.setPosition(360,1000);return{insideDamage:results[0],outsideDamage:results[1],radius:a.radius};
    })()`);
    assert.ok(sample.insideDamage>0,`${profile.id}/${kind}: inside warning circle`);
    assert.equal(sample.outsideDamage,0,`${profile.id}/${kind}: outside warning circle`);
    report.collisionSamples.push({id:profile.id,kind,...sample});
   }
  }
 }
 report.recovery=await evaluate(`(()=>{
  gs.hazards.clear();gs.squad.setPositionImmediate(360,630);
  const add=()=>gs.hazards.add('SPIKES',360,630,10,boss.lifeId,{bossId:'desert_emperor',warningMs:1000,radius:50});
  const draw=gs.bossVfx.draw;let failed,firstDamage;
  gs.squad.health.invulnerableUntil=0;const hp=gs.squad.health.currentHp;
  gs.bossVfx.draw=()=>{throw Error('injected cosmetic failure');};
  try{add();gs.hazards.update(1000);failed=gs.hazards.visualFailed;firstDamage=hp-gs.squad.health.currentHp;}
  finally{gs.bossVfx.draw=draw;}
  gs.hazards.clear();gs.squad.health.invulnerableUntil=0;
  const hp2=gs.squad.health.currentHp;add();gs.hazards.update(1000);
  const recovered=!gs.hazards.visualFailed,secondDamage=hp2-gs.squad.health.currentHp;
  const visible=gs.bossVfx.slots.some(s=>s?.active&&(s.floor.visible||s.flare.visible));
  const children=gs.children.length;
  for(let i=0;i<20;i++){gs.hazards.clear();add();gs.hazards.update(1000);}
  return{failed,firstDamage,recovered,secondDamage,visible,children,childrenAfter:gs.children.length};
 })()`);
 assert.equal(report.recovery.failed,true);assert.ok(report.recovery.firstDamage>0);
 assert.equal(report.recovery.recovered,true);assert.equal(report.recovery.secondDamage,report.recovery.firstDamage);
 assert.equal(report.recovery.visible,true);assert.equal(report.recovery.childrenAfter,report.recovery.children);
 await capture('recovered-impact-360');
 assert.deepEqual(browser.errors,[]);
 report.status='passed';await writeFile(`${out}/browser-report.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,patterns:report.cases.length,circularBoundaries:report.collisionSamples.length,screenshots:report.screenshots.length,recovery:report.recovery}));
}finally{browser.close();}
