import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {bossGroundFootprint,bossGroundAtlas,placeBossArea,prepareBossGroundTextures}=load('src/ui/bossAreaGeometry.ts');
const ids=['forest_guardian','swamp_lord','lava_colossus','frost_queen','twilight_king'];
function image(key){return{texture:{key},setCrop(...crop){this.crop=crop;return this;},setOrigin(x,y=x){this.origin=[x,y];return this;},setPosition(x,y){this.position=[x,y];return this;},setDisplaySize(w,h){this.size=[w,h];return this;}};}
test('ground projections align to hazard centers and diameters for both atlases and all boss fields',()=>{
 for(const animated of [true,false])for(const id of ids)for(const kind of ['field','summon','impact'])for(const radius of [65,75,85,105]){
  const [x,y,w,h]=bossGroundFootprint(animated,id,kind);assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=96&&y+h<=96);
  const target=image(bossGroundAtlas(animated));target.setCrop(1,2,3,4);placeBossArea(target,animated,id,kind,360,630,radius,true);
  assert.deepEqual(target.position,[360,630]);assert.deepEqual(target.origin,[.5,.5]);assert.deepEqual(target.size,[radius*2,radius*2]);assert.deepEqual(target.crop,[]);
  const fallback=image('original');placeBossArea(fallback,animated,id,kind,360,630,radius,true);
  assert.ok(Math.abs((x-fallback.origin[0]*96)*fallback.size[0]/96+radius)<1e-8);
  assert.ok(Math.abs((y-fallback.origin[1]*96)*fallback.size[1]/96+radius)<1e-8);
  assert.ok(Math.abs(w*fallback.size[0]/96-radius*2)<1e-8);assert.ok(Math.abs(h*fallback.size[1]/96-radius*2)<1e-8);
 }
});
test('upright effects preserve aspect ratio and clear pooled image crops',()=>{
 for(const animated of [true,false])for(const id of ids){
  const target=image('original');target.setCrop(10,20,40,10);placeBossArea(target,animated,id,'impact',360,630,85);
  assert.equal(target.size[0],target.size[1]);assert.deepEqual(target.crop,[]);assert.deepEqual(target.position,[360,630]);
 }
});
test('optional ground cache reuses existing atlases and allocation failures do not interrupt combat setup',()=>{
 let attempts=0;
 const textures={exists:key=>!key.startsWith('boss_ground_'),get:()=>({has:()=>true}),createCanvas:()=>{attempts++;throw new Error('canvas unavailable');}};
 assert.doesNotThrow(()=>prepareBossGroundTextures({textures}));assert.equal(attempts,2);
 textures.exists=()=>true;prepareBossGroundTextures({textures});assert.equal(attempts,2);
});
