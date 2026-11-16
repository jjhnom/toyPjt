import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,load} from './helpers/skill-fixture.mjs';

const {planBossAttack}=load('src/config/bossData.ts');
const {ARENA_BOUNDS}=load('src/config/gameData.ts');
const boss={x:360,y:300,speed:80};

for(const [id,sequence,warningMs] of [['frost_queen',0,1100],['twilight_king',3,1000]]){
test(`${id} places four fields around the current target and freezes the warning positions`,()=>{
 const target={x:350,y:700};
 const plan=planBossAttack(id,1,sequence,boss,target);
 assert.deepEqual(plan.attacks.map(a=>[a.x,a.y]),[[350,530],[350,870],[180,700],[520,700]]);
 const snapshot=structuredClone(plan);
 target.x=400;target.y=750;
 assert.deepEqual(plan,snapshot);
 assert.notDeepEqual(planBossAttack(id,1,sequence,boss,target).attacks,plan.attacks);
 for(const attack of plan.attacks){
  assert.equal(attack.kind,'FROST');assert.equal(attack.radius,85);
  assert.equal(attack.warningMs,warningMs);assert.equal(attack.durationMs,2200);
 }
});

test(`${id} targeting uses living deployed allies and falls back to the leader`,()=>{
 const {squad}=fixture(['BASIC_LASER','STONE_GUARD']);
 squad.leader.setPosition(360,800);
 const [archer,guard]=squad.drones;
 archer.setPosition(350,550);guard.setPosition(380,500);
 const choose=()=>squad.findEnemyTarget(boss.x,boss.y)??squad.leader;
 assert.equal(choose(),guard);
 guard.health.currentHp=0;
 assert.equal(choose(),archer);
 const attacks=planBossAttack(id,1,sequence,boss,choose()).attacks;
 assert.deepEqual(attacks.map(a=>[a.x,a.y]),[[350,380],[350,720],[180,550],[520,550]]);
 archer.health.currentHp=0;
 assert.equal(choose(),squad.leader);
});

test(`${id} fields stay in the arena at its edges in every phase`,()=>{
 for(const phase of [1,2,3])for(const x of [ARENA_BOUNDS.left,ARENA_BOUNDS.right])for(const y of [ARENA_BOUNDS.top,ARENA_BOUNDS.bottom]){
  const {attacks}=planBossAttack(id,phase,sequence,boss,{x,y});
  assert.equal(attacks.length,4);
  for(const a of attacks){
   assert.ok(a.x-a.radius>=ARENA_BOUNDS.left&&a.x+a.radius<=ARENA_BOUNDS.right);
   assert.ok(a.y-a.radius>=ARENA_BOUNDS.top&&a.y+a.radius<=ARENA_BOUNDS.bottom);
  }
 }
});
}

test('queen and twilight summons keep their previous boss-centered positions',()=>{
 const summon=planBossAttack('frost_queen',1,1,boss,{x:250,y:850});
 assert.deepEqual(summon.attacks.map(a=>[a.x,a.y]),[[boss.x,boss.y]]);
 const twilightSummon=planBossAttack('twilight_king',1,4,boss,{x:250,y:850});
 assert.deepEqual(twilightSummon.attacks.map(a=>[a.x,a.y]),[[boss.x,boss.y]]);
});
