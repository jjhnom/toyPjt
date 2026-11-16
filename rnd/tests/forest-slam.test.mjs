import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
const {forestSlamVisual,forestSlamFrameIndex,placeForestSlamDebris,prepareForestSlamTextures}=load('src/ui/forestSlamVfx.ts');
const {planBossAttack}=load('src/config/bossData.ts');
test('forest-only footprint tracks map actual atlas frames without changing phase 1–3 attack contracts',()=>{
 for(const animated of [true,false]){
  const config=forestSlamVisual(animated),atlas=JSON.parse(readFileSync(`src/assets/${animated?'boss-vfx-v2':'bosses-v1'}/atlas.json`));
  assert.equal(config.footprints.length,animated?8:4);
  for(const [i,[x,y,w,h]]of config.footprints.entries()){
   assert.ok(atlas.frames[`forest_guardian_impact_${i}`]);assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=96&&y+h<=96);
   assert.ok(w<=config.decorWidth);assert.equal(forestSlamFrameIndex(animated,config.playMs*i/config.footprints.length+.001),i);
  }
  assert.equal(forestSlamFrameIndex(animated,0),0);assert.equal(forestSlamFrameIndex(animated,5000),config.footprints.length-1);
 }
 for(const phase of [1,2,3]){
  const attack=planBossAttack('forest_guardian',phase,1,{x:360,y:360,speed:80},{x:600,y:900}).attacks[0];
  assert.deepEqual(attack,{kind:'METEOR',x:360,y:360,radius:105,warningMs:1000,durationMs:250});
 }
});
test('forest debris uses centered radial frames with fixed scale and clears old upper-only crops',()=>{
 for(const animated of [true,false]){
  const config=forestSlamVisual(animated),sizes=[];
  const image={setTexture(key,frame){this.key=key;this.frame=frame;return this;},setOrigin(x,y=x){this.origin=[x,y];return this;},setPosition(x,y){this.position=[x,y];return this;},setDisplaySize(w,h){sizes.push([w,h]);return this;},setCrop(...args){this.crop=args;return this;},clearMask(){this.mask=null;return this;}};
  for(let i=0;i<config.footprints.length;i++){
   placeForestSlamDebris(image,animated,i,360,360,105);assert.deepEqual(image.position,[360,360]);assert.equal(image.mask,null);
   assert.deepEqual(image.crop,[]);assert.deepEqual(image.origin,[.5,.5]);assert.equal(image.key,animated?'forest_slam_debris_v2':'forest_slam_debris_v1');assert.equal(image.frame,`forest_slam_debris_${i}`);
  }
  assert.ok(sizes.every(s=>s[0]===sizes[0][0]&&s[1]===sizes[0][0]));
 }
});
test('optional forest texture allocation failure leaves combat initialization available',()=>{
 let attempts=0;const textures={exists:k=>!k.startsWith('forest_slam_core_'),get:()=>({}),createCanvas:()=>{attempts++;throw new Error('unavailable');}};
 assert.doesNotThrow(()=>prepareForestSlamTextures({textures}));assert.equal(attempts,2);
 textures.exists=()=>true;prepareForestSlamTextures({textures});assert.equal(attempts,2);
});
