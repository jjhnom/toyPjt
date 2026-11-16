import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
const {BOSS_AREA_QUALITY,prepareBossAreaQuality,bossAreaStyle}=load('src/ui/bossAreaQuality.ts');
test('HD material generation is optional, bounded, cached and unavailable assets never block combat setup',()=>{
 let created=0;const textures={exists:()=>false,createCanvas:()=>{created++;throw Error('unavailable');}};
 assert.doesNotThrow(()=>prepareBossAreaQuality({textures}));assert.equal(created,9);
 textures.exists=()=>true;prepareBossAreaQuality({textures});assert.equal(created,9);
 assert.ok(210/BOSS_AREA_QUALITY.size<=BOSS_AREA_QUALITY.maxUpscale);
 assert.equal(bossAreaStyle({bossId:'twilight_king',kind:'FROST'}),'binding');
 assert.equal(bossAreaStyle({bossId:'twilight_king',kind:'POISON'}),'poison');
 assert.equal(bossAreaStyle({bossId:'frost_queen',kind:'FROST'}),'frost');
 assert.equal(bossAreaStyle({bossId:'frost_queen',kind:'SUMMON'}),'ice');
 assert.equal(bossAreaStyle({bossId:'twilight_king',kind:'METEOR'}),'void');
 assert.equal(bossAreaStyle({bossId:'twilight_king',kind:'SUMMON'}),'dark');
 assert.equal(bossAreaStyle({bossId:'twilight_king',kind:'CHARGE'}),undefined);
});

