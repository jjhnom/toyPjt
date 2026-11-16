import assert from 'node:assert/strict';
import {browserSession} from './helpers/browser-session.mjs';

const b=await browserSession();
try{
 await b.click('MenuScene','new-run');
 await b.waitFor('smash.scene.isActive("GameScene")');
 for(const [id,stageIndex,sequence] of [['frost_queen',3,0],['twilight_king',4,3]]){
 const result=await b.evaluate(`(()=>{
  const gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  gs.progression.index=${stageIndex};
  const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300,1,1,1);
  boss.applyBossProfile('${id}');
  gs.squad.roster.units=[{id:'frost-test-guard',archetype:'STONE_GUARD',tier:1,deployed:true,star:1}];
  gs.squad.syncRoster();
  gs.squad.leader.setPosition(360,800);
  const guard=gs.squad.drones[0];guard.setPosition(350,550);
  guard.health.currentHp=guard.health.maxHp;guard.setActive(true).setVisible(true);
  const cast=(sequence=${sequence})=>{
   gs.hazards.clear();gs.bossPatternLeft=0;gs.bossPatternNumber=sequence;gs.updateBossPatterns(0);
   return gs.hazards.slots.filter(h=>h.active).map(h=>({x:h.x,y:h.y}));
  };
  const ally=cast();
  guard.setPosition(400,700);
  const frozen=gs.hazards.slots.filter(h=>h.active).map(h=>({x:h.x,y:h.y}));
  const otherPattern='${id}'==='twilight_king'?cast(1):null;
  guard.health.currentHp=0;
  const leader=cast();
  gs.squad.leader.setPosition(300,650);
  const movedLeader=cast();
  gs.clearEncounter();
  return {ally,frozen,leader,movedLeader,otherPattern,activeAfterClear:gs.hazards.slots.filter(h=>h.active).length};
 })()`);
 assert.deepEqual(result.ally,[{x:350,y:380},{x:350,y:720},{x:180,y:550},{x:520,y:550}]);
 assert.deepEqual(result.frozen,result.ally);
 assert.deepEqual(result.leader,[{x:360,y:630},{x:360,y:970},{x:190,y:800},{x:530,y:800}]);
 assert.deepEqual(result.movedLeader,[{x:300,y:480},{x:300,y:820},{x:149,y:650},{x:470,y:650}]);
 assert.equal(result.activeAfterClear,0);
 if(id==='twilight_king')assert.deepEqual(result.otherPattern,[{x:360,y:800}],'poison still targets the leader even with a living guard');
 assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({status:'passed',id,...result}));
 }
}finally{b.close();}
