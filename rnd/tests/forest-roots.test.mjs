import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {planBossAttack}=load('src/config/bossData.ts');
const {ARENA_BOUNDS:b}=load('src/config/gameData.ts');
const {segmentCircleEntry}=load('src/systems/sporeGeometry.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const boss={x:360,y:300,speed:80};
test('root enclosure has seven fixed sites with bounded radii and a wide traversable exit at corners too',()=>{
 for(const phase of [1,2,3])for(const [x,y]of [[360,630],[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom],[0,9999]]){
  const target={x,y},p=planBossAttack('forest_guardian',phase,2,boss,target),snapshot=structuredClone(p);
  assert.equal(p.attacks.length,7);const a=p.attacks[0],cx=a.fromX,cy=a.fromY;
  const gap=Math.atan2(a.y-cy,a.x-cx)-Math.PI/3,exitX=cx+Math.cos(gap)*220,exitY=cy+Math.sin(gap)*220;
  assert.ok(exitX>b.left+18&&exitX<b.right-18&&exitY>b.top+18&&exitY<b.bottom-18);
  for(const [i,r]of p.attacks.entries()){
   assert.equal(r.kind,'ROOTS');assert.equal(r.warningMs,1000+i*100);assert.equal(r.durationMs,900);assert.equal(r.radius,42);
   assert.ok(Math.abs(Math.hypot(r.x-cx,r.y-cy)-140)<1e-7);
   assert.ok(r.x-r.radius>=b.left-1e-7&&r.x+r.radius<=b.right+1e-7&&r.y-r.radius>=b.top-1e-7&&r.y+r.radius<=b.bottom+1e-7);
   assert.equal(segmentCircleEntry(cx,cy,exitX,exitY,r.x,r.y,r.radius+18),Infinity);
  }
  assert.ok(p.intervalMs>=2500+300);target.x=9999;assert.deepEqual(p,snapshot);
 }
});
test('roots warn, grow sequentially, remain dangerous only while active, pause and clear without leftovers',()=>{
 let g;g=new Proxy({},{get:()=>()=>g});const hits=[];
 const h=new EncounterHazards({add:{graphics:()=>g}},(...args)=>{hits.push(args);});
 const p=planBossAttack('forest_guardian',1,2,boss,{x:360,y:630});
 for(const a of p.attacks)h.add(a.kind,a.x,a.y,10,1,a);
 h.update(999);assert.equal(hits.length,0);h.update(0);assert.equal(hits.length,0);
 h.update(1);assert.equal(hits.length,1);assert.equal(h.slots.filter(s=>s.resolved).length,1);
 h.update(100);assert.equal(h.slots.filter(s=>s.resolved).length,2);
 const firstHits=hits.filter(v=>v[1]===p.attacks[0].x&&v[2]===p.attacks[0].y).length;
 assert.equal(firstHits,2);
 h.clear();const n=hits.length;h.update(9999);assert.equal(hits.length,n);assert.ok(h.slots.every(s=>!s.active));
});
