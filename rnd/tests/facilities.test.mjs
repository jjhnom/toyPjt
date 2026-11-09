import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';
const {SquadRoster}=load('src/systems/SquadRoster.ts');
const {awakeningConsent,awakeningCost}=load('src/config/expeditionFacilities.ts');
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {getStageDefinition}=load('src/config/stageData.ts');
const {seededRandom}=load('src/systems/EconomySimulation.ts');
const {sideSupplyCandidate}=load('src/systems/SideSupply.ts');
const {isRunCheckpoint,RunSaveManager}=load('src/systems/RunSaveManager.ts');
const {upgradedUnitMaxHp}=load('src/systems/UpgradeEffects.ts');
const {CombatMeasurements}=load('src/systems/CombatMeasurements.ts');
const {UNIT_TYPES}=load('src/config/unitData.ts');

test('awakening validates star, tier price, stale quotes, balance and ten-level cap atomically',()=>{
 const r=new SquadRoster(100000),id=r.units[0].id;
 assert.equal(r.awakeningQuote(id),null);r.units[0].star=3;
 for(let level=0;level<10;level++){
  const quote=r.awakeningQuote(id),cost=Math.ceil(80*1.35**level),before=r.minerals;
  assert.equal(quote.cost,cost);assert.equal(r.awaken({...quote,cost:cost-1}),false);
  assert.equal(r.awaken(quote),true);assert.equal(r.minerals,before-cost);assert.equal(r.units[0].awakening,level+1);
  const snapshot=r.snapshot(),events=r.economy.report().eventsRecorded;
  assert.equal(r.awaken(quote),false);assert.deepEqual(r.snapshot(),snapshot);assert.equal(r.economy.report().eventsRecorded,events);
 }
 assert.equal(r.awakeningQuote(id),null);
 const broke=new SquadRoster(79);broke.units[0].star=3;
 const before=broke.snapshot();assert.equal(broke.awaken(broke.awakeningQuote(broke.units[0].id)),false);assert.deepEqual(broke.snapshot(),before);
 assert.equal(awakeningCost({...r.units[0],awakening:0,tier:4}),320);
});

test('awakening preserves wounds, death, cooldown, shield and instance IDs through repeated sync and hydration',()=>{
 const f=fixture(['BASIC_LASER','EARTH_DEITY']),s=f.squad;
 s.roster.minerals=5000;s.roster.units[0].star=3;
 // Recreate the projection after making the controlled fixture a legitimate star-three instance.
 s.drones.forEach(d=>d.destroy());s.drones=[];s.syncRoster();
 const unit=s.drones[0],id=unit.id;unit.health.currentHp=13;unit.health.applyShield(25,9000);unit.lastSkillAt=77;
 const beforeMax=unit.health.maxHp;
 assert.equal(s.roster.awaken(s.roster.awakeningQuote(id)),true);s.syncRoster();
 assert.equal(unit.health.maxHp,Math.round(beforeMax*1.05));assert.equal(unit.health.currentHp,13);
 assert.equal(unit.health.shieldHp,25);assert.equal(unit.lastSkillAt,77);assert.equal(unit.id,id);
 for(let i=0;i<4;i++)s.syncRoster();assert.equal(unit.health.maxHp,Math.round(beforeMax*1.05));
 unit.health.takeDamage(10000,200);const reviveAt=unit.reviveAt;
 s.roster.awaken(s.roster.awakeningQuote(id));s.syncRoster();assert.equal(unit.health.currentHp,0);assert.equal(unit.reviveAt,reviveAt);
 const snapshot=s.roster.snapshot();snapshot.units[0].awakening=9;assert.equal(s.roster.units[0].awakening,2);
 const copy=new SquadRoster();copy.restore(s.roster.snapshot(),0);assert.equal(copy.units[0].awakening,2);
});

test('awakening multiplies only basic attacks and own HP, without affecting hero shots or support healing',()=>{
 const f=fixture(['BASIC_LASER']),s=f.squad,unit=s.drones[0];unit.star=3;unit.awakening=2;
 f.enemies.getChildren=()=>[{active:true,x:400,y:650,lifeId:1}];
 f.update(2000);assert.equal(f.shots[0].damage,Math.round(unit.spec.damage*2*1.1));assert.equal(f.heroShots[0].damage,8);
 assert.equal(upgradedUnitMaxHp('BASIC_LASER',3,1.2,10),Math.round(UNIT_TYPES.BASIC_LASER.maxHp*2*1.2*1.5));
 const supports=[fixture(['HERBAL_PRIEST']),fixture(['HERBAL_PRIEST'])];
 supports.forEach((f,i)=>{f.squad.drones[0].star=3;f.squad.drones[0].awakening=i*10;f.squad.health.currentHp=20;f.update(3000);});
 assert.equal(supports[0].squad.health.currentHp,29);assert.equal(supports[1].squad.health.currentHp,29);
});

