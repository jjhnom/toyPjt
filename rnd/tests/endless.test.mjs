import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../scripts/lib/load-typescript.mjs';

const {STAGES,getStageDefinition,generateEndlessStage,getStageScaling,stageClearReward,MAX_SAFE_STAGE_INDEX}=load('src/config/stageData.ts');
const {StageProgression}=load('src/systems/StageProgression.ts');
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {SquadRoster}=load('src/systems/SquadRoster.ts');
const {RunSaveManager,isRunCheckpoint}=load('src/systems/RunSaveManager.ts');
const {EndlessRecordManager,ENDLESS_RECORD_KEY}=load('src/systems/EndlessRecordManager.ts');
const {parseRelicSource}=load('src/systems/RelicRewards.ts');
const {seededRandom}=load('src/systems/EconomySimulation.ts');
const {killReward,roomClearReward}=load('src/systems/EncounterRules.ts');
class Storage {
 values=new Map();getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,v);}removeItem(k){this.values.delete(k);}
}

test('endless definitions rotate five themes without mutating story data or sharing writable arrays',()=>{
 const before=structuredClone(STAGES);
 for(const index of [5,6,9,10,14,99,999]){
  const stage=generateEndlessStage(index),theme=STAGES[(index-5)%5];
  assert.equal(stage.index,index);assert.equal(stage.name,theme.name);assert.equal(stage.bossId,theme.bossId);
  assert.deepEqual(stage.bossPatterns,theme.bossPatterns);assert.equal(stage.isFinal,false);
  assert.equal(stage.gridWidth,5);assert.equal(stage.gridHeight,5);assert.equal(stage.roomCount,15);
  assert.equal(stage.eliteCount,Math.min(4+Math.floor((index-5)/2),6));
  stage.enemyPoolIds.length=0;stage.bossPatterns.length=0;stage.palette.background=0;
 }
 assert.deepEqual(STAGES,before);
 assert.equal(getStageDefinition(5),getStageDefinition(5),'runtime definition cache avoids per-frame allocations');
 for(const bad of [-1,1.5,4,1000,NaN,Infinity])assert.throws(()=>generateEndlessStage(bad),RangeError);
 assert.equal(getStageDefinition(1000),undefined);
});

test('endless grids are bounded, connected and put one boss at maximum depth across seeds and distant indices',()=>{
 for(const index of [5,6,7,8,9,19,99,999])for(let seed=0;seed<12;seed++){
  const stage=getStageDefinition(index),grid=new RoomGridManager(stage,undefined,seededRandom(seed));
  const rooms=grid.grid.flat().filter(Boolean);assert.equal(rooms.length,15);
  assert.equal(rooms.filter(r=>r.type==='ELITE').length,stage.eliteCount);
  for(const type of ['BOSS','EVENT','RECOVERY'])assert.equal(rooms.filter(r=>r.type===type).length,1);
  assert.equal(grid.getCurrentRoom().type,'COMBAT');assert.equal(grid.getDepth(rooms.find(r=>r.type==='BOSS')),1);
  assert.ok(rooms.every(r=>r.id.startsWith(`stage_${index}_`) && r.waveCount<=6));
  const visited=new Set(),queue=[grid.getCurrentRoom()];
  for(const room of queue){if(visited.has(room.id))continue;visited.add(room.id);
   for(const [dir,dx,dy,opposite]of[['top',0,-1,'bottom'],['bottom',0,1,'top'],['left',-1,0,'right'],['right',1,0,'left']]){
    const next=grid.grid[room.gridY+dy]?.[room.gridX+dx];assert.equal(room.doors[dir],!!next);
    if(next){assert.equal(next.doors[opposite],true);if(!visited.has(next.id))queue.push(next);}
   }}
  assert.equal(visited.size,15);
 }
});

