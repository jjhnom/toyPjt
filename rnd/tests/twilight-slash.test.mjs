import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {planBossAttack}=load('src/config/bossData.ts');
const {ARENA_BOUNDS:b}=load('src/config/gameData.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {segmentCircleEntry}=load('src/systems/sporeGeometry.ts');
const boss={x:360,y:300,speed:80};
test('two fixed diagonal capsules cross with 750ms between hits and bounded endpoints at every corner',()=>{
 for(const phase of [1,2,3])for(const [x,y]of [[360,630],[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom],[0,9999]]){
  const target={x,y},p=planBossAttack('twilight_king',phase,5,boss,target),snapshot=structuredClone(p);
  assert.equal(p.attacks.length,2);
  for(const [i,a]of p.attacks.entries()){
   assert.equal(a.kind,'SLASH');assert.equal(a.warningMs,1000+i*750);assert.equal(a.durationMs,250);assert.equal(a.radius,26);
   for(const [px,py]of [[a.x,a.y],[a.fromX,a.fromY]])assert.ok(px>=b.left+26-1e-7&&px<=b.right-26+1e-7&&py>=b.top+26-1e-7&&py<=b.bottom-26+1e-7);
   assert.ok(Math.hypot(a.x-a.fromX,a.y-a.fromY)>200);
   assert.equal(Math.sign((a.x-a.fromX)*(a.y-a.fromY)),i===0?1:-1);
  }
  const [a,c]=p.attacks;assert.ok(Math.abs((a.x-a.fromX)*(c.x-c.fromX)+(a.y-a.fromY)*(c.y-c.fromY))<1e-7);
  assert.ok(p.intervalMs>=2600);target.x=9999;assert.deepEqual(p,snapshot);
 }
});
test('actual slash capsules include the middle and endpoints, while the cleared first diagonal is safe from the second',()=>{
 const [a,b]=planBossAttack('twilight_king',1,5,boss,{x:360,y:630}).attacks;
 assert.ok(Number.isFinite(segmentCircleEntry(a.fromX,a.fromY,a.x,a.y,360,630,a.radius+18)));
 assert.ok(Number.isFinite(segmentCircleEntry(a.fromX,a.fromY,a.x,a.y,a.fromX,a.fromY,a.radius+18)));
 assert.ok(Number.isFinite(segmentCircleEntry(a.fromX,a.fromY,a.x,a.y,440,710,a.radius+18)));
 assert.equal(segmentCircleEntry(b.fromX,b.fromY,b.x,b.y,440,710,b.radius+18),Infinity);
});
test('slashes resolve once per line at their own deadline, preserve endpoints, pause and cancel on clear',()=>{
 let g;g=new Proxy({},{get:()=>()=>g});const hits=[];
 const h=new EncounterHazards({add:{graphics:()=>g}},(...args)=>{hits.push(args);});
 const p=planBossAttack('twilight_king',1,5,boss,{x:360,y:630});
 const add=()=>{for(const a of p.attacks)h.add(a.kind,a.x,a.y,10,1,a);};
 add();h.update(999);h.update(0);assert.equal(hits.length,0);h.update(1);assert.equal(hits.length,1);
 h.update(749);assert.equal(hits.length,1);h.update(1);assert.equal(hits.length,2);
 assert.deepEqual(hits.map(v=>v.slice(6)),p.attacks.map(a=>[a.fromX,a.fromY]));
 h.update(2000);assert.equal(hits.length,2);add();h.clear();h.update(9999);assert.equal(hits.length,2);
});