test('destructive transactions require exact current awakening consent and keep ordinary material preference',()=>{
 const r=new SquadRoster(1000);r.units[0].star=3;r.units[0].awakening=1;
 const id=r.units[0].id,before=r.snapshot(),consent=awakeningConsent([r.units[0]]);
 assert.equal(r.sell(id),false);assert.equal(r.combine('gatling'),false);assert.deepEqual(r.snapshot(),before);
 r.units[0].awakening=2;assert.equal(r.sell(id,consent),false);
 const selected=r.ingredientsFor('gatling'),current=awakeningConsent(selected),oldIds=selected.map(u=>u.id);
 assert.equal(r.combine('gatling',oldIds,current),true);assert.equal(r.units.length,1);
 assert.ok(!oldIds.includes(r.units[0].id));assert.equal(r.units[0].awakening,undefined);
 const other=new SquadRoster(1000);other.units[0].star=3;other.units[0].awakening=2;other.summon('BASIC_LASER');
 assert.ok(other.ingredientsFor('gatling').every(u=>!u.awakening));
 const sale=awakeningConsent([other.units[0]]),money=other.minerals;
 assert.equal(other.sell(other.units[0].id,sale),true);assert.equal(other.minerals-money,30,'awakening is not refunded');
});

test('services reject useless, stale, unauthorized and unaffordable purchases with no partial effects',()=>{
 const f=fixture(['BASIC_LASER','HERBAL_PRIEST']),s=f.squad;s.roster.minerals=100;
 assert.equal(s.serviceQuote('HEAL'),null);assert.equal(s.serviceQuote('REVIVE'),null);
 s.health.currentHp=23;s.drones[0].health.currentHp=5;s.drones[1].health.takeDamage(10000,0);
 const quote=s.serviceQuote('HEAL'),dead=s.drones[1],timer=dead.reviveAt;
 assert.equal(s.buyService(quote,false),false);assert.equal(s.roster.minerals,100);
 s.roster.minerals=39;assert.equal(s.buyService(quote,true),false);assert.equal(s.health.currentHp,23);
 s.roster.minerals=100;s.health.currentHp=24;assert.equal(s.buyService(quote,true),false);
 assert.equal(s.buyService(s.serviceQuote('HEAL'),true),true);assert.equal(s.roster.minerals,60);
 assert.equal(s.health.currentHp,s.health.maxHp);assert.equal(s.drones[0].health.currentHp,s.drones[0].health.maxHp);
 assert.equal(dead.health.currentHp,0);assert.equal(dead.reviveAt,timer);
 assert.equal(s.buyService(quote,true),false);assert.equal(s.roster.minerals,60);
});

test('paid revival clears only fallen timers, restores half HP and leaves active/skill cooldowns and survivors unchanged',()=>{
 const f=fixture(['PHOENIX_LORD','EARTH_DEITY']),s=f.squad;s.roster.minerals=100;
 const metrics=new CombatMeasurements();s.setCombatMeasurements(metrics);
 s.health.currentHp=23;s.castCommandHeal(true);const active=s.activeRemaining(),living=s.health.currentHp;
 s.drones.forEach(d=>{d.health.takeDamage(100000,0);d.lastSkillAt=123;});
 const quote=s.serviceQuote('REVIVE');assert.equal(s.buyService(quote,true),true);assert.equal(s.roster.minerals,70);
 for(const d of s.drones){assert.equal(d.health.currentHp,Math.round(d.health.maxHp*0.5));assert.equal(d.reviveAt,0);
  assert.equal(d.active,true);assert.equal(d.lastSkillAt,123);}
 assert.equal(s.health.currentHp,living);assert.equal(s.activeRemaining(),active);assert.equal(metrics.report().revivals.service,2);
 assert.equal(s.buyService(quote,true),false);assert.equal(s.roster.minerals,70);
 s.health.currentHp=0;assert.equal(s.serviceQuote('HEAL'),null);assert.equal(s.serviceQuote('REVIVE'),null);
});

