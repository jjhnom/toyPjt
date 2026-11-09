import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { UPGRADE_IDS, UPGRADES, emptyUpgrades, upgradeCost } = load('src/config/upgradeData.ts');
const { resolveUpgradeEffects, upgradedAttackSpeed } = load('src/systems/UpgradeEffects.ts');
const { SquadRoster } = load('src/systems/SquadRoster.ts');
const { HealthComponent } = load('src/components/HealthComponent.ts');
const { UNIT_TYPES } = load('src/config/unitData.ts');
const { RunSaveManager, isRunCheckpoint } = load('src/systems/RunSaveManager.ts');
const { RoomGridManager } = load('src/systems/RoomGridManager.ts');
const { STAGES } = load('src/config/stageData.ts');

test('six upgrades have finite increasing prices, exact boundary charges, level caps and recorded spending', () => {
  assert.equal(new Set(UPGRADE_IDS).size, 6);
  assert.deepEqual([0,1,2].map(level => upgradeCost('heroHealth',level)),[30,41,55]);
  for (const id of UPGRADE_IDS) {
    const roster = new SquadRoster(0), units = structuredClone(roster.units);
    let spent = 0, previous = 0;
    for (let level = 0; level < 10; level++) {
      const quote = roster.upgradeQuote(id);
      assert.equal(quote.level,level); assert.ok(quote.cost > previous);
      roster.minerals = quote.cost;
      assert.equal(roster.buyUpgrade(quote),true); assert.equal(roster.minerals,0);
      assert.equal(roster.upgrades[id],level+1);
      assert.deepEqual(roster.units,units); assert.equal(roster.freeSummons,0);
      spent += quote.cost; previous = quote.cost;
    }
    assert.equal(roster.upgradeQuote(id),null); assert.equal(upgradeCost(id,10),null);
    const report = roster.economy.report();
    assert.equal(report.stages[0].spent,spent); assert.equal(report.stages[0].byReason.upgrade,-spent);
    assert.equal(report.eventsRecorded,10);
  }
});

test('stale, replayed, capped, insufficient or malformed quotes leave every transaction field and log unchanged', () => {
  const roster = new SquadRoster(1000), quote = roster.upgradeQuote('squadAttack');
  assert.equal(roster.buyUpgrade(quote),true);
  for (const invalid of [quote,null,{...quote,id:'toString'},{...quote,id:'unknown'},
    {...roster.upgradeQuote('squadAttack'),cost:0},{...quote,level:NaN}]) {
    const before = { roster:roster.snapshot(),log:roster.economy.report() };
    assert.equal(roster.buyUpgrade(invalid),false);
    assert.deepEqual({roster:roster.snapshot(),log:roster.economy.report()},before);
  }
  roster.minerals = 59;
  const before = { roster:roster.snapshot(),log:roster.economy.report() };
  assert.equal(roster.buyUpgrade(roster.upgradeQuote('squadSpeed')),false);
  assert.deepEqual({roster:roster.snapshot(),log:roster.economy.report()},before);
  roster.upgrades.squadAttack = 10;
  assert.equal(roster.buyUpgrade({id:'squadAttack',level:10,cost:0}),false);
});

test('HP upgrades preserve living wounds and fallen timers across all unit types and stars without repeated gains', () => {
  for (const type of Object.values(UNIT_TYPES)) for (const star of [1,2,3]) for (const hp of [0,1]) {
    const {squad} = fixture([type.id]); const drone=squad.drones[0];
    drone.star=star; squad.roster.units[0].star=star;
    const base=type.maxHp*(1+0.5*(star-1)); drone.health.reset(base);
    if(hp===0) drone.health.takeDamage(100000); else drone.health.currentHp=hp;
    drone.reviveAt=9999; const active=drone.active;
    squad.roster.upgrades.squadHealth=3;
    for(let i=0;i<5;i++) squad.syncRoster();
    assert.equal(drone.health.maxHp,Math.round(base*1.3),`${type.id} star ${star}`);
    assert.equal(drone.health.currentHp,hp); assert.equal(drone.reviveAt,9999); assert.equal(drone.active,active);
  }
  const {squad}=fixture(['BASIC_LASER']); squad.roster.upgrades.squadHealth=5; squad.syncRoster();
  squad.roster.minerals=100; assert.equal(squad.roster.summon('BASIC_LASER'),true); squad.syncRoster();
  assert.equal(squad.drones.at(-1).health.currentHp,105); assert.equal(squad.drones.at(-1).health.maxHp,105);
});

