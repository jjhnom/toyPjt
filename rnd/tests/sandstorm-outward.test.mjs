import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {sandstormSpread}=load('src/ui/bossAreaQuality.ts');
test('sandstorm starts at the center, expands monotonically and never wraps inward at any playback speed',()=>{
 assert.equal(sandstormSpread(-1,2400),0);assert.equal(sandstormSpread(0,2400),0);
 for(const delay of [0,100,200])for(const speed of [.25,.5,1,2]){
  const duration=2400-delay;let previous=0;
  for(let age=0;age<=duration+100;age+=1000/60*speed){const spread=sandstormSpread(age,duration);assert.ok(spread>=previous&&spread<=1);previous=spread;}
  assert.equal(sandstormSpread(duration,duration),1);assert.equal(sandstormSpread(duration*2,duration),1);
 }
});
test('outward scale and reach leave every full vortex envelope inside the unchanged radius',()=>{
 for(const [start,end,reach]of [[.74,.36,.61],[.6,.3,.67],[.5,.26,.71]]){
  for(let age=0;age<=2400;age+=10){const u=sandstormSpread(age,2400),scale=start+(end-start)*u;assert.ok(scale+reach*u<=.970001);}
 }
});
