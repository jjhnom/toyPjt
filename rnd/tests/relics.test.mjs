import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const {SquadRoster,quickCraftPlans}=load('src/systems/SquadRoster.ts');
const {RELIC_IDS,discountedCombinationCost}=load('src/config/relicData.ts');
const {resolveUpgradeEffects}=load('src/systems/UpgradeEffects.ts');
const {emptyUpgrades}=load('src/config/upgradeData.ts');
const {CombatMeasurements}=load('src/systems/CombatMeasurements.ts');
const {RunSaveManager,isRunCheckpoint}=load('src/systems/RunSaveManager.ts');
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {STAGES}=load('src/config/stageData.ts');
const room=(stage=0,x=0,y=0)=>({id:`stage_${stage}_room_${x}_${y}`,type:'ELITE',cleared:true});
function give(roster,id,stage=0) {
  roster.stageIndex=stage;assert.equal(roster.offerRelic(room(stage)),true);
  assert.equal(roster.claimRelic(room(stage).id,id),true);
}

test('only cleared elites offer rewards; sources, FIFO choices, IDs and three slots enforce atomic transactions',()=>{
  const roster=new SquadRoster(100);
  for(const bad of [{...room(),type:'COMBAT'},{...room(),cleared:false},room(1),{...room(),id:'invalid'},room(0,1,1)]) {
    const before=roster.snapshot();assert.equal(roster.offerRelic(bad),false);assert.deepEqual(roster.snapshot(),before);
  }
  assert.equal(roster.offerRelic(room()),true);
  assert.equal(roster.offerRelic(room()),false);
  roster.stageIndex=1;assert.equal(roster.offerRelic(room(1)),true);
  const pending=roster.pendingRelicReward();pending.relicId='COMMAND_BANNER';
  assert.equal(roster.pendingRelicReward().relicId,null,'a UI quote cannot mutate the ledger');
  for(const [source,id] of [[room(1).id,'COMMAND_BANNER'],[room().id,'toString'],['unknown','COMMAND_BANNER']]) {
    const before={data:roster.snapshot(),log:roster.economy.report()};
    assert.equal(roster.claimRelic(source,id),false);assert.deepEqual({data:roster.snapshot(),log:roster.economy.report()},before);
  }
  const currency=roster.minerals,units=structuredClone(roster.units);
  assert.equal(roster.claimRelic(room().id,'COMMAND_BANNER'),true);
  for(const [source,id] of [[room().id,'ARTISAN_SEAL'],[room(1).id,'COMMAND_BANNER']]) {
    const before=roster.snapshot();assert.equal(roster.claimRelic(source,id),false);assert.deepEqual(roster.snapshot(),before);
  }
  assert.equal(roster.claimRelic(room(1).id,'SEED_CHALICE'),true);
  roster.stageIndex=2;assert.equal(roster.offerRelic(room(2)),true);
  assert.equal(roster.claimRelic(room(2).id,'ARTISAN_SEAL'),true);
  roster.stageIndex=3;assert.equal(roster.offerRelic(room(3)),false);
  assert.equal(roster.minerals,currency);assert.deepEqual(roster.units,units);
  assert.equal(roster.economy.report().entries.filter(e=>e.reason==='relic').length,3);
  assert.deepEqual(roster.relicIds(),RELIC_IDS);
});

test('banner adds to the upgrade group once, including star/aura/legacy damage, and leaves hero stats intact',()=>{
  const f=fixture(['BASIC_LASER','WORLD_DRUID']);give(f.squad.roster,'COMMAND_BANNER');
  f.squad.roster.upgrades.squadAttack=2;f.squad.roster.upgrades.heroAttack=1;
  f.squad.drones[0].star=2;f.squad.roster.units[0].star=2;f.squad.syncRoster();
  const hp=f.squad.health.maxHp;f.enemies.getChildren=()=>[{active:true,x:400,y:650,lifeId:1}];
  for(let i=0;i<5;i++) f.squad.syncRoster();
  f.squad.update(1000,0,0,0,f.enemies,1.5,1,0,true);
  assert.equal(f.shots.find(s=>s.sourceUnitId==='skill_0').damage,58); // banner/upgrade/forest synergy share the additive attack group
  assert.equal(f.heroShots[0].damage,9);assert.equal(f.squad.health.maxHp,hp);
  assert.equal(resolveUpgradeEffects(emptyUpgrades(),['COMMAND_BANNER','COMMAND_BANNER']).squadAttack,1.1);
  const lava=fixture(['LAVA_GOLEM']);give(lava.squad.roster,'COMMAND_BANNER');lava.squad.roster.upgrades.squadAttack=2;lava.squad.syncRoster();
  const target={active:true,x:400,y:650,burn:{apply:damage=>{target.damage=damage;}}};lava.enemies.getChildren=()=>[target];
  lava.squad.update(1000,0,0,0,lava.enemies,2,1,0,true);assert.equal(target.damage,14);
});

