import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {BOSS_IDS,BOSS_PROFILES,planBossAttack}=load('src/config/bossData.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');

test('all six boss pattern plans preserve warning deadlines and geometry through visual and combat observers',()=>{
 let graphics;graphics=new Proxy({},{get:()=>()=>graphics});
 for(const id of BOSS_IDS)for(const phase of [1,2,3])for(const target of [{x:360,y:630},{x:64,y:190},{x:656,y:1090}]){
  for(let sequence=0;sequence<BOSS_PROFILES[id].patterns.length;sequence++){
   const plan=planBossAttack(id,phase,sequence,{x:360,y:300,speed:80},target);
   for(const attack of plan.attacks){
    const label=`${id}/${phase}/${sequence}/${attack.kind}`,hits=[],visuals=[];
    const h=new EncounterHazards({add:{graphics:()=>graphics}},(...args)=>{hits.push(args);},{
     start(){},draw(_index,state,impact){visuals.push({impact,x:state.x,y:state.y,radius:state.radius,age:state.age});},end(){},clear(){}
    });
    assert.equal(h.add(attack.kind,attack.x,attack.y,10,123,{...attack,bossId:id}),true,label);
    h.update(attack.warningMs-1);h.update(0);
    assert.equal(hits.length,0,`${label}: no resolution during warning`);
    assert.equal(visuals.at(-1).impact,false,label);
    h.update(1);
    assert.equal(hits.length,1,`${label}: first resolution at deadline`);
    assert.deepEqual(hits[0].slice(0,6),[attack.kind,attack.x,attack.y,attack.radius,10,123],label);
    assert.deepEqual(visuals.at(-1),{impact:true,x:attack.x,y:attack.y,radius:attack.radius,age:attack.warningMs},label);
    if(attack.kind==='SLASH')assert.deepEqual(hits[0].slice(6),[attack.fromX,attack.fromY],label);
    h.clear();h.update(10000);assert.equal(hits.length,1,`${label}: cleanup cancels callbacks`);
   }
  }
 }
});
