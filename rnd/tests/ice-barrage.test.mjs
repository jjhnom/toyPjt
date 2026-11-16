import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {planBossAttack}=load('src/config/bossData.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {ARENA_BOUNDS}=load('src/config/gameData.ts');
const boss={x:360,y:300,speed:80};
test('queen barrage has ten bounded fixed targets, 180ms cadence and enough recovery time in every phase',()=>{
 for(const phase of [1,2,3])for(const target of [{x:360,y:630},{x:0,y:9999}]){
  const plan=planBossAttack('frost_queen',phase,2,boss,target),copy=structuredClone(plan);
  assert.equal(plan.attacks.length,10);
  for(const [i,a]of plan.attacks.entries()){
   assert.equal(a.kind,'METEOR');assert.equal(a.warningMs,1100+i*180);assert.equal(a.radius,48);
   assert.ok(a.x>=ARENA_BOUNDS.left+48&&a.x<=ARENA_BOUNDS.right-48);
   assert.ok(a.y>=ARENA_BOUNDS.top+48&&a.y<=ARENA_BOUNDS.bottom-48);
  }
  assert.ok(plan.intervalMs>=plan.attacks.at(-1).warningMs+250+200);
  target.x++;assert.deepEqual(plan,copy);
 }
});
test('ten impacts resolve separately exactly once, pause together and are cancelled by cleanup',()=>{
 let g;g=new Proxy({},{get:()=>()=>g});const hits=[];
 const h=new EncounterHazards({add:{graphics:()=>g}},(...args)=>hits.push(args));
 const plan=planBossAttack('frost_queen',1,2,boss,{x:360,y:630});
 const add=()=>{for(const a of plan.attacks)assert.equal(h.add(a.kind,a.x,a.y,10,7,a),true);};
 add();h.update(1099);assert.equal(hits.length,0);h.update(0);assert.equal(hits.length,0);
 h.update(1);assert.equal(hits.length,1);
 for(let i=1;i<10;i++){h.update(179);assert.equal(hits.length,i);h.update(1);assert.equal(hits.length,i+1);}
 h.update(1000);assert.equal(hits.length,10);
 add();h.clear();h.update(9999);assert.equal(hits.length,10);
});
