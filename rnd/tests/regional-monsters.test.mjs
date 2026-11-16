import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,load} from './helpers/skill-fixture.mjs';
const {REGIONAL_MONSTERS,REGIONAL_POOLS,regionalMonster}=load('src/config/monsterData.ts');
const {STAGES,getStageDefinition}=load('src/config/stageData.ts');
const {Enemy}=load('src/entities/Enemy.ts');
test('six regions have eighteen distinct named melee, ranged and caster monsters and bounded mixed pools',()=>{
 assert.equal(REGIONAL_MONSTERS.length,18);assert.equal(new Set(REGIONAL_MONSTERS.map(m=>m.id)).size,18);
 for(const [region,pool]of Object.entries(REGIONAL_POOLS)){
  assert.deepEqual(REGIONAL_MONSTERS.filter(m=>m.region===region).map(m=>m.role),['melee','ranged','caster']);
  assert.ok(pool.includes('SPORE_SHOOTER')&&pool.includes('SUMMONER'));assert.equal(regionalMonster(region,'BOSS_CORE'),undefined);assert.equal(regionalMonster(region,'ELITE_BRUTE'),undefined);
 }
 for(let i=0;i<11;i++){const s=getStageDefinition(i);assert.deepEqual(s.enemyPoolIds,REGIONAL_POOLS[s.bossId]);}
 assert.equal(STAGES[4].bossId,'twilight_king');assert.equal(getStageDefinition(5).bossId,'desert_emperor');
});
test('regional profiles preserve health, speed, collision and economy and reset on pooled reuse',()=>{
 const f=fixture([]);f.scene.textures={exists:()=>false};const e=new Enemy(f.scene,360,500);e.spawn('SPORE_SHOOTER',360,500,2);
 const before={hp:e.health.maxHp,speed:e.spec.speed,damage:e.spec.contactDamage,radius:e.body.radius,reward:e.spec.mineralValue};
 e.applyRegionalMonster(regionalMonster('swamp_lord','SPORE_SHOOTER'));
 assert.deepEqual({hp:e.health.maxHp,speed:e.spec.speed,damage:e.spec.contactDamage,radius:e.body.radius,reward:e.spec.mineralValue},before);assert.equal(e.spec.name,'포자 분사수');
 e.spawn('SWARMER',400,500);assert.equal(e.monster,null);assert.equal(e.onSpecial,undefined);
 e.spawn('BOSS_CORE',400,500);e.applyRegionalMonster(REGIONAL_MONSTERS[0]);assert.equal(e.monster,null);
});
test('first forest wave introduces one ranged enemy before adding a caster in a later wave',()=>{
 const {waveEnemyTypes}=load('src/systems/EncounterRules.ts'),room={type:'COMBAT'};
 const first=waveEnemyTypes(STAGES[0],room,1,2),later=waveEnemyTypes(STAGES[0],room,2,2);
 assert.equal(first.length,7);assert.equal(first.filter(t=>t==='SPORE_SHOOTER').length,1);assert.equal(first.includes('SUMMONER'),false);
 assert.equal(later.includes('SUMMONER'),true);
});
test('each regional caster uses its configured spell and cooldown, with no legacy summoning outside range',()=>{
 for(const monster of REGIONAL_MONSTERS.filter(m=>m.role==='caster')){
  const f=fixture([]);f.scene.textures={exists:()=>false};const e=new Enemy(f.scene,360,500),events=[];e.spawn('SUMMONER',360,500);e.applyRegionalMonster(monster);e.onSpecial=(_e,k)=>events.push(k);
  e.setTargetPosition(360,1100);e.update(1700,16);assert.deepEqual(events,[]);
  e.setTargetPosition(360,800);e.update(1800,16);assert.deepEqual(events,[monster.skill.kind]);e.update(1801,16);assert.equal(events.length,1);
  e.update(1800+monster.skill.cooldownMs,16);assert.equal(events.length,2);
 }
});
test('all regional sprite frames are transparent, unclipped 52px cells matching the existing physical sprite contract',()=>{
 const base='src/assets/monsters-v1/',a=JSON.parse(readFileSync(base+'atlas.json','utf8')),r=JSON.parse(readFileSync(base+'frame-review.json','utf8'));
 assert.equal(Object.keys(a.frames).length,72);assert.equal(r.length,72);for(const m of REGIONAL_MONSTERS)for(let i=0;i<4;i++){const f=a.frames[m.id+'_'+i].frame;assert.equal(f.w,52);assert.equal(f.h,52);assert.ok(f.x+52<=a.meta.size.w&&f.y+52<=a.meta.size.h);}
 for(const row of r){assert.equal(row.edge,0);assert.ok(row.opaque>80&&row.transparent>1000);}
});