test('hero HP upgrades preserve legacy bonuses, level additions, wounds and cooldown through repeated sync and hydration', () => {
  const f=fixture(['BASIC_LASER']); f.squad.health.reset(120); f.squad.health.currentHp=23;
  f.squad.roster.upgrades.heroHealth=2; f.squad.roster.upgrades.heroAttack=2;
  f.squad.syncRoster(); assert.equal(f.squad.health.maxHp,140); assert.equal(f.squad.health.currentHp,23);
  f.squad.recordHeroKill('unit',87); assert.equal(f.squad.hero.level,3);
  assert.equal(f.squad.health.maxHp,150); assert.equal(f.squad.health.currentHp,23);
  const hero=f.squad.heroSnapshot();
  for(let i=0;i<10;i++) f.squad.syncRoster();
  assert.equal(f.squad.health.maxHp,150); assert.deepEqual(f.squad.heroSnapshot(),hero);
  const restored=fixture([]);
  restored.squad.roster.restore(f.squad.roster.snapshot(),0); restored.squad.restoreHero(hero); restored.squad.syncRoster();
  // The same order as GameScene hydration: authoritative saved health replaces the constructor projection.
  restored.squad.health.reset(150); restored.squad.health.currentHp=23;
  for(let i=0;i<5;i++) restored.squad.syncRoster();
  assert.equal(restored.squad.health.maxHp,150); assert.equal(restored.squad.health.currentHp,23);
  assert.deepEqual(restored.squad.heroSnapshot(),hero);
});

test('squad attacks combine legacy, upgrade, star and nonstacking aura once; hero uses only flat hero additions', () => {
  const f=fixture(['BASIC_LASER','WORLD_DRUID']);
  f.squad.roster.upgrades.squadAttack=2; f.squad.roster.upgrades.heroAttack=2;
  f.squad.drones[0].star=2; f.squad.roster.units[0].star=2; f.squad.syncRoster();
  f.enemies.getChildren=()=>[{active:true,x:400,y:650,lifeId:1}];
  f.squad.update(1000,0,0,0,f.enemies,1.5,1,0,true);
  assert.equal(f.shots.find(shot=>shot.sourceUnitId==='skill_0').damage,54); // round(18*1.5*(1+upgrade .1+forest synergy .05)*1.15*1.5)
  assert.equal(f.heroShots[0].damage,10); assert.equal(f.heroShots[0].sourceKind,'hero');
  const lava=fixture(['LAVA_GOLEM']); lava.squad.roster.upgrades.squadAttack=10; lava.squad.syncRoster();
  const target={active:true,x:400,y:650,burn:{apply:(damage)=>{target.burnDamage=damage;}}};
  lava.enemies.getChildren=()=>[target]; lava.squad.update(1000,0,0,0,lava.enemies,2,1,0,true);
  assert.equal(target.burnDamage,18); // 6 * legacy 2 * upgrade 1.5
});

test('combined attack speed caps at 2.5 and never changes the independent hero cadence', () => {
  assert.equal(upgradedAttackSpeed(1.2,2),2.4); assert.equal(upgradedAttackSpeed(9,2),2.5);
  const f=fixture(['BASIC_LASER']); f.squad.roster.upgrades.squadSpeed=10; f.squad.syncRoster();
  f.enemies.getChildren=()=>[{active:true,x:400,y:650,lifeId:1}];
  const update=time=>f.squad.update(time,0,0,0,f.enemies,1,9,0,true);
  update(2000); update(2219); assert.equal(f.shots.length,1);
  update(2220); assert.equal(f.shots.length,2); assert.equal(f.heroShots.length,1);
});

test('shared defense caps before shields and HP, respects immunity/death, and leaves enemy and healing values intact', () => {
  const {squad}=fixture(['PALADIN']); squad.roster.upgrades.defense=10; squad.syncRoster();
  assert.equal(squad.health.damageReduction,0.5); assert.equal(squad.drones[0].health.damageReduction,0.5);
  squad.health.applyShield(5,10000);
  squad.receiveContactDamage(20,1000); // paladin takes round(20*.3)*.5=3; leader 14*.5=7, shield absorbs 5.
  assert.equal(squad.health.currentHp,98); assert.equal(squad.health.shieldHp,0);
  assert.equal(squad.drones[0].health.currentHp,squad.drones[0].health.maxHp-3);
  assert.equal(squad.health.takeDamage(20,1001),false);
  squad.health.damageReduction=5; squad.health.takeDamage(20,2000);
  assert.equal(squad.health.currentHp,88,'out-of-range reduction is capped at 50%');
  squad.health.takeDamage(1,3000); assert.equal(squad.health.currentHp,87);
  assert.equal(squad.health.heal(3),3); assert.equal(squad.health.currentHp,90);
  const enemyHealth=new HealthComponent(100); enemyHealth.takeDamage(20); assert.equal(enemyHealth.currentHp,80);
  squad.health.takeDamage(100000); assert.equal(squad.health.takeDamage(10),false);
  assert.equal(resolveUpgradeEffects(emptyUpgrades()).damageReduction,0);
});

