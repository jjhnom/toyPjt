import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,load} from './helpers/skill-fixture.mjs';
import {readFileSync} from 'node:fs';
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {BOSS_IDS,planBossAttack}=load('src/config/bossData.ts');
const {BOSS_VISUALS,bossPoseFrame,bossEffectFrame,bossEffectFor,bossFieldEffectFor}=load('src/config/bossVisualData.ts');
const {Enemy}=load('src/entities/Enemy.ts');
const scene=()=>{let g;g=new Proxy({},{get:()=>()=>g});return{add:{graphics:()=>g}};};

test('king FROST uses existing dark magic frames while queen retains ice, including reused hazard colors',()=>{
 const atlas=JSON.parse(readFileSync('src/assets/bosses-v1/atlas.json','utf8'));
 for(const [id,floor]of [['twilight_king','summon'],['frost_queen','field']]){
  assert.equal(bossFieldEffectFor(id,'FROST'),floor);assert.equal(bossEffectFor(id,'FROST'),'impact');
  assert.ok(atlas.frames[bossEffectFrame(id,floor,0)]);assert.ok(atlas.frames[bossEffectFrame(id,'impact',0)]);
 }
 const colors=[],resolves=[];let g;g=new Proxy({},{get:(_t,key)=>(...args)=>{if(key==='lineStyle')colors.push(args[1]);return g;}});
 const h=new EncounterHazards({add:{graphics:()=>g}},(...args)=>resolves.push(args));
 for(const id of ['twilight_king','frost_queen','twilight_king']){
  h.clear();colors.length=0;h.add('FROST',360,650,10,1,{bossId:id,warningMs:1000,durationMs:2200});h.update(1000);
  assert.ok(colors.includes(id==='twilight_king'?BOSS_VISUALS.twilight_king.accent:0x9bddff));
  assert.equal(colors.includes(id==='twilight_king'?0x9bddff:BOSS_VISUALS.twilight_king.accent),false);
  assert.deepEqual(resolves.at(-1),['FROST',360,650,90,10,1]);
 }
});

test('visual observers share warning/impact timing and cannot prevent damage when rendering fails',()=>{
 const damage=[],visuals=[];
 const h=new EncounterHazards(scene(),(...args)=>damage.push(args),{
  start(_i,s){visuals.push(['start',s.age,s.bossId]);},draw(_i,s,impact){visuals.push(['draw',s.age,impact]);if(impact)throw Error('GPU resource unavailable');},
  end(){},clear(){visuals.push(['clear']);}
 });
 h.add('METEOR',360,650,35,17,{bossId:'lava_colossus',warningMs:1100,radius:70,durationMs:250});
 h.update(1099);assert.equal(damage.length,0);assert.deepEqual(visuals.at(-1),['draw',1099,false]);
 h.update(1);assert.equal(damage.length,1);assert.deepEqual(damage[0],['METEOR',360,650,70,35,17]);
 h.update(1);assert.equal(damage.length,1);assert.equal(h.visualFailed,true);
});

test('successful encounter cleanup restores visuals after a rendering failure without interrupting damage or audio',()=>{
 let fail=true,starts=0,impacts=0,hits=0,audioImpacts=0;
 const h=new EncounterHazards(scene(),()=>{hits++;},{
  start(){starts++;},draw(_i,_s,impact){if(impact){if(fail)throw Error('temporary GPU failure');impacts++;}},end(){},clear(){}
 },{start(){},draw(_i,_s,impact){if(impact)audioImpacts++;},end(){},clear(){}});
 const add=()=>h.add('METEOR',360,650,10,7,{bossId:'lava_colossus',warningMs:1100});
 add();h.update(1100);assert.equal(hits,1);assert.equal(audioImpacts,1);assert.equal(impacts,0);
 fail=false;h.update(1);assert.equal(hits,1);
 h.clear();add();h.update(1099);assert.equal(hits,1);h.update(1);
 assert.equal(starts,2);assert.equal(impacts,1);assert.equal(hits,2);assert.equal(audioImpacts,2);
});

test('failed visual cleanup remains isolated until a later cleanup succeeds',()=>{
 let failCleanup=true,starts=0,hits=0;
 const h=new EncounterHazards(scene(),()=>{hits++;},{start(){starts++;},draw(){},end(){},
  clear(){if(failCleanup)throw Error('context unavailable');}});
 const add=()=>h.add('METEOR',360,650,10,7,{bossId:'lava_colossus',warningMs:1100});
 h.clear();add();h.update(1100);assert.equal(starts,0);assert.equal(hits,1);
 failCleanup=false;h.clear();add();h.update(1100);assert.equal(starts,1);assert.equal(hits,2);
});

test('hazard visual identity resets on reuse and persistent duration stays in the combat owner',()=>{
 const views=[],damage=[];
 const h=new EncounterHazards(scene(),(...args)=>damage.push(args),{start(i,s){views.push([i,s.bossId]);},draw(){},end(){},clear(){}});
 h.add('POISON',300,600,10,5,{bossId:'swamp_lord',warningMs:1000,durationMs:2400});
 h.update(1000);assert.equal(damage.length,1);h.update(2399);assert.equal(h.slots[0].active,true);
 h.update(1);assert.equal(h.slots[0].active,false);
 h.add('SHOT',300,600,10,6);assert.deepEqual(views,[ [0,'swamp_lord'],[0,null] ]);
 h.clear();h.update(10000);assert.equal(h.slots.some(s=>s.active),false);
});

test('every existing boss pattern has prepared art without changing its attack plan',()=>{
 const origin={x:360,y:300,speed:105},target={x:360,y:650};
 const atlas=JSON.parse(readFileSync('src/assets/bosses-v1/atlas.json','utf8'));
 for(const id of BOSS_IDS){
  for(const pose of ['idle','cast','charge']){assert.equal(bossPoseFrame(id,pose),id+'_'+pose);assert.equal(atlas.frames[bossPoseFrame(id,pose)].frame.w,192);}
  for(const [kind,count]of Object.entries(BOSS_VISUALS[id].effects))for(let i=0;i<count;i++)assert.equal(atlas.frames[bossEffectFrame(id,kind,i)].frame.w,96);
  for(let i=0;i<5;i++){
   const plan=planBossAttack(id,1,i,origin,target),snapshot=JSON.stringify(plan);
   for(const attack of plan.attacks){const kind=bossEffectFor(id,attack.kind);assert.ok(BOSS_VISUALS[id].effects[kind]>0,id+'/'+kind);
    assert.equal(bossEffectFrame(id,kind,0),id+'_'+kind+'_0');}
   assert.equal(JSON.stringify(plan),snapshot);
  }
 }
});

test('boss image allocation failure preserves the original physical actor and profile fallback',()=>{
 const f=fixture([]),boss=new Enemy(f.scene,360,300);boss.spawn('BOSS_CORE',360,300);
 const radius=boss.body.radius;f.scene.textures={exists:()=>true};f.scene.add.image=()=>{throw Error('Image unavailable');};
 assert.doesNotThrow(()=>boss.applyBossProfile('lava_colossus'));
 assert.equal(boss.active,true);assert.equal(boss.alpha,1);assert.equal(boss.bossId,'lava_colossus');assert.equal(boss.body.radius,radius);
 boss.windUpCharge(1000);boss.update(100,0);assert.equal(boss.body.velocity.x,0);
});