test('chalice heals only after five active combat seconds, skips fallen allies and accounts for actual healing',()=>{
  const f=fixture(['BASIC_LASER','BASIC_LASER']);give(f.squad.roster,'SEED_CHALICE');f.squad.syncRoster();
  f.squad.health.currentHp=99;f.squad.drones[0].health.currentHp=69;
  f.squad.drones[1].health.takeDamage(10000);f.squad.drones[1].reviveAt=1000000;
  const measurements=new CombatMeasurements();f.squad.setCombatMeasurements(measurements);
  const update=(delta,active=true)=>f.squad.update(1000,delta,0,0,f.enemies,1,1,0,active);
  update(10000,false);assert.equal(f.squad.relicHealingRemaining(),5000);assert.equal(f.squad.health.currentHp,99);
  update(4999);assert.equal(f.squad.health.currentHp,99);assert.equal(f.squad.relicHealingRemaining(),1);
  f.squad.syncRoster();assert.equal(f.squad.relicHealingRemaining(),1);
  update(1);assert.equal(f.squad.health.currentHp,100);assert.equal(f.squad.drones[0].health.currentHp,70);
  assert.equal(f.squad.drones[1].health.currentHp,0);assert.equal(f.squad.drones[1].reviveAt,1000000);
  const rows=measurements.report().healing;assert.ok(rows.every(r=>r.source==='SEED_CHALICE'));
  assert.deepEqual(rows.map(r=>[r.target,r.effective,r.overheal,r.skippedDead]),[['leader',1,1,0],['unit',1,1,1]]);
  f.squad.health.currentHp=20;update(100000);assert.equal(f.squad.health.currentHp,22,'stalled frame is limited to one tick');
});

test('chalice remaining time restores without replaying healing and remains frozen for noncombat or clock jumps',()=>{
  const f=fixture([]);give(f.squad.roster,'SEED_CHALICE');f.squad.syncRoster();f.squad.health.currentHp=20;
  f.squad.update(1000,1200,0,0,f.enemies,1,1,0,true);assert.equal(f.squad.relicHealingRemaining(),3800);
  const other=fixture([]);other.squad.roster.restore(f.squad.roster.snapshot(),0);other.squad.syncRoster();
  other.squad.health.currentHp=20;other.squad.restoreRelicHealing(3800);
  other.squad.update(999999,0,0,0,other.enemies,1,1,0,true);assert.equal(other.squad.health.currentHp,20);
  other.squad.update(999999,10000,0,0,other.enemies,1,1,0,false);assert.equal(other.squad.relicHealingRemaining(),3800);
  other.squad.update(999999,3799,0,0,other.enemies,1,1,0,true);assert.equal(other.squad.health.currentHp,20);
  other.squad.update(999999,1,0,0,other.enemies,1,1,0,true);assert.equal(other.squad.health.currentHp,22);
});

test('artisan fee rounding and cap apply to normal recipes and promotion without discounting summons or upgrades',()=>{
  assert.deepEqual([0,10,25,50].map(cost=>discountedCombinationCost(cost,0.1)),[0,9,23,45]);
  assert.equal(discountedCombinationCost(10,1),6);
  const roster=new SquadRoster(100);give(roster,'ARTISAN_SEAL');
  assert.equal(roster.combinationCost('lava'),9);assert.equal(roster.combinationCost('paladin'),23);
  assert.equal(roster.upgradeQuote('heroHealth').cost,30);
  assert.equal(roster.summon('BASIC_LASER'),true);assert.equal(roster.minerals,85);
  const quote=roster.snapshot();assert.equal(roster.combine('promote_BASIC_LASER_1'),true);
  assert.equal(roster.minerals,76);assert.equal(roster.units[0].star,2);
  assert.equal(roster.economy.report().entries.at(-1).minerals,-9);
  roster.minerals=0;const before=roster.snapshot();assert.equal(roster.combine('lava'),false);assert.deepEqual(roster.snapshot(),before);
  assert.equal(quote.relicRewards[0].relicId,'ARTISAN_SEAL');
});