test('scaling preserves the five-story curve and bounds every numeric field, reward and workload up to the safety limit',()=>{
 for(let i=0;i<5;i++){
  const s=getStageScaling(i);assert.equal(s.enemyHpMult,1+0.45*i**1.15);assert.equal(s.bossHpMult,1+0.65*i**1.2);
  assert.equal(s.enemyDamageMult,1+0.25*i);assert.equal(s.rewardMult,1+0.3*i);
 }
 const base=getStageScaling(4),first=getStageScaling(5);assert.equal(first.enemyHpMult,base.enemyHpMult*1.15);
 assert.equal(first.rewardMult,base.rewardMult*1.06);assert.equal(first.spawnIntervalMult,0.6);
 let prev=base;
 for(let i=5;i<=MAX_SAFE_STAGE_INDEX;i++){
  const s=getStageScaling(i);assert.ok(Object.values(s).every(Number.isFinite));
  assert.ok(s.enemyHpMult>=prev.enemyHpMult && s.bossHpMult>=prev.bossHpMult && s.rewardMult>=prev.rewardMult);
  assert.ok(s.enemyHpMult<=1000 && s.bossHpMult<=1000 && s.enemyDamageMult<=20 && s.bossDamageMult<=20);
  assert.ok(s.enemySpeedMult<=1.45 && s.maxActiveEnemies<=64 && s.waveCountBonus<=4 && s.rewardMult<=22);
  assert.ok(Number.isSafeInteger(stageClearReward(getStageDefinition(i))));
  assert.ok(Number.isSafeInteger(killReward('BOSS_CORE',i)));assert.ok(roomClearReward('ELITE',i)<=990);prev=s;
 }
 for(const bad of [-1,0.5,1000,NaN,Infinity])assert.throws(()=>getStageScaling(bad),RangeError);
});

test('boss choices commit once, continue gates transitions, and the last safe stage cannot continue',()=>{
 const run=new StageProgression();run.index=4;run.bossesDefeated=4;
 const reward=run.clearBoss();assert.equal(reward.choiceRequired,true);assert.equal(reward.victory,false);
 assert.equal(reward.freeSummons,0);assert.equal(run.bossesDefeated,5);assert.equal(run.clearBoss(),null);
 assert.equal(run.beginTransition(),false);assert.equal(run.selectEndless('continue'),true);
 assert.equal(run.selectEndless('exit'),false);assert.equal(run.beginTransition(),true);assert.equal(run.beginTransition(),false);
 assert.equal(run.index,5);assert.equal(run.endlessChoice,'none');run.finishTransition();
 assert.equal(run.clearBoss().choiceRequired,true);assert.equal(run.bossesDefeated,6);
 assert.equal(run.selectEndless('exit'),true);assert.equal(run.beginTransition(),false);
 const limit=new StageProgression();limit.index=999;limit.bossesDefeated=999;limit.clearBoss();
 assert.equal(limit.next,undefined);assert.equal(limit.selectEndless('continue'),false);assert.equal(limit.beginTransition(),false);
 assert.equal(limit.selectEndless('exit'),true);assert.equal(limit.bossesDefeated,1000);
});

function checkpoint(index,phase='stage-start',choice) {
 const stage=getStageDefinition(index),grid=new RoomGridManager(stage,undefined,seededRandom(index)),roster=new SquadRoster(700);
 const start=grid.getCurrentRoom(),target=phase==='stage-start'?start:phase==='stage-cleared'
  ?grid.grid.flat().find(r=>r?.type==='BOSS'):grid.grid.flat().find(r=>r?.type==='ELITE');
 const queue=[start],previous=new Map([[start.id,null]]);
 for(const room of queue)for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){const next=grid.grid[room.gridY+dy]?.[room.gridX+dx];
  if(next&&!previous.has(next.id)){previous.set(next.id,room);queue.push(next);}}
 let count=0;if(phase!=='stage-start')for(let room=target;room;room=previous.get(room.id)){room.visited=room.cleared=true;if(room.type==='EVENT')room.circleChoice='SKIP';count++;}
 const choiceStage=index>=4&&phase==='stage-cleared';
 return{version:2,runId:'endless_test',phase,currentRoomId:target.id,savedAt:1000,mode:index>=5?'endless':'campaign',
  endlessChoice:choice??(choiceStage?'pending':'none'),stats:{stageIndex:index,bossesDefeated:index+Number(phase==='stage-cleared'),
   roomsCleared:index+count,enemiesDefeated:10,mineralsCollected:700,bossDefeated:index>=5||choiceStage,
   damageMultiplier:1.7,attackSpeedMultiplier:1.2,moveSpeedBonus:10},roster:roster.snapshot(),leaderHealth:{currentHp:23,maxHp:120},
  unitHealth:roster.units.map(u=>({id:u.id,currentHp:35,reviveRemainingMs:0,healRemainingMs:1500,skillRemainingMs:0})),grid:grid.grid};
}

