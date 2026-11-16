import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {prepareTwilightMeteorTextures,TWILIGHT_METEOR_ATLAS}=load('src/ui/twilightMeteorVfx.ts');
test('twilight palette cache skips existing textures and allocation failure preserves combat initialization',()=>{
 let created=0;const textures={exists:key=>key==='lava_meteor_v1',get:()=>({getSourceImage:()=>({width:544,height:884})}),createCanvas:()=>{created++;throw Error('unavailable');}};
 assert.doesNotThrow(()=>prepareTwilightMeteorTextures({textures}));assert.equal(created,1);
 textures.exists=()=>true;prepareTwilightMeteorTextures({textures});assert.equal(created,1);assert.equal(TWILIGHT_METEOR_ATLAS,'twilight_meteor_v1');
});