test('all discounted quick plans reproduce real summon and intermediate recipe spending across five stages',()=>{
  for(let stage=0;stage<5;stage++) for(const [id,plan] of quickCraftPlans(stage,0.1)) {
    const manual=new SquadRoster(plan.totalCost);give(manual,'ARTISAN_SEAL');manual.stageIndex=stage;manual.units=[];
    assert.equal(plan.totalCost,plan.summonCost+plan.combinationCost);
    for(const step of plan.summons) for(let i=0;i<step.count;i++) assert.equal(manual.summon(step.unitTypeId),true);
    for(const step of plan.combinations) for(let i=0;i<step.count;i++) {
      assert.equal(step.unitCost,manual.combinationCost(step.recipeId));assert.equal(manual.combine(step.recipeId),true);
    }
    assert.equal(manual.minerals,0,`${stage} ${id}`);assert.equal(manual.units.length,1);assert.equal(manual.units[0].archetype,id);
    const quick=new SquadRoster(plan.totalCost);give(quick,'ARTISAN_SEAL');quick.stageIndex=stage;
    quick.units[0].star=3;quick.freeSummons=2;const owned=structuredClone(quick.units);
    assert.equal(quick.quickCraft(id,plan.totalCost),true);assert.equal(quick.minerals,0);
    assert.deepEqual(quick.units.slice(0,2),owned);assert.equal(quick.freeSummons,2);
  }
  const beforePrice=quickCraftPlans(0).get('PHOENIX_LORD').totalCost, roster=new SquadRoster(1000);give(roster,'ARTISAN_SEAL');
  const before={snapshot:roster.snapshot(),log:roster.economy.report()};
  assert.equal(roster.quickCraft('PHOENIX_LORD',beforePrice),false);
  assert.deepEqual({snapshot:roster.snapshot(),log:roster.economy.report()},before);
});

function checkpoint(index=0) {
  const roster=new SquadRoster(500),grid=new RoomGridManager(STAGES[index]);roster.stageIndex=index;
  const start=grid.getCurrentRoom(),elite=grid.grid.flat().find(r=>r?.type==='ELITE');
  const queue=[start],prev=new Map([[start.id,null]]);
  for(const r of queue) for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
    const next=grid.grid[r.gridY+dy]?.[r.gridX+dx];if(next && !prev.has(next.id)){prev.set(next.id,r);queue.push(next);}
  }
  let cleared=0;for(let r=elite;r;r=prev.get(r.id)){r.visited=r.cleared=true;if(r.type==='EVENT')r.circleChoice='SKIP';cleared++;}
  assert.equal(roster.offerRelic(elite),true);
  return {version:2,runId:'relic_test',phase:'room-cleared',currentRoomId:elite.id,savedAt:1000,grid:grid.grid,
    stats:{stageIndex:index,bossesDefeated:index,roomsCleared:cleared+index,enemiesDefeated:0,mineralsCollected:500,bossDefeated:false,
      damageMultiplier:1,attackSpeedMultiplier:1,moveSpeedBonus:0},roster:roster.snapshot(),
    leaderHealth:{currentHp:23,maxHp:100},unitHealth:roster.units.map(u=>({id:u.id,currentHp:1,
      reviveRemainingMs:0,healRemainingMs:0,skillRemainingMs:0})),relicHealRemainingMs:5000};
}
test('pending and chosen rewards round-trip; invalid sources, duplicate claims, capacity and timers cannot replace a good save',()=>{
  const storage={values:new Map(),getItem(k){return this.values.get(k)??null;},setItem(k,v){this.values.set(k,v);},removeItem(k){this.values.delete(k);}};
  const manager=new RunSaveManager(storage),data=checkpoint();
  assert.equal(manager.save(data),true);assert.deepEqual(manager.load().checkpoint,data);
  data.roster.relicRewards[0].relicId='SEED_CHALICE';data.relicHealRemainingMs=3799.5;
  assert.equal(manager.save(data),true);assert.deepEqual(manager.load().checkpoint,data);
  const restored=new SquadRoster();restored.restore(data.roster,0);const clone=restored.snapshot();clone.relicRewards[0].relicId='COMMAND_BANNER';
  assert.deepEqual(restored.relicRewards,data.roster.relicRewards);
  for(const change of [d=>d.roster.relicRewards=null,d=>d.roster.relicRewards.push({...d.roster.relicRewards[0]}),
    d=>d.roster.relicRewards[0].relicId='unknown',d=>d.roster.relicRewards[0].sourceRoomId='stage_1_room_0_0',
    d=>d.roster.relicRewards[0].sourceRoomId='stage_0_room_99_0',d=>d.roster.relicRewards[0].sourceRoomId='stage_0_room_1_1',
    d=>d.roster.relicRewards[0].sourceRoomId=d.grid.flat().find(r=>r?.type==='COMBAT').id,
    d=>d.relicHealRemainingMs=-1,d=>d.relicHealRemainingMs=5000.1,
    d=>{d.roster.relicRewards=[];d.relicHealRemainingMs=1;}]) {
    const bad=structuredClone(data);change(bad);assert.equal(isRunCheckpoint(bad),false,change.toString());
    assert.equal(manager.save(bad),false);assert.deepEqual(manager.load().checkpoint,data);
  }
  manager.save(data);const bad=structuredClone(data);bad.roster.relicRewards[0].relicId='unknown';
  storage.setItem('smash.run-checkpoint.v1',JSON.stringify(bad));assert.equal(manager.load().recovered,true);
});