test('all endless phases and decision checkpoints round-trip without changing health, resources or choice',()=>{
 for(const index of [4,5,6,9,99,999])for(const phase of ['stage-start','room-cleared','stage-cleared']){
  for(const choice of phase==='stage-cleared'?['pending','continue','exit']:['none']){
   const data=checkpoint(index,phase,choice);if(index===999&&choice==='continue'){assert.equal(isRunCheckpoint(data),false);continue;}
   const storage=new Storage(),manager=new RunSaveManager(storage);assert.equal(manager.save(data),true,`${index} ${phase} ${choice}`);
   const raw=[...storage.values];assert.deepEqual(manager.load().checkpoint,data);assert.deepEqual([...storage.values],raw);
   const grid=new RoomGridManager(getStageDefinition(index),data.grid);grid.restoreCurrentRoom(data.currentRoomId);
   assert.equal(grid.getCurrentRoom().id,data.currentRoomId);
  }
 }
});

test('invalid modes, choices, flags, counters and indices cannot replace a good pending or confirmed save',()=>{
 const data=checkpoint(5,'stage-cleared'),storage=new Storage(),manager=new RunSaveManager(storage);manager.save(data);
 for(const mutate of[d=>delete d.mode,d=>d.mode='campaign',d=>d.mode=null,d=>d.endlessChoice='none',
  d=>d.endlessChoice='other',d=>d.stats.bossDefeated=false,d=>d.stats.bossesDefeated=5,d=>d.stats.stageIndex=1000,
  d=>d.version=1,d=>d.phase='stage-start']){
  const bad=structuredClone(data);mutate(bad);assert.equal(isRunCheckpoint(bad),false,mutate.toString());
  assert.equal(manager.save(bad),false);assert.deepEqual(manager.load().checkpoint,data);
 }
 const start=checkpoint(5);start.endlessChoice='pending';assert.equal(isRunCheckpoint(start),false);
 const oldFinal=checkpoint(4,'stage-cleared');delete oldFinal.endlessChoice;assert.equal(isRunCheckpoint(oldFinal),false);
 const pending=checkpoint(4,'stage-cleared');manager.save(pending);
 const confirmed=structuredClone(pending);confirmed.endlessChoice='continue';manager.save(confirmed);
 storage.setItem('smash.run-checkpoint.v1','{bad');assert.deepEqual(manager.load().checkpoint,pending);
});

test('legacy story checkpoints remain readable and endless relic sources use generated dimensions and counts',()=>{
 for(let index=0;index<5;index++)for(const version of[1,2]){
  const data=checkpoint(index);data.version=version;delete data.mode;delete data.endlessChoice;
  assert.equal(isRunCheckpoint(data),true);assert.equal(data.leaderHealth.currentHp,23);
 }
 const data=checkpoint(5,'room-cleared');data.roster.relicRewards=[{sourceRoomId:data.currentRoomId,relicId:'SEED_CHALICE'}];
 data.relicHealRemainingMs=2100;assert.equal(isRunCheckpoint(data),true);
 assert.equal(parseRelicSource(data.currentRoomId).stageIndex,5);assert.equal(parseRelicSource('stage_999_room_0_0').stageIndex,999);
 assert.equal(parseRelicSource('stage_1000_room_0_0'),null);
 const restored=new SquadRoster();restored.restore(data.roster,5);assert.deepEqual(restored.relicIds(),['SEED_CHALICE']);
 const source=data.roster.relicRewards[0].sourceRoomId;assert.equal(restored.offerRelic({id:source,type:'ELITE',cleared:true}),false);
});

test('highest reached record is monotonic, separate from run deletion, strict about corruption and tolerant of blocked storage',()=>{
 const storage=new Storage(),records=new EndlessRecordManager(storage),runs=new RunSaveManager(storage);
 assert.equal(records.recordReached(4),false);assert.equal(records.highestStage(),0);
 assert.equal(records.recordReached(5),true);assert.equal(records.highestStage(),6);
 records.recordReached(9);records.recordReached(5);assert.equal(records.highestStage(),10);
 runs.save(checkpoint(5));runs.clear();assert.equal(records.highestStage(),10);
 records.recordReached(999);assert.equal(records.highestStage(),1000);
 for(const value of ['{bad',JSON.stringify({version:1,highestStage:'6'}),JSON.stringify({version:1,highestStage:1001})]){
  storage.setItem(ENDLESS_RECORD_KEY,value);assert.equal(records.highestStage(),0);
 }
 const blocked=new EndlessRecordManager({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});
 assert.equal(blocked.highestStage(),0);assert.equal(blocked.recordReached(5),false);
 for(const bad of[-1,1.5,1000,NaN,Infinity])assert.equal(records.recordReached(bad),false);
});
