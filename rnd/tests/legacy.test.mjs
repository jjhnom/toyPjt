import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,load} from './helpers/skill-fixture.mjs';
const {LegacyProfile,LEGACY_KEY,isLegacyProfile}=load('src/systems/LegacyProfile.ts');
const {heroBaseStats,heroWeaponSpec}=load('src/config/heroData.ts');
const {HERO_CLASS_IDS}=load('src/config/heroClassData.ts');
const {HeroProgression,isHeroSnapshot}=load('src/systems/HeroProgression.ts');
const {RunSaveManager,isRunCheckpoint}=load('src/systems/RunSaveManager.ts');
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {SquadRoster}=load('src/systems/SquadRoster.ts');
class Storage {values=new Map();writes=0;getItem(k){return this.values.get(k)??null;}setItem(k,v){this.writes++;this.values.set(k,v);}removeItem(k){this.values.delete(k);}}

test('first bosses award exactly once per class, cap at five even in endless, and survive old observations and fresh instances',()=>{
 const s=new Storage(),p=new LegacyProfile(s);assert.equal(p.recordBosses('APPRENTICE_SUMMONER',1),true);
 assert.equal(p.snapshot().profile.shards,3);const writes=s.writes;
 p.recordBosses('APPRENTICE_SUMMONER',1);p.recordBosses('APPRENTICE_SUMMONER',0);assert.equal(s.writes,writes);
 p.recordBosses('APPRENTICE_SUMMONER',1000);assert.equal(p.snapshot().profile.shards,15);
 p.recordBosses('KNIGHT',5);p.recordBosses('ELEMENTALIST',5);assert.equal(p.snapshot().profile.shards,45);
 assert.equal(p.snapshot().profile.receipts.length,15);new LegacyProfile(s).recordBosses('KNIGHT',4);assert.equal(p.snapshot().profile.shards,45);
 for(const bad of[-1,1.5,Infinity,1001])assert.equal(p.recordBosses('KNIGHT',bad),false);
 assert.equal(p.recordBosses('BAD',1),false);
});
test('purchase quotes check revision, funds, price and caps without partial writes; selection is durable',()=>{
 const s=new Storage(),p=new LegacyProfile(s);assert.equal(p.buy(p.quote('power')),false);
 HERO_CLASS_IDS.forEach(id=>p.recordBosses(id,5));
 const stale=p.quote('power');assert.equal(p.selectClass('KNIGHT',p.snapshot().profile.revision),true);assert.equal(p.buy(stale),false);
 for(const id of['vitality','power'])for(let rank=0;rank<5;rank++){
  const q=p.quote(id),before=p.snapshot().profile.shards;assert.equal(q.cost,rank+1);
  assert.equal(p.buy({...q,cost:0}),false);assert.equal(p.buy(q),true);assert.equal(p.buy(q),false);
  assert.equal(p.snapshot().profile.shards,before-(rank+1));
 }
 assert.equal(p.quote('power'),null);assert.equal(p.quote('vitality'),null);assert.equal(p.snapshot().profile.shards,15);
 const copy=p.snapshot();copy.profile.ranks.power=0;copy.profile.receipts.length=0;
 assert.equal(new LegacyProfile(s).snapshot().profile.ranks.power,5);assert.equal(p.snapshot().profile.selectedClass,'KNIGHT');
});
test('failed awards remain unspendable until one successful atomic receipt write, with no duplicate retry',()=>{
 const s=new Storage(),p=new LegacyProfile(s),set=s.setItem.bind(s);s.setItem=()=>{throw new Error('quota');};
 assert.equal(p.recordBosses('KNIGHT',2),false);assert.equal(p.snapshot().profile.shards,0);assert.equal(p.snapshot().pending,2);
 assert.equal(p.buy(p.quote('power')),false);s.setItem=set;assert.equal(p.flush(),true);
 assert.equal(p.snapshot().profile.shards,6);assert.equal(p.snapshot().pending,0);p.flush();p.recordBosses('KNIGHT',2);assert.equal(p.snapshot().profile.shards,6);
 const before=s.getItem(LEGACY_KEY),q=p.quote('power');s.setItem=()=>{throw new Error('quota');};assert.equal(p.buy(q),false);assert.equal(s.getItem(LEGACY_KEY),before);
 assert.equal(p.selectClass('ELEMENTALIST',p.snapshot().profile.revision),false);assert.equal(s.getItem(LEGACY_KEY),before);
});
test('profile validation rejects forged currency, unsupported IDs, duplicate receipts and corrupt originals',()=>{
 const s=new Storage(),p=new LegacyProfile(s);p.recordBosses('KNIGHT',1);const good=p.snapshot().profile;assert.equal(isLegacyProfile(good),true);
 for(const change of[d=>d.shards++,d=>d.ranks.power=6,d=>d.ranks.vitality=-1,d=>d.ranks=null,
  d=>d.receipts.push(d.receipts[0]),d=>d.receipts=['BAD'],d=>d.version=2,d=>d.selectedClass='BAD',d=>d.revision=-1]){
  const bad=structuredClone(good);change(bad);const raw=JSON.stringify(bad);s.values.set(LEGACY_KEY,raw);
  assert.equal(isLegacyProfile(bad),false);assert.equal(p.recordBosses('KNIGHT',2),false);assert.equal(s.getItem(LEGACY_KEY),raw);
 }
 s.values.set(LEGACY_KEY,'{bad');assert.equal(p.snapshot().status,'invalid');assert.equal(p.selectClass('KNIGHT',0),false);assert.equal(s.getItem(LEGACY_KEY),'{bad');
 const unreadable=new Storage();unreadable.getItem=()=>{throw new Error('denied');};assert.equal(new LegacyProfile(unreadable).recordBosses('KNIGHT',1),false);assert.equal(unreadable.writes,0);
 assert.equal(new LegacyProfile(null).recordBosses('KNIGHT',1),false);
});
test('class and permanent snapshots copy state, validate class-specific weapon clocks, and retain legacy zero defaults',()=>{
 const h=new HeroProgression();h.classId='KNIGHT';h.permanent={vitality:2,power:3};
 const snap=h.snapshot(1299,12000),other=new HeroProgression();assert.equal(isHeroSnapshot(snap),true);assert.equal(other.restore(snap),true);
 snap.permanent.power=0;assert.equal(other.permanent.power,3);assert.equal(isHeroSnapshot({...snap,attackRemainingMs:1301}),false);
 assert.equal(isHeroSnapshot({...snap,permanent:{vitality:6,power:0}}),false);assert.equal(isHeroSnapshot({...snap,permanent:null}),false);
 const old=h.snapshot();delete old.permanent;assert.equal(other.restore(old),true);assert.deepEqual(other.permanent,{vitality:0,power:0});
 assert.deepEqual(heroBaseStats(1,'KNIGHT',{vitality:2,power:3}),{maxHp:135,damage:13});
 assert.equal(heroWeaponSpec(1,'ELEMENTALIST').aoeRadius,45);assert.equal(heroWeaponSpec(1,'KNIGHT').range,145);
});
test('knight heals only its living body; elementalist heals six and spends a cooldown on effective cleanse alone',()=>{
 const f=fixture(['BASIC_LASER']),s=f.squad;s.hero.classId='KNIGHT';s.health.currentHp=50;s.drones[0].health.currentHp=20;
 assert.equal(s.castCommandHeal(true),true);assert.equal(s.health.currentHp,75);assert.equal(s.drones[0].health.currentHp,20);
 s.restoreHero({...s.heroSnapshot(),activeRemainingMs:0});s.health.currentHp=s.health.maxHp;
 assert.equal(s.castCommandHeal(true),false);assert.equal(s.activeRemaining(),0);
 s.hero.classId='ELEMENTALIST';assert.equal(s.castCommandHeal(true),true);assert.equal(s.drones[0].health.currentHp,26);
 s.restoreHero({...s.heroSnapshot(),activeRemainingMs:0});s.drones[0].health.currentHp=s.drones[0].health.maxHp;
 s.movement.applySlow(0.65,800,0);assert.equal(s.castCommandHeal(false),false);assert.equal(s.movement.slowFactor,0.65);
 assert.equal(s.castCommandHeal(true),true);assert.equal(s.movement.slowFactor,1);assert.equal(s.activeRemaining(),18000);
 s.restoreHero({...s.heroSnapshot(),activeRemainingMs:0});s.movement.applySlow(0.65,1,0);f.scene.time.now=100;
 assert.equal(s.castCommandHeal(true),false);s.health.currentHp=0;assert.equal(s.castCommandHeal(true),false);
});
test('class growth and permanent damage use the hero source only and preserve wounds on repeated sync',()=>{
 const f=fixture(['BASIC_LASER']),s=f.squad;
 s.restoreHero({...s.heroSnapshot(),classId:'ELEMENTALIST',permanent:{vitality:5,power:5}});
 s.health.reset(115);s.health.currentHp=23;s.syncRoster();s.recordHeroKill('unit',40);
 assert.equal(s.health.maxHp,120);assert.equal(s.health.currentHp,23);for(let i=0;i<4;i++)s.syncRoster();assert.equal(s.health.maxHp,120);
 f.enemies.getChildren=()=>[{active:true,x:400,y:650,lifeId:1}];f.update(1000);
 assert.equal(f.heroShots[0].damage,15);assert.equal(f.heroShots[0].aoeRadius,45);assert.equal(f.heroShots[0].sourceKind,'hero');assert.equal(f.shots[0].damage,18);
});
test('class/rank checkpoint snapshots round-trip without consulting a changed permanent profile',()=>{
 const r=new SquadRoster(30),grid=new RoomGridManager(),h=new HeroProgression();h.classId='KNIGHT';h.permanent={vitality:3,power:2};
 const data={version:2,runId:'legacy_fixture',phase:'stage-start',currentRoomId:grid.getCurrentRoom().id,savedAt:0,
  stats:{stageIndex:0,bossesDefeated:0,roomsCleared:0,enemiesDefeated:0,mineralsCollected:30,bossDefeated:false,damageMultiplier:1,attackSpeedMultiplier:1,moveSpeedBonus:0},
  roster:r.snapshot(),hero:h.snapshot(1200,17000),leaderHealth:{currentHp:23,maxHp:140},
  unitHealth:r.units.map(u=>({id:u.id,currentHp:30,reviveRemainingMs:0,healRemainingMs:0,skillRemainingMs:0})),grid:grid.grid};
 assert.equal(isRunCheckpoint(data),true);const s=new Storage(),manager=new RunSaveManager(s);assert.equal(manager.save(data),true);
 const meta=new LegacyProfile(s);meta.recordBosses('ELEMENTALIST',5);meta.buy(meta.quote('power'));meta.selectClass('ELEMENTALIST',meta.snapshot().profile.revision);
 assert.deepEqual(manager.load().checkpoint,data);manager.clear();assert.equal(meta.snapshot().profile.shards,14);
 assert.equal(meta.snapshot().profile.selectedClass,'ELEMENTALIST');
});