test('pre-relic v1/v2 checkpoints preserve original health and currency without rewriting storage',()=>{
  const roster=new SquadRoster(500),grid=new RoomGridManager(STAGES[0]);
  const old=checkpoint();old.grid=grid.grid;old.currentRoomId=grid.getCurrentRoom().id;old.phase='stage-start';old.stats.roomsCleared=0;
  old.roster=roster.snapshot();delete old.roster.relicRewards;delete old.relicHealRemainingMs;
  const storage={value:null,getItem(k){return k==='smash.run-checkpoint.v1'?this.value:null;},setItem(k,v){if(k==='smash.run-checkpoint.v1')this.value=v;},removeItem(){}};
  const manager=new RunSaveManager(storage);
  for(const version of [1,2]) {
    old.version=version;assert.equal(manager.save(old),true);const raw=storage.value;
    const loaded=manager.load().checkpoint;assert.deepEqual(loaded,old);assert.equal(storage.value,raw);
    roster.restore(loaded.roster,0);assert.deepEqual(roster.relicRewards,[]);assert.equal(roster.minerals,500);
    assert.equal(loaded.leaderHealth.currentHp,23);assert.equal(loaded.unitHealth[0].currentHp,1);
  }
});

test('three historical/current rewards preserve choices, pending order and caps across later stage saves',()=>{
  const data=checkpoint(2),last=data.roster.relicRewards[0];
  data.roster.relicRewards=[{sourceRoomId:room(0).id,relicId:'COMMAND_BANNER'},
    {sourceRoomId:room(1).id,relicId:'SEED_CHALICE'},last];data.relicHealRemainingMs=2100;
  assert.equal(isRunCheckpoint(data),true);
  const roster=new SquadRoster();roster.restore(data.roster,2);
  assert.equal(roster.claimRelic(last.sourceRoomId,'ARTISAN_SEAL'),true);
  assert.equal(roster.offerRelic(room(2,0,1)),false,'three slots include historical rewards');
  data.roster=roster.snapshot();assert.equal(isRunCheckpoint(data),true);
  const copy=structuredClone(data);copy.roster.relicRewards[2].relicId='COMMAND_BANNER';
  assert.equal(isRunCheckpoint(copy),false,'same owned ID from another source');
  const tooMany=structuredClone(data);tooMany.roster.relicRewards.push({sourceRoomId:room(2,0,1).id,relicId:null});
  assert.equal(isRunCheckpoint(tooMany),false);
  const impossible=structuredClone(data);impossible.roster.relicRewards[2].sourceRoomId=room(1,0,1).id;
  assert.equal(isRunCheckpoint(impossible),false,'stage two cannot have more elite sources than its generated count');
  const early=new SquadRoster();assert.equal(early.offerRelic(room()),true);
  assert.equal(early.offerRelic(room(0,0,1)),false,'first stage has only one elite reward');
});
