import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
const {paintSandstormAir,SANDSTORM_SOURCE}=load('src/ui/bossSandstorm.ts');
test('reference sandstorm has twelve transparent frames with fixed scale and ground anchor',()=>{
 const base='src/assets/sandstorm-v1/',a=JSON.parse(readFileSync(base+'atlas.json','utf8')),r=JSON.parse(readFileSync(base+'frame-review.json','utf8'));
 assert.equal(Object.keys(a.frames).length,12);assert.equal(r.length,12);assert.equal(new Set(r.map(f=>f.scale)).size,1);
 for(let i=0;i<12;i++){const f=a.frames['sand_'+i].frame;assert.equal(f.w,192);assert.equal(f.h,192);assert.ok(f.x+192<=a.meta.size.w&&f.y+192<=a.meta.size.h);assert.deepEqual(r[i].anchor,[96,120]);assert.equal(r[i].red,0);assert.ok(r[i].transparent>20000&&r[i].opaque>300);}
});
test('sandstorm cache draws formation, hold and release directly from the new source frames',()=>{
 const calls=[],source={},scene={textures:{exists:key=>key===SANDSTORM_SOURCE,get:()=>({has:()=>true,get:name=>({source:{image:source},cutX:Number(name.split('_')[1])*192,cutY:0})})}},c={drawImage:(...a)=>calls.push(a)};
 for(const i of [0,3,4,7,8,11])paintSandstormAir(scene,c,i);
 assert.deepEqual(calls.map(a=>a[1]),[0,576,768,1344,1536,2112]);
 for(const a of calls){assert.equal(a[0],source);assert.deepEqual(a.slice(3),[192,192,0,0,192,192]);}
});
