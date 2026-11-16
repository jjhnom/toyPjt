import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
const {BossMotion,bossMotionAtlas,DESERT_MOTION_ATLAS,BOSS_MOTION_ATLAS}=load('src/ui/BossMotion.ts');
test('expanded desert anticipation has eight poses and holds until actual damage cue',()=>{
 const m=new BossMotion();m.reset(360,300);m.cast(1200);const frames=[m.frameIndex];
 for(let i=0;i<7;i++){m.advance('desert_emperor',150,360,300,false,false,true);frames.push(m.frameIndex);}
 assert.deepEqual(frames,[4,5,6,7,8,9,10,11]);m.advance('desert_emperor',5000,360,300,false,false,true);assert.equal(m.frameIndex,11);
 m.impact(true);assert.equal(m.frameIndex,12);
});
test('desert release visits eight frames then returns to idle at 640ms across preview speeds',()=>{
 for(const speed of [.25,.5,1,2]){
  const m=new BossMotion();m.reset(360,300);m.impact(true);let age=0;const frames=new Set([m.frameIndex]);
  while(age<639){const dt=Math.min(1000/60*speed,639-age);m.advance('desert_emperor',dt,360,300,false,false,true);frames.add(m.frameIndex);age+=dt;}
  assert.deepEqual([...frames],[12,13,14,15,16,17,18,19]);m.advance('desert_emperor',0,360,300,false,false,true);assert.equal(m.frameIndex,19);
  m.advance('desert_emperor',1,360,300,false,false,true);assert.equal(m.frameIndex,0);
 }
});
test('other bosses and missing desert atlas retain the old twelve-frame motion contract',()=>{
 for(const [id,expanded]of [['desert_emperor',false],['twilight_king',true],['frost_queen',true]]){
  const m=new BossMotion();m.reset(0,0);m.cast(1200);m.advance(id,1200,0,0,false,false,expanded);assert.equal(m.frameIndex,7);
  m.impact();m.advance(id,319,0,0,false,false,expanded);assert.equal(m.frameIndex,11);m.advance(id,1,0,0,false,false,expanded);assert.equal(m.frameIndex,0);
 }
 assert.equal(bossMotionAtlas('desert_emperor'),DESERT_MOTION_ATLAS);assert.equal(bossMotionAtlas('twilight_king'),BOSS_MOTION_ATLAS);
});
test('generated desert frames use a single scale, transparent borders and a compact standalone atlas',()=>{
 const base='src/assets/desert-motion-v3/',atlas=JSON.parse(readFileSync(base+'atlas.json','utf8')),review=JSON.parse(readFileSync(base+'frame-review.json','utf8'));
 assert.equal(Object.keys(atlas.frames).length,20);assert.equal(review.length,16);assert.equal(new Set(review.map(r=>r.scale)).size,1);assert.ok(new Set(review.map(r=>r.hash)).size>=15);
 assert.ok(atlas.meta.size.w<=1024&&atlas.meta.size.h<=1024);
 for(let i=0;i<20;i++){const f=atlas.frames['desert_emperor_motion_'+i].frame;assert.equal(f.w,160);assert.equal(f.h,160);assert.ok(f.x+160<=atlas.meta.size.w&&f.y+160<=atlas.meta.size.h);}
 for(const r of review){assert.equal(r.edge,0);assert.ok(r.opaque>1000&&r.transparent>10000);}
});
