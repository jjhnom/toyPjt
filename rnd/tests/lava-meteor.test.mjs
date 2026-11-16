import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {LAVA_METEOR,lavaMeteorIndex,lavaMeteorVariant,prepareLavaMeteorTextures}=load('src/ui/lavaMeteorVfx.ts');
const {planBossAttack}=load('src/config/bossData.ts');
test('lava visual phases are ordered and position variants are deterministic without attack delays',()=>{
 assert.equal(LAVA_METEOR.fallMs,150);assert.equal(LAVA_METEOR.endMs,650);
 assert.equal(lavaMeteorIndex(0),0);assert.equal(lavaMeteorIndex(190),7);assert.equal(lavaMeteorIndex(1000),14);
 for(let i=1;i<LAVA_METEOR.times.length;i++)assert.ok(LAVA_METEOR.times[i]>LAVA_METEOR.times[i-1]);
 assert.equal(new Set([210,360,510].map(x=>lavaMeteorVariant(x,630))).size,3);
 assert.equal(lavaMeteorVariant(360,630),lavaMeteorVariant(360,630));
 for(const phase of [1,2,3]){
  const {attacks}=planBossAttack('lava_colossus',phase,0,{x:360,y:360,speed:80},{x:360,y:630});
  assert.deepEqual(attacks.map(a=>[a.x,a.y,a.radius,a.warningMs,a.durationMs]),[210,360,510].map(x=>[x,630,65+phase*5,1100,250]));
 }
});
test('lava atlas is reused and cosmetic allocation failure cannot block combat setup',()=>{
 let allocations=0;const textures={exists:()=>false,createCanvas:()=>{allocations++;throw Error('unavailable');}};
 assert.doesNotThrow(()=>prepareLavaMeteorTextures({textures}));assert.equal(allocations,1);
 textures.exists=()=>true;prepareLavaMeteorTextures({textures});assert.equal(allocations,1);
});
