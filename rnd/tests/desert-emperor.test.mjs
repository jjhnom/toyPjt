import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
const {BOSS_PROFILES,planBossAttack,isBossId}=load('src/config/bossData.ts');
const {getStageDefinition,STAGES}=load('src/config/stageData.ts');
const {bossAreaStyle}=load('src/ui/bossAreaQuality.ts');
const {BossMotion}=load('src/ui/BossMotion.ts');
test('desert emperor enters endless S6 and S12 while the original story final boss remains intact',()=>{
 assert.equal(isBossId('desert_emperor'),true);assert.equal(STAGES.length,5);assert.equal(STAGES[4].bossId,'twilight_king');assert.equal(STAGES[4].isFinal,true);
 for(const n of [5,11,17,995])assert.equal(getStageDefinition(n).bossId,'desert_emperor');
 assert.equal(getStageDefinition(6).bossId,'forest_guardian');assert.equal(getStageDefinition(10).bossId,'twilight_king');
});
test('sandstorm locks bounded circular targets, phases add one zone and do not introduce ice slow or poison artwork',()=>{
 const target={x:360,y:630},boss={x:360,y:300,speed:105};
 for(const phase of [1,2,3]){
  const p=planBossAttack('desert_emperor',phase,0,boss,target);assert.equal(p.attacks.length,phase===1?1:2);
  for(const a of p.attacks){assert.equal(a.kind,'POISON');assert.equal(a.radius,90);assert.equal(a.warningMs,1200);assert.equal(a.durationMs,2400);assert.equal(bossAreaStyle({bossId:'desert_emperor',kind:a.kind}),'sand');}
  target.x+=1;assert.notEqual(p.attacks[0].x,target.x);target.x-=1;
 }
 assert.deepEqual(BOSS_PROFILES.desert_emperor.patterns,['POISON']);
});
test('all twelve desert motion frames and static fallback poses exist within mobile atlas limits',()=>{
 for(const [dir,size,names]of [['boss-motion-v2',160,Array.from({length:12},(_,i)=>'motion_'+i)],['bosses-v1',192,['idle','cast','charge']]]){
  const a=JSON.parse(readFileSync(`src/assets/${dir}/atlas.json`,'utf8'));assert.ok(a.meta.size.h<=2048);
  for(const suffix of names){const f=a.frames['desert_emperor_'+suffix].frame;assert.equal(f.w,size);assert.equal(f.h,size);assert.ok(f.x+f.w<=a.meta.size.w&&f.y+f.h<=a.meta.size.h);}
 }
 const m=new BossMotion();m.reset(0,0);m.cast(1200);m.advance('desert_emperor',1199,0,0,false,false);assert.equal(m.frameIndex,7);m.impact();assert.equal(m.frameIndex,8);m.advance('desert_emperor',320,0,0,false,false);assert.equal(m.frameIndex,0);
});
