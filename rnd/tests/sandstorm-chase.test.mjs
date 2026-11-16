import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {ARENA_BOUNDS}=load('src/config/gameData.ts');
const {DESERT_STORM_CHASE_SPEED}=load('src/config/bossData.ts');

function harness(){
 let graphics;graphics=new Proxy({},{get:()=>()=>graphics});
 const hits=[],draws=[];
 const hazards=new EncounterHazards({add:{graphics:()=>graphics}},(...args)=>hits.push(args),{
  start(){},draw(_i,state){draws.push({...state});},end(){},clear(){}
 });
 const add=(bossId='desert_emperor',kind='POISON',x=300,y=600)=>hazards.add(kind,x,y,10,1,{bossId,warningMs:1200,durationMs:2400,radius:90});
 return {hazards,hits,draws,add};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('sandstorm telegraph stays put; active center, visuals and damage follow the live target',()=>{
 const h=harness(),target={x:600,y:600};h.add();
 h.hazards.update(1199,target);assert.equal(h.draws.at(-1).x,300);assert.equal(h.hits.length,0);
 h.hazards.update(1,target);assert.equal(h.hits.at(-1)[1],300);
 h.hazards.update(500,target);near(h.hits.at(-1)[1],300+DESERT_STORM_CHASE_SPEED*.5);
 assert.equal(h.draws.at(-1).x,h.hits.at(-1)[1]);
 target.x=100;
 h.hazards.update(250,target);near(h.hits.at(-1)[1],300+DESERT_STORM_CHASE_SPEED*.25);
 const position=h.draws.at(-1).x;
 h.hazards.update(0,target);h.hazards.update(-500,target);near(h.draws.at(-1).x,position);
});

test('movement accounts only for active lifetime, independently of frame size',()=>{
 const target={x:600,y:900},run=steps=>{
  const h=harness();h.add();for(const dt of steps)h.hazards.update(dt,target);return h;
 };
 const coarse=run([1500]),fine=run(Array(150).fill(10));
 near(coarse.draws.at(-1).x,fine.draws.at(-1).x);near(coarse.draws.at(-1).y,fine.draws.at(-1).y);
 near(Math.hypot(coarse.draws.at(-1).x-300,coarse.draws.at(-1).y-600),DESERT_STORM_CHASE_SPEED*.3);
 const expired=run([9000]),last=expired.draws.at(-1);
 near(Math.hypot(last.x-300,last.y-600),DESERT_STORM_CHASE_SPEED*2.4);
 const count=expired.hits.length;expired.hazards.update(100,target);assert.equal(expired.hits.length,count);
});

test('sandstorm stops at the target, remains bounded, and tolerates a missing target',()=>{
 const h=harness();h.add();h.hazards.update(1200);
 h.hazards.update(1000,{x:305,y:600});assert.equal(h.draws.at(-1).x,305);
 h.hazards.update(100);assert.equal(h.draws.at(-1).x,305);
 for(const x of [ARENA_BOUNDS.left+90,ARENA_BOUNDS.right-90])for(const y of [ARENA_BOUNDS.top+90,ARENA_BOUNDS.bottom-90]){
  const edge=harness();edge.add('desert_emperor','POISON',x,y);edge.hazards.update(2000,{x:x<360?-999:9999,y:y<630?-999:9999});
  const s=edge.draws.at(-1);assert.ok(s.x>=ARENA_BOUNDS.left+90&&s.x<=ARENA_BOUNDS.right-90);
  assert.ok(s.y>=ARENA_BOUNDS.top+90&&s.y<=ARENA_BOUNDS.bottom-90);
 }
});

test('other hazards remain fixed and clearing or pooled reuse cannot retain chase movement',()=>{
 for(const [bossId,kind]of [['swamp_lord','POISON'],['twilight_king','FROST'],['desert_emperor','METEOR']]){
  const h=harness();h.add(bossId,kind);h.hazards.update(1800,{x:600,y:800});assert.equal(h.draws.at(-1).x,300);assert.equal(h.draws.at(-1).y,600);
 }
 const h=harness();h.add();h.hazards.update(1600,{x:600,y:600});h.hazards.clear();
 const count=h.hits.length;h.hazards.update(1000,{x:600,y:600});assert.equal(h.hits.length,count);
 h.add('swamp_lord');h.hazards.update(1600,{x:600,y:600});assert.equal(h.draws.at(-1).x,300);
});