test('side supply marks at most one off-shortest-route combat room with unchanged graph, waves and special counts',()=>{
 let created=0;
 for(const index of[0,1,2,4,5,999])for(let seed=0;seed<30;seed++){
  const stage=getStageDefinition(index),manager=new RoomGridManager(stage,undefined,seededRandom(seed)),rooms=manager.grid.flat().filter(Boolean);
  const marked=rooms.filter(r=>r.sideSupply),expected=sideSupplyCandidate(manager.grid,index);
  assert.equal(marked.length,Number(!!expected));if(expected){created++;assert.equal(marked[0].id,expected.id);assert.equal(expected.type,'COMBAT');
   // Independent all-pairs shortest paths verify the defining detour requirement.
   const distance=rooms.map((a,i)=>rooms.map((b,j)=>i===j?0:Math.abs(a.gridX-b.gridX)+Math.abs(a.gridY-b.gridY)===1?1:Infinity));
   for(let k=0;k<rooms.length;k++)for(let i=0;i<rooms.length;i++)for(let j=0;j<rooms.length;j++)distance[i][j]=Math.min(distance[i][j],distance[i][k]+distance[k][j]);
   const entrance=rooms.indexOf(manager.getCurrentRoom()),boss=rooms.findIndex(r=>r.type==='BOSS'),supply=rooms.indexOf(expected);
   assert.ok(distance[entrance][supply]+distance[supply][boss]>distance[entrance][boss]);
  }
  assert.equal(rooms.length,stage.roomCount);assert.equal(rooms.filter(r=>r.type==='ELITE').length,stage.eliteCount);
  if(index<2)assert.equal(marked.length,0);
  const restored=new RoomGridManager(stage,manager.grid);assert.deepEqual(restored.grid,manager.grid);
 }
 assert.ok(created>60,'supply should be obtainable in many generated maps');
});

test('supply chooses once, retains vouchers at full ownership and rejects wrong stage, unearned or duplicate rewards',()=>{
 const r=new SquadRoster(10000);r.stageIndex=2;
 while(r.units.length<16)r.summon('BASIC_LASER');
 const room={id:'stage_2_room_0_0',type:'COMBAT',sideSupply:true,cleared:false};
 assert.equal(r.claimSupply(room,'VOUCHERS'),false);room.cleared=true;
 const before=r.minerals;assert.equal(r.claimSupply(room,'VOUCHERS'),true);assert.equal(r.freeSummons,2);assert.equal(r.minerals,before);
 assert.equal(r.claimSupply(room,'MINERALS'),false);assert.equal(r.freeSummons,2);
 assert.equal(r.claimSupply({...room,supplyChoice:undefined,id:'stage_1_room_0_0'},'MINERALS'),false);
 assert.equal(r.claimSupply({...room,supplyChoice:undefined},'BAD'),false);
});

function checkpoint(){
 const r=new SquadRoster(10000),grid=new RoomGridManager(getStageDefinition(2),undefined,seededRandom(1));r.units[0].star=3;r.units[0].awakening=4;
 return {version:2,runId:'facilities_fixture',phase:'stage-start',currentRoomId:grid.getCurrentRoom().id,savedAt:0,
  stats:{stageIndex:2,bossesDefeated:2,roomsCleared:2,enemiesDefeated:0,mineralsCollected:r.minerals,bossDefeated:false,damageMultiplier:1,attackSpeedMultiplier:1,moveSpeedBonus:0},
  roster:r.snapshot(),leaderHealth:{currentHp:23,maxHp:100},unitHealth:r.units.map(u=>({id:u.id,currentHp:upgradedUnitMaxHp(u.archetype,u.star,1,u.awakening),
   reviveRemainingMs:0,healRemainingMs:0,skillRemainingMs:0})),grid:grid.grid};
}
test('checkpoints validate awakening HP and supply identity/timing, preserve the last good save and read legacy defaults',()=>{
 const data=checkpoint(),values=new Map(),manager=new RunSaveManager({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});
 assert.equal(manager.save(data),true);
 const supply=data.grid.flat().find(r=>r?.sideSupply);assert.ok(supply);
 for(const change of[d=>d.roster.units[0].awakening=11,d=>d.roster.units[0].awakening=-1,d=>d.roster.units[0].star=2,
  d=>d.roster.units[0].awakening=null,d=>d.unitHealth[0].currentHp++,d=>d.grid.flat().find(r=>r?.sideSupply).supplyChoice='VOUCHERS',
  d=>d.grid.flat().find(r=>r?.type==='BOSS').sideSupply=true]){
   const bad=structuredClone(data);change(bad);assert.equal(manager.save(bad),false,change.toString());assert.deepEqual(manager.load().checkpoint,data);
 }
 const old=structuredClone(data);delete old.roster.units[0].awakening;old.unitHealth[0].currentHp=30;
 for(const room of old.grid.flat())if(room)delete room.sideSupply;
 assert.equal(isRunCheckpoint(old),true);assert.equal(manager.save(old),true);assert.deepEqual(manager.load().checkpoint,old);
});
