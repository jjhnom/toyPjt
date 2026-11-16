import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load,fixture} from './helpers/skill-fixture.mjs';
const {BossMotion,bossMotionFrame}=load('src/ui/BossMotion.ts');
const {Enemy}=load('src/entities/Enemy.ts');

test('gait follows real displacement, stops at rest, and ignores room teleports',()=>{
 const m=new BossMotion();m.reset(100,100);
 const frames=[];for(let i=1;i<=4;i++){m.advance('forest_guardian',160,100+i*18,100,false,false);frames.push(m.frameIndex);}
 assert.deepEqual(frames,[1,2,3,0]);
 m.advance('forest_guardian',160,190,100,false,false);assert.equal(m.frameIndex,1);
 m.advance('forest_guardian',0,190,100,false,false);assert.equal(m.frameIndex,1);
 m.advance('forest_guardian',160,190,100,false,false);assert.equal(m.frameIndex,0);
 m.advance('forest_guardian',16,800,100,false,false);assert.equal(m.frameIndex,0);
 const slow=new BossMotion(),fast=new BossMotion();slow.reset(0,0);fast.reset(0,0);
 for(let i=1;i<=6;i++)slow.advance('forest_guardian',160,i*3,0,false,false);
 fast.advance('forest_guardian',160,18,0,false,false);assert.equal(slow.frameIndex,fast.frameIndex);
});

test('cast holds its ready pose until combat impact, then follows through and recovers without flipping',()=>{
 const m=new BossMotion();m.reset(200,200);m.advance('frost_queen',100,190,200,false,false);
 assert.equal(m.facingLeft,true);m.cast(1000);assert.equal(m.frameIndex,4);
 for(const frame of[5,6,7]){m.advance('frost_queen',250,210,200,false,false);assert.equal(m.frameIndex,frame);assert.equal(m.facingLeft,true);}
 m.advance('frost_queen',5000,210,200,false,false);assert.equal(m.frameIndex,7,'only actual impact may release a held cast');
 m.impact();assert.equal(m.frameIndex,8);
 for(const frame of[9,10,11]){m.advance('frost_queen',80,210,200,false,false);assert.equal(m.frameIndex,frame);}
 m.advance('frost_queen',80,210,200,false,false);assert.equal(m.frameIndex,0);
});

test('dash has priority over spell release, and resets cleanly on pooled enemy reuse',()=>{
 const m=new BossMotion();m.reset(0,0);m.cast(1000);m.impact();
 m.advance('twilight_king',0,0,0,true,true);assert.equal(m.frameIndex,0);assert.equal(m.facingLeft,true);
 m.advance('twilight_king',270,10,0,true,true);assert.equal(m.frameIndex,3);
 m.advance('twilight_king',0,10,0,false,true);assert.equal(m.frameIndex,10);
 const f=fixture([]),boss=new Enemy(f.scene,360,300);boss.spawn('BOSS_CORE',360,300);boss.bossMotion.cast(1000);
 boss.spawn('SWARMER',400,400);assert.equal(boss.bossMotion.frameIndex,0);assert.equal(boss.bossId,null);assert.equal(boss.alpha,1);
});

test('all five motion sheets have twelve transparent, unclipped runtime frames and stable canvas sizes',()=>{
 const atlas=JSON.parse(readFileSync('src/assets/boss-motion-v2/atlas.json','utf8'));
 const review=JSON.parse(readFileSync('src/assets/boss-motion-v2/frame-review.json','utf8'));
 const ids=['forest_guardian','swamp_lord','lava_colossus','frost_queen','twilight_king'];
 assert.equal(Object.keys(atlas.frames).length,72);assert.equal(review.length,60);
 for(const id of ids)for(let i=0;i<12;i++){
  const key=bossMotionFrame(id,i),f=atlas.frames[key].frame,r=review.find(r=>r.key===key);
  assert.equal(f.w,160);assert.equal(f.h,160);assert.ok(f.x+f.w<=atlas.meta.size.w&&f.y+f.h<=atlas.meta.size.h);
  assert.ok(r.opaque>500&&r.transparent>160*160*.15);assert.equal(r.clippedFaintPixels,0);
 }
});

