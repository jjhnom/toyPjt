import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {planBossAttack}=load('src/config/bossData.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {segmentCircleEntry}=load('src/systems/sporeGeometry.ts');
const {ARENA_BOUNDS:b}=load('src/config/gameData.ts');
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-7,`${x} != ${y}`);
function harness(resolve=()=>{}){
 let g;g=new Proxy({},{get:()=>()=>g});
 const h=new EncounterHazards({add:{graphics:()=>g}},resolve);
 const add=(x=300,y=600,velocityX=160,velocityY=0)=>h.add('SPORES',x,y,10,1,{bossId:'swamp_lord',radius:18,warningMs:1000,durationMs:2700,velocityX,velocityY});
 return {h,add};
}
test('five spores lock a 120-degree fan with slow equal speed and usable gaps',()=>{
 const target={x:360,y:630},p=planBossAttack('swamp_lord',1,2,{x:360,y:300,speed:80},target),snapshot=structuredClone(p);
 assert.equal(p.attacks.length,5);
 const angles=p.attacks.map(a=>Math.atan2(a.velocityY,a.velocityX));
 for(const [i,a]of p.attacks.entries()){
  assert.equal(a.kind,'SPORES');assert.equal(a.radius,18);assert.equal(a.warningMs,1000);near(Math.hypot(a.velocityX,a.velocityY),160);
  if(i)near(angles[i]-angles[i-1],Math.PI/6);
 }
 assert.ok(2*200*Math.sin(Math.PI/12)-36>32);
 target.x=100;assert.deepEqual(p,snapshot);assert.ok(p.intervalMs>=4200);
});
test('spores stay still during the warning, advance by active delta and freeze at zero delta',()=>{
 const {h,add}=harness();add();const s=h.slots[0];
 h.update(999);assert.equal(s.x,300);h.update(1);assert.equal(s.x,300);h.update(500);near(s.x,380);
 h.update(0);near(s.x,380);h.update(-100);near(s.x,380);
});
test('swept collision detects crossing, tangency, stationary misses and starts inside',()=>{
 near(segmentCircleEntry(0,0,100,0,50,0,5),.45);
 near(segmentCircleEntry(0,0,100,0,50,5,5),.5);
 assert.equal(segmentCircleEntry(0,0,0,0,50,0,5),Infinity);
 assert.equal(segmentCircleEntry(50,0,50,0,50,0,5),0);
 assert.equal(segmentCircleEntry(0,10,100,10,50,0,5),Infinity);
});
test('a spore stops at its first swept hit and never damages a second target',()=>{
 let hits=0;
 const {h,add}=harness((_k,x,y,r,_d,_life,oldX,oldY)=>{
  const t=segmentCircleEntry(oldX,oldY,x,y,400,600,r+16);
  if(Number.isFinite(t)){hits++;return t;}
 });
 add();h.update(1000);h.update(1500);assert.equal(hits,1);near(h.slots[0].x,366);
 h.update(5000);assert.equal(hits,1);assert.equal(h.slots[0].active,false);
});
test('wall contact bursts exactly at the radius boundary and cleanup/reuse clears projectile state',()=>{
 const {h,add}=harness();add(b.right-56,600);h.update(1237.5);
 const s=h.slots[0];near(s.x,b.right-18);assert.equal(s.resolved,true);near(s.impactAge,1237.5);
 h.update(300);assert.equal(s.active,false);add();assert.equal(s.impactAge,null);assert.equal(s.resolved,false);
 h.clear();h.update(9999);assert.equal(s.active,false);
 h.add('SHOT',300,600,10,2);assert.equal(s.velocityX,0);assert.equal(s.velocityY,0);assert.equal(s.impactAge,null);
});
