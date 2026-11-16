import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {planBossAttack}=load('src/config/bossData.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {ARENA_BOUNDS:b}=load('src/config/gameData.ts');

test('six fissure pillars keep a fixed straight path, complete radius bounds and 150ms cadence even at corners',()=>{
 for(const phase of [1,2,3])for(const [x,y]of [[360,300],[b.left,b.top],[b.right,b.bottom],[b.left,b.bottom],[b.right,b.top],[360,630]]){
  const target={x:x<360?b.left:b.right,y:y<630?b.top:b.bottom};
  const plan=planBossAttack('lava_colossus',phase,1,{x,y,speed:80},target),snapshot=structuredClone(plan);
  assert.equal(plan.attacks.length,6);
  const a=plan.attacks[0],dx=a.x-a.fromX,dy=a.y-a.fromY;
  assert.ok(Math.hypot(dx,dy)>30);
  for(const [i,p]of plan.attacks.entries()){
   assert.equal(p.kind,'FISSURE');assert.equal(p.warningMs,1100+i*150);assert.equal(p.durationMs,250);assert.equal(p.radius,54);
   assert.ok(p.x-p.radius>=b.left-1e-7&&p.x+p.radius<=b.right+1e-7);
   assert.ok(p.y-p.radius>=b.top-1e-7&&p.y+p.radius<=b.bottom+1e-7);
   assert.ok(Math.abs((p.x-p.fromX)*dy-(p.y-p.fromY)*dx)<1e-7);
  }
  target.x=9999;assert.deepEqual(plan,snapshot);
  assert.ok(plan.intervalMs>plan.attacks.at(-1).warningMs+250);
 }
});
test('fissure hits six times in order; no repeat damage from cooling cracks, pauses, or cleared slots',()=>{
 let g;g=new Proxy({},{get:()=>()=>g});const hits=[];
 const h=new EncounterHazards({add:{graphics:()=>g}},(...args)=>hits.push(args));
 const plan=planBossAttack('lava_colossus',1,1,{x:360,y:300,speed:80},{x:360,y:630});
 const add=()=>{for(const a of plan.attacks)h.add(a.kind,a.x,a.y,10,1,a);};
 add();h.update(1099);assert.equal(hits.length,0);h.update(0);assert.equal(hits.length,0);h.update(1);
 for(let i=1;i<6;i++){assert.equal(hits.length,i);h.update(150);}
 assert.equal(hits.length,6);h.update(1000);assert.equal(hits.length,6);
 assert.deepEqual(hits.map(h=>h.slice(1,3)),plan.attacks.map(a=>[a.x,a.y]));
 add();h.clear();h.update(9999);assert.equal(hits.length,6);
});
test('lava meteor remains three simultaneous impacts across phases',()=>{
 for(const phase of [1,2,3]){
  const {attacks}=planBossAttack('lava_colossus',phase,0,{x:360,y:300,speed:80},{x:360,y:630});
  assert.equal(attacks.length,3);assert.ok(attacks.every(a=>a.kind==='METEOR'&&a.warningMs===1100));
 }
});
