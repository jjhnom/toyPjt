import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {planBossAttack}=load('src/config/bossData.ts');
const {ARENA_BOUNDS:b}=load('src/config/gameData.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const boss={x:360,y:300,speed:80};

test('five sand fangs have fixed distinct bounded sites, an escape gap, and 180ms cadence across phases and corners',()=>{
 for(const phase of [1,2,3])for(const [x,y]of [[360,630],[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom],[0,9999]]){
  const target={x,y},p=planBossAttack('desert_emperor',phase,1,boss,target),snapshot=structuredClone(p);
  assert.equal(p.attacks.length,5);assert.equal(new Set(p.attacks.map(a=>`${a.x},${a.y}`)).size,5);
  for(const [i,a]of p.attacks.entries()){
   assert.equal(a.kind,'SPIKES');assert.equal(a.warningMs,1000+i*180);assert.equal(a.radius,50);assert.equal(a.durationMs,250);
   assert.ok(a.x>=b.left+50&&a.x<=b.right-50);assert.ok(a.y>=b.top+50&&a.y<=b.bottom-50);
  }
  const first=p.attacks[0];
  const escape=Array.from({length:24},(_,i)=>({x:first.x+Math.cos(i*Math.PI/12)*100,y:first.y+Math.sin(i*Math.PI/12)*100}))
   .some(v=>v.x>=b.left+20&&v.x<=b.right-20&&v.y>=b.top+20&&v.y<=b.bottom-20&&p.attacks.every(a=>Math.hypot(a.x-v.x,a.y-v.y)>a.radius+20));
  assert.ok(escape,'a reachable safe gap must remain around the target');
  target.x=9999;assert.deepEqual(p,snapshot);
 }
});
test('storm always ends before the next fang telegraph, including late phases',()=>{
 for(const phase of [1,2,3]){
  const storm=planBossAttack('desert_emperor',phase,0,boss,{x:360,y:630});
  assert.ok(storm.intervalMs>=Math.max(...storm.attacks.map(a=>a.warningMs+a.durationMs))+400);
  const fangs=planBossAttack('desert_emperor',phase,1,boss,{x:360,y:630});
  assert.ok(fangs.intervalMs>fangs.attacks.at(-1).warningMs+600);
 }
});
test('fangs hit five times once each, pause with active delta, and clear without residual damage',()=>{
 let g;g=new Proxy({},{get:()=>()=>g});const hits=[];
 const h=new EncounterHazards({add:{graphics:()=>g}},(...args)=>hits.push(args));
 const p=planBossAttack('desert_emperor',1,1,boss,{x:360,y:630});
 const add=()=>{for(const a of p.attacks)h.add(a.kind,a.x,a.y,10,1,{...a,bossId:'desert_emperor'});};
 add();h.update(999,{x:600,y:800});assert.equal(hits.length,0);h.update(0);assert.equal(hits.length,0);h.update(1);
 for(let i=1;i<5;i++){assert.equal(hits.length,i);h.update(180,{x:600,y:800});}
 assert.equal(hits.length,5);assert.deepEqual(hits.map(h=>h.slice(1,3)),p.attacks.map(a=>[a.x,a.y]));
 h.update(1000);assert.equal(hits.length,5);add();h.clear();h.update(9999);assert.equal(hits.length,5);
});