test('room, spring and automatic revival use upgraded maxima; purchases preserve skill and shield state', () => {
  const {squad,update}=fixture(['BASIC_LASER','BASIC_LASER']);
  squad.health.currentHp=23;squad.health.applyShield(20,5000);
  squad.drones[0].health.currentHp=1;squad.drones[0].lastSkillAt=500;
  squad.drones[0].health.applyShield(30,5000);
  squad.drones[1].health.takeDamage(10000);squad.drones[1].reviveAt=1234;
  squad.roster.upgrades.squadHealth=1;squad.roster.upgrades.heroHealth=1;squad.syncRoster();
  assert.equal(squad.drones[0].lastSkillAt,500);assert.equal(squad.drones[0].health.shieldHp,30);
  assert.equal(squad.health.shieldHp,20);assert.equal(squad.drones[1].reviveAt,1234);
  squad.recoverForRoomEntry();assert.deepEqual(squad.drones.map(d=>d.health.currentHp),[39,39]);
  assert.equal(squad.health.currentHp,23);
  assert.deepEqual(squad.recoverAtSpring(),{leaderHealed:50,unitHealed:70,unitsRecovered:2});
  assert.equal(squad.health.currentHp,73);assert.deepEqual(squad.drones.map(d=>d.health.currentHp),[74,74]);
  squad.drones[1].health.clearShield();squad.drones[1].health.takeDamage(10000);squad.drones[1].reviveAt=2000;
  update(1999,false);assert.equal(squad.drones[1].health.currentHp,0);
  update(2000,false);assert.equal(squad.drones[1].health.currentHp,39);
});

function checkpoint() {
  const roster=new SquadRoster(500), grid=new RoomGridManager(STAGES[0]);
  roster.upgrades.squadHealth=3; roster.upgrades.heroHealth=2;
  return {version:2,runId:'upgrade_test',phase:'stage-start',currentRoomId:grid.getCurrentRoom().id,savedAt:1000,
    stats:{stageIndex:0,bossesDefeated:0,roomsCleared:0,enemiesDefeated:0,mineralsCollected:500,bossDefeated:false,
      damageMultiplier:1.7,attackSpeedMultiplier:1.2,moveSpeedBonus:0},roster:roster.snapshot(),grid:grid.grid,
    leaderHealth:{currentHp:23,maxHp:140},unitHealth:roster.units.map(unit=>({id:unit.id,currentHp:91,
      reviveRemainingMs:0,healRemainingMs:0,skillRemainingMs:0}))};
}
test('new saves validate upgraded ally HP; malformed levels fall back, and old saves load without rewriting or bonuses', () => {
  const storage={values:new Map(),getItem(k){return this.values.get(k)??null;},setItem(k,v){this.values.set(k,v);},removeItem(k){this.values.delete(k);}};
  const manager=new RunSaveManager(storage), data=checkpoint();
  assert.equal(manager.save(data),true); assert.deepEqual(manager.load().checkpoint,data);
  const clone=data.roster.upgrades; const roster=new SquadRoster(); roster.restore(data.roster,0);
  clone.squadAttack=3; assert.equal(roster.upgrades.squadAttack,0,'restoration copies upgrade state'); clone.squadAttack=0;
  const snapshot=roster.snapshot(); snapshot.upgrades.squadHealth=10; assert.equal(roster.upgrades.squadHealth,3);
  for(const mutate of [d=>delete d.roster.upgrades.defense,d=>d.roster.upgrades.defense=-1,
    d=>d.roster.upgrades.heroAttack=11,d=>d.roster.upgrades.heroHealth=1.5,d=>d.roster.upgrades.squadSpeed=Infinity,
    d=>d.roster.upgrades.unknown=1,d=>d.roster.upgrades=null,d=>d.unitHealth[0].currentHp=92]) {
    const bad=structuredClone(data); mutate(bad); assert.equal(isRunCheckpoint(bad),false,mutate.toString());
    assert.equal(manager.save(bad),false); assert.deepEqual(manager.load().checkpoint,data);
  }
  manager.save(data); const bad=structuredClone(data); bad.roster.upgrades.defense=11;
  storage.setItem('smash.run-checkpoint.v1',JSON.stringify(bad));
  assert.equal(manager.load().recovered,true); assert.deepEqual(manager.load().checkpoint,data);
  for(const version of [1,2]) {
    const old=checkpoint(); old.version=version; delete old.roster.upgrades;
    old.unitHealth.forEach(unit=>unit.currentHp=35);
    assert.equal(manager.save(old),true); const raw=[...storage.values];
    const loaded=manager.load().checkpoint; assert.deepEqual(loaded,old); assert.deepEqual([...storage.values],raw);
    roster.restore(loaded.roster,0); assert.deepEqual(roster.upgrades,emptyUpgrades());
    assert.equal(loaded.leaderHealth.maxHp,140); assert.equal(loaded.leaderHealth.currentHp,23);
  }
  assert.deepEqual(new SquadRoster().upgrades,emptyUpgrades());
});
