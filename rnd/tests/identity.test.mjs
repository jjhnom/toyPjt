import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,load} from './helpers/skill-fixture.mjs';
const {resolveSynergies}=load('src/config/synergyData.ts');
const {emptyUpgrades}=load('src/config/upgradeData.ts');
const {resolveUpgradeEffects,upgradedAttackSpeed}=load('src/systems/UpgradeEffects.ts');
const {BOSS_IDS,BOSS_PROFILES,planBossAttack}=load('src/config/bossData.ts');
const {ARENA_BOUNDS}=load('src/config/gameData.ts');
const {CodexManager,CODEX_KEY}=load('src/systems/CodexManager.ts');
const {Enemy}=load('src/entities/Enemy.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');

test('formation counts unique deployed types, ignores stars and reserves, and remains active for fallen units',()=>{
 const f=fixture(['BASIC_LASER','BASIC_LASER']);assert.equal(resolveSynergies(f.squad.roster.units).attack,0);
 f.squad.roster.units.push({id:'reserve',archetype:'GATLING_BOT',star:3,deployed:false,tier:2});
 assert.equal(resolveSynergies(f.squad.roster.units).speed,0);f.squad.roster.units[2].deployed=true;
 const synergy=resolveSynergies(f.squad.roster.units);assert.equal(synergy.attack,0.05);assert.equal(synergy.speed,0.05);
 f.squad.drones[0].health.currentHp=0;assert.deepEqual(resolveSynergies(f.squad.roster.units),synergy);
 f.squad.roster.units[2].deployed=false;assert.equal(resolveSynergies(f.squad.roster.units).attack,0);
});
test('synergies share additive sources, cap speed/defense and never accumulate across synchronization',()=>{
 const f=fixture(['BASIC_LASER','GATLING_BOT','THORN_GUARD','STONE_GUARD']),s=f.squad;
 s.roster.upgrades.squadAttack=2;s.roster.upgrades.squadSpeed=10;s.roster.upgrades.defense=10;s.syncRoster();
 const result=resolveUpgradeEffects(s.roster.upgrades,['COMMAND_BANNER'],['COMMAND'],resolveSynergies(s.roster.units));
 assert.ok(Math.abs(result.squadAttack-1.28)<1e-12);assert.equal(result.damageReduction,0.5);
 assert.equal(upgradedAttackSpeed(9,result.squadSpeed),2.5);assert.equal(result.heroAttack,0);
 const health=s.health.currentHp;for(let i=0;i<8;i++)s.syncRoster();assert.equal(s.health.currentHp,health);assert.equal(s.health.damageReduction,0.5);
 s.roster.upgrades.defense=0;s.syncRoster();assert.equal(s.health.damageReduction,0.05);
 s.health.takeDamage(20,1000);assert.equal(s.health.currentHp,health-19);
 const data=s.roster.snapshot(),copy=fixture([]);copy.squad.roster.restore(data,0);copy.squad.syncRoster();
 assert.equal(copy.squad.health.damageReduction,0.05);
});
test('real squad weapon receives forest damage and ranged cadence while hero attack remains independent',()=>{
 const f=fixture(['BASIC_LASER','GATLING_BOT']),unit=f.squad.drones[0];
 f.enemies.getChildren=()=>[{active:true,x:400,y:650,lifeId:1}];f.update(1000);
 assert.equal(f.shots.find(s=>s.sourceUnitId===unit.id).damage,Math.round(unit.spec.damage*1.05));assert.equal(f.heroShots[0].damage,8);
 const first=f.shots.filter(s=>s.sourceUnitId===unit.id).length,interval=unit.spec.fireRateMs/1.05;
 f.update(1000+interval-1);assert.equal(f.shots.filter(s=>s.sourceUnitId===unit.id).length,first);
 f.update(1000+interval+0.001);assert.equal(f.shots.filter(s=>s.sourceUnitId===unit.id).length,first+1);
});
test('five boss plans have distinct formations, bounded targets, frozen coordinates and finite phase cadence',()=>{
 const boss={x:360,y:300,speed:105},target={x:360,y:630},counts=[];
 for(const id of BOSS_IDS){
  const profile=BOSS_PROFILES[id],first=planBossAttack(id,1,0,boss,target);counts.push(first.attacks.length);
  assert.ok(first.attacks.every(a=>a.warningMs>=1000));
  for(let phase=1;phase<=3;phase++)for(let sequence=0;sequence<profile.patterns.length;sequence++){
   const plan=planBossAttack(id,phase,sequence,boss,{x:0,y:9999});assert.ok(plan.attacks.length<=4&&plan.intervalMs>=2000);
   for(const a of plan.attacks){assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.ok(a.x>=ARENA_BOUNDS.left&&a.x<=ARENA_BOUNDS.right);
    assert.ok(a.y>=ARENA_BOUNDS.top&&a.y<=ARENA_BOUNDS.bottom);}
  }
  target.x=10;assert.notEqual(first.attacks[0].x,10);target.x=360;
 }
 assert.deepEqual(counts,[1,2,3,4,4]);assert.equal(new Set(BOSS_IDS.map(id=>BOSS_PROFILES[id].color)).size,5);
 const cross=planBossAttack('twilight_king',1,0,boss,target);
 assert.ok(cross.attacks.every(a=>Math.hypot(a.x-target.x,a.y-target.y)>a.radius));
 for(const x of[ARENA_BOUNDS.left+24,ARENA_BOUNDS.right-24])for(const y of[ARENA_BOUNDS.top+24,ARENA_BOUNDS.bottom-24]){
  const edge=planBossAttack('twilight_king',1,0,boss,{x,y});assert.ok(edge.attacks.length>=2);
  assert.ok(edge.attacks.every(a=>Math.hypot(a.x-x,a.y-y)>a.radius),'corner-safe cross must not collapse onto its center');
 }
});
test('custom warning duration and origins survive no active time and reset on pooled hazard reuse',()=>{
 let graphics;graphics=new Proxy({},{get:()=>()=>graphics});const events=[];
 const hazards=new EncounterHazards({add:{graphics:()=>graphics}},(...event)=>events.push(event));
 hazards.add('CHARGE',360,600,20,1,{warningMs:1000,fromX:360,fromY:300});hazards.update(999);assert.equal(events.length,0);
 hazards.update(0);assert.equal(events.length,0);hazards.update(1);assert.equal(events.length,1);
 hazards.add('SHOT',300,500,10,2);hazards.update(799);assert.equal(events.length,1);hazards.update(1);assert.equal(events.length,2);
 hazards.clear();hazards.update(9000);assert.equal(events.length,2);
});
test('pooled bosses restore identity after hit flash, freeze charge by active delta and clear identity on reuse',()=>{
 const f=fixture([]),enemy=new Enemy(f.scene,360,300);enemy.spawn('BOSS_CORE',360,300);enemy.applyBossProfile('forest_guardian');
 enemy.receiveDamage(1,0);enemy.update(100,0);assert.equal(enemy.tint,BOSS_PROFILES.forest_guardian.color);
 enemy.windUpCharge(1000);enemy.setTargetPosition(400,300);enemy.update(999999,0);assert.equal(enemy.body.velocity.x,0);
 enemy.beginCharge(500,300,999999);enemy.update(9999999,0);assert.ok(enemy.body.velocity.x>0);assert.equal(enemy.bossChargeMs,600);
 enemy.update(9999999,600);assert.equal(enemy.bossChargeMs,0);enemy.deactivate();enemy.spawn('SWARMER',200,300);
 assert.equal(enemy.bossId,null);assert.equal(enemy.chargeWindupMs,0);assert.equal(enemy.tint,undefined);
});
class Storage {values=new Map();writes=0;getItem(k){return this.values.get(k)??null;}setItem(k,v){this.writes++;this.values.set(k,v);}}
test('codex discoveries are bounded, monotone, copied and persist independently of run data without duplicate writes',()=>{
 const storage=new Storage(),c=new CodexManager(storage);assert.equal(c.recordUnits(['BASIC_LASER','BASIC_LASER']),true);
 assert.equal(c.recordBoss('forest_guardian'),true);const writes=storage.writes;
 assert.equal(c.recordUnits(['BASIC_LASER']),true);assert.equal(c.recordBoss('forest_guardian'),true);assert.equal(storage.writes,writes);
 const view=c.snapshot();view.units.length=0;assert.equal(c.snapshot().units.length,1);
 storage.values.set('smash.run-checkpoint.v1','run');storage.values.delete('smash.run-checkpoint.v1');
 assert.deepEqual(new CodexManager(storage).snapshot().bosses,['forest_guardian']);
 assert.equal(c.recordBoss('__proto__'),false);assert.equal(c.recordUnits(['BASIC_LASER','BAD']),false);
 assert.equal(c.snapshot().units.length,1);
});
test('codex writes retry without losing observations; malformed and unreadable originals are never overwritten',()=>{
 const s=new Storage(),c=new CodexManager(s),set=s.setItem.bind(s);s.setItem=()=>{throw new Error('quota');};
 assert.equal(c.recordUnits(['GATLING_BOT']),false);assert.equal(c.snapshot().pending,true);assert.deepEqual(c.snapshot().units,['GATLING_BOT']);
 s.setItem=set;assert.equal(c.flush(),true);assert.equal(c.snapshot().pending,false);
 for(const raw of['{bad',JSON.stringify({version:2,units:[],bosses:[]}),JSON.stringify({version:1,units:['BASIC_LASER','BASIC_LASER'],bosses:[]}),
  JSON.stringify({version:1,units:['__proto__'],bosses:[]}),JSON.stringify({version:1,units:[],bosses:['BAD']})]){
  const storage=new Storage();storage.values.set(CODEX_KEY,raw);const c=new CodexManager(storage);
  assert.equal(c.recordUnits(['BASIC_LASER']),false);assert.equal(c.snapshot().status,'invalid');assert.equal(storage.values.get(CODEX_KEY),raw);assert.equal(storage.writes,0);
 }
 const unreadable=new Storage();unreadable.getItem=()=>{throw new Error('denied');};
 assert.equal(new CodexManager(unreadable).recordUnits(['BASIC_LASER']),false);assert.equal(unreadable.writes,0);
 assert.equal(new CodexManager(null).recordBoss('forest_guardian'),false);
});
test('stale codex instances merge later discoveries and refuse a new corrupt or unsupported record before writing',()=>{
 const s=new Storage(),first=new CodexManager(s),stale=new CodexManager(s);first.snapshot();stale.snapshot();
 first.recordUnits(['BASIC_LASER']);stale.recordUnits(['GATLING_BOT']);first.recordBoss('forest_guardian');
 const merged=new CodexManager(s).snapshot();assert.deepEqual(merged.units,['BASIC_LASER','GATLING_BOT']);assert.equal(merged.bosses.length,1);
 const raw=JSON.stringify({version:2,units:[],bosses:[]});s.values.set(CODEX_KEY,raw);
 assert.equal(first.recordUnits(['STONE_GUARD']),false);assert.equal(s.values.get(CODEX_KEY),raw);
});
