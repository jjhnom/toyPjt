import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
const {BOSS_VFX_ATLAS,BOSS_VFX_MOTIONS,bossVfxFrameIndex,bossVfxFade}=load('src/config/bossVfxMotionData.ts');
const {BossVfxController}=load('src/ui/BossVfxController.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const atlas=JSON.parse(readFileSync('src/assets/boss-vfx-v2/atlas.json','utf8'));

function harness(animated=true,quality=false){
 class Image {
  visible=false;alpha=1;x=0;y=0;frame={name:''};texture={key:''};
  constructor(key,frame){this.setTexture(key,frame);}
  setTexture(key,frame){this.texture={key};this.frame={name:frame};return this;}
  setVisible(v){this.visible=v;return this;}setAlpha(a){this.alpha=a;return this;}
  setPosition(x,y){this.x=x;this.y=y;return this;}setMask(mask){this.mask=mask;return this;}
  setOrigin(x,y=x){this.originX=x;this.originY=y;return this;}setDepth(){return this;}setName(){return this;}clearTint(){return this;}
  setRotation(){return this;}setFlipX(){return this;}setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;}destroy(){}
  setCrop(...crop){this.crop=crop;return this;}
  clearMask(){this.mask=null;return this;}
 }
 let graphics;graphics=new Proxy({createGeometryMask:()=>({destroy(){}})},{get:(o,k)=>o[k]??(()=>graphics)});
 // Existing atlas tests also cover the cosmetic fallback when an HD allocation is unavailable.
 const scene={add:{image:(x,y,key,frame)=>new Image(key,frame),graphics:()=>graphics},textures:{exists:key=>key.startsWith('boss_ground_hd_')?quality:key!==BOSS_VFX_ATLAS||animated,get:key=>({has:frame=>key!==BOSS_VFX_ATLAS||!!atlas.frames[frame]})}};
 const source={active:true,lifeId:7,bossId:'twilight_king',x:360,y:300,impacts:0,showBossImpact(){this.impacts++;}};
 const vfx=new BossVfxController(scene,life=>life===7?source:undefined),damage=[];
 const hazards=new EncounterHazards(scene,(...args)=>damage.push(args),vfx);
 const step=delta=>{vfx.update(delta);hazards.update(delta);};return{source,vfx,hazards,step,damage};
}

test('HD ground rendering preserves the exact fallback damage callbacks for every boss area family',()=>{
 for(const [bossId,kind]of [['forest_guardian','METEOR'],['swamp_lord','POISON'],['lava_colossus','METEOR'],['frost_queen','FROST'],['frost_queen','SUMMON'],['twilight_king','METEOR'],['twilight_king','POISON'],['twilight_king','FROST'],['twilight_king','SUMMON']]){
  const baseline=harness(true,false),hd=harness(true,true);
  for(const h of [baseline,hd])h.hazards.add(kind,360,630,10,7,{bossId,radius:85,warningMs:1000,durationMs:kind==='POISON'||kind==='FROST'?2200:250});
  for(const dt of [999,1,70,120,60,100,300,5000,5000]){baseline.step(dt);hd.step(dt);assert.deepEqual(hd.damage,baseline.damage);}
  assert.equal(hd.vfx.activeCount,0);
 }
});

test('poison spreads from intro frames while dark binding assembles then locks, without delaying damage',()=>{
 const poison=harness(true,true),binding=harness(true,true);
 poison.hazards.add('POISON',250,630,10,7,{bossId:'swamp_lord',radius:75,warningMs:1000,durationMs:2400});
 binding.hazards.add('FROST',360,630,10,7,{bossId:'twilight_king',radius:85,warningMs:1000,durationMs:2200});
 for(const h of [poison,binding])h.step(750);
 assert.equal(poison.vfx.slots[0].floor.frame.name,'intro_0');assert.equal(binding.vfx.slots[0].floor.frame.name,'intro_1');
 assert.equal(poison.damage.length,0);assert.equal(binding.damage.length,0);
 for(const h of [poison,binding])h.step(250);
 assert.equal(poison.vfx.slots[0].floor.frame.name,'intro_0');assert.equal(binding.vfx.slots[0].floor.frame.name,'ground_0');
 for(const h of [poison,binding])h.step(120);
 assert.equal(poison.vfx.slots[0].floor.frame.name,'intro_2');assert.equal(binding.vfx.slots[0].floor.frame.name,'ground_1');
 assert.equal(poison.vfx.slots[0].floor.texture.key,'boss_ground_hd_poison');assert.equal(binding.vfx.slots[0].floor.texture.key,'boss_ground_hd_binding');
});

test('reference impacts play once and frost erupts once before switching to its low sustained crown',()=>{
 const meteor=harness(true,true);meteor.hazards.add('METEOR',360,630,10,7,{bossId:'twilight_king',radius:65,warningMs:1000,durationMs:250});
 meteor.step(1000);assert.equal(meteor.vfx.slots[0].flare.frame.name,'motes_0');meteor.step(70);assert.equal(meteor.vfx.slots[0].flare.frame.name,'motes_2');meteor.step(120);assert.equal(meteor.vfx.slots[0].flare.frame.name,'motes_4');meteor.step(450);assert.equal(meteor.vfx.slots[0].flare.frame.name,'motes_7');assert.equal(meteor.damage.length,1);
 const frost=harness(true,true);frost.hazards.add('FROST',360,630,10,7,{bossId:'frost_queen',radius:85,warningMs:1100,durationMs:2200});
 frost.step(1100);assert.equal(frost.vfx.slots[0].flare.frame.name,'motes_0');frost.step(180);assert.equal(frost.vfx.slots[0].flare.frame.name,'motes_2');frost.step(180);assert.equal(frost.vfx.slots[0].flare.frame.name,'motes_4');frost.step(720);assert.equal(frost.vfx.slots[0].flare.frame.name,'motes_4');assert.equal(frost.vfx.slots[0].floor.texture.key,'boss_ground_hd_frost');
});

test('dark binding erupts once, holds its chained cage and releases within the original hazard lifetime',()=>{
 const h=harness(true,true);
 h.hazards.add('FROST',360,630,10,7,{bossId:'twilight_king',radius:85,warningMs:1000,durationMs:2200});
 h.step(999);assert.equal(h.damage.length,0);h.step(1);
 const slot=h.vfx.slots[0];assert.equal(slot.flare.frame.name,'motes_0');
 h.step(180);assert.equal(slot.flare.frame.name,'motes_2');h.step(180);assert.equal(slot.flare.frame.name,'motes_4');
 h.step(720);assert.equal(slot.flare.frame.name,'motes_4');
 h.step(840);assert.equal(slot.flare.frame.name,'release_0');
 h.step(70);assert.equal(slot.flare.frame.name,'release_1');
 h.step(140);assert.equal(slot.flare.frame.name,'release_3');
 assert.equal(slot.flare.displayWidth,170);assert.equal(slot.flare.displayHeight,170);
 assert.equal(slot.flare.x,360);assert.equal(slot.flare.y,630);assert.equal(slot.flare.mask,slot.mask);
 h.step(70);assert.equal(h.vfx.activeCount,0);assert.equal(slot.flare.visible,false);
});

test('sand dust and lifted vortex share the same animation frame, center and boundary through formation and looping',()=>{
 const h=harness(true,true);h.hazards.add('POISON',360,630,10,7,{bossId:'desert_emperor',radius:90,warningMs:1200,durationMs:2400});
 h.step(1200);
 for(const dt of [0,90,90,90,90,360,90,270]){
  h.step(dt);const s=h.vfx.slots[0];assert.equal(s.floor.texture.key,'boss_ground_hd_sand');
  assert.equal(s.floor.frame.name.replace('ground_',''),s.flare.frame.name.replace('motes_',''));
  assert.equal(s.floor.x,360);assert.equal(s.floor.y,630);assert.equal(s.floor.displayWidth,180);assert.equal(s.floor.displayHeight,180);
  for(const image of s.swirls)if(image.visible){assert.ok(Math.hypot(image.x-360,image.y-630)+image.displayWidth/2<=90);assert.equal(image.mask,s.mask);}
 }
 h.step(2400);assert.equal(h.vfx.activeCount,0);
});

test('reference sandstorm collapses over its final 360ms without extending combat lifetime',()=>{
 const h=harness(true,true);h.hazards.add('POISON',360,630,10,7,{bossId:'desert_emperor',radius:90,warningMs:1200,durationMs:2400});
 h.step(1200);assert.equal(h.vfx.slots[0].flare.frame.name,'motes_0');h.step(360);assert.equal(h.vfx.slots[0].flare.frame.name,'motes_4');
 h.step(1680);assert.equal(h.vfx.slots[0].flare.frame.name,'release_0');
 h.step(90);assert.equal(h.vfx.slots[0].flare.frame.name,'release_1');
 h.step(180);assert.equal(h.vfx.slots[0].flare.frame.name,'release_3');h.step(90);assert.equal(h.vfx.activeCount,0);
});

test('three sand swirls emerge in sequence, roam continuously inside the hazard and reuse their images',()=>{
 const h=harness(true,true);const add=()=>h.hazards.add('POISON',360,630,10,7,{bossId:'desert_emperor',radius:90,warningMs:1200,durationMs:2400});
 add();h.step(1200);const slot=h.vfx.slots[0],images=[...slot.swirls];assert.equal(images.filter(i=>i.visible).length,1);
 h.step(100);assert.equal(images.filter(i=>i.visible).length,2);h.step(100);assert.equal(images.filter(i=>i.visible).length,3);
 const before=images.map(i=>[i.x,i.y]);h.step(300);
 for(let i=0;i<3;i++){assert.notDeepEqual([images[i].x,images[i].y],before[i]);assert.ok(Math.hypot(images[i].x-360,images[i].y-630)+images[i].displayWidth/2<=90);}
 const frozen=images.map(i=>[i.x,i.y]);h.step(0);assert.deepEqual(images.map(i=>[i.x,i.y]),frozen);
 h.step(2400);assert.ok(images.every(i=>!i.visible));add();h.step(1400);assert.deepEqual(h.vfx.slots[0].swirls,images);
 h.hazards.clear();h.hazards.add('FROST',360,630,10,7,{bossId:'frost_queen',radius:85,warningMs:1000,durationMs:2200});h.step(1000);
 assert.ok(images.slice(1).every(i=>!i.visible));assert.equal(h.vfx.slots[0].floor.texture.key,'boss_ground_hd_frost');
});

test('forest slam reaches its full 105px boundary on the damage tick and restores masks on pooled reuse',()=>{
 for(const animated of [true,false]){
  const h=harness(animated);h.source.bossId='forest_guardian';
  h.hazards.add('METEOR',360,360,10,7,{bossId:'forest_guardian',radius:105,warningMs:1000,durationMs:250});
  h.step(999);assert.equal(h.damage.length,0);assert.equal(h.vfx.slots[0].floor.visible,false);
  h.step(1);assert.equal(h.damage.length,1);const slot=h.vfx.slots[0];
  assert.equal(slot.floor.texture.key,animated?'forest_slam_core_v2':'forest_slam_core_v1');assert.equal(slot.floor.frame.name,'forest_slam_core_0');
  assert.equal(slot.floor.x,360);assert.equal(slot.floor.y,360);assert.equal(slot.floor.originX,.5);assert.equal(slot.floor.originY,.5);
  assert.equal(slot.floor.displayWidth,210);assert.equal(slot.floor.displayHeight,210);assert.equal(slot.floor.mask,slot.mask);assert.equal(slot.flare.mask,null);
  for(let i=0;i<7;i++){h.step(60);assert.equal(slot.floor.displayWidth,210);assert.equal(slot.floor.displayHeight,210);}
  assert.equal(h.damage.length,1);h.step(1000);assert.equal(h.vfx.activeCount,0);
  h.hazards.clear();h.source.bossId='lava_colossus';h.hazards.add('METEOR',360,630,10,7,{bossId:'lava_colossus',radius:75,warningMs:1100});
  h.step(900);assert.equal(h.vfx.slots[0],slot);assert.equal(slot.flare.mask,slot.mask);
  h.step(200);assert.equal(slot.floor.mask,slot.mask);assert.deepEqual(slot.flare.crop,[]);
 }
});

test('lava impact resolves three simultaneous hits once and cosmetic scorch expires at 650ms',()=>{
 const h=harness();h.source.bossId='lava_colossus';
 for(const x of [210,360,510])h.hazards.add('METEOR',x,630,10,7,{bossId:'lava_colossus',radius:75,warningMs:1100,durationMs:250});
 h.step(1099);assert.equal(h.damage.length,0);h.step(1);assert.equal(h.damage.length,3);
 h.step(190);const slots=h.vfx.slots.filter(s=>s?.active);
 assert.equal(new Set(slots.map(s=>s.floor.frame.name)).size,3);
 for(const s of slots){assert.equal(s.floor.displayWidth*60/64,150);assert.equal(s.floor.y,630);assert.equal(s.floor.originX,.5);}
 h.step(60);h.step(399);assert.equal(h.vfx.activeCount,3);assert.equal(h.damage.length,3);
 h.step(1);assert.equal(h.vfx.activeCount,0);assert.equal(h.damage.length,3);
});

test('twilight meteor retains four simultaneous 65px hits and clears its purple visual tail at 650ms',()=>{
 const h=harness();for(const [x,y]of [[360,480],[360,780],[210,630],[510,630]])h.hazards.add('METEOR',x,y,10,7,{bossId:'twilight_king',radius:65,warningMs:1000,durationMs:250});
 h.step(999);assert.equal(h.damage.length,0);h.step(1);assert.equal(h.damage.length,4);h.step(190);
 for(const s of h.vfx.slots.filter(s=>s?.active)){assert.equal(s.floor.texture.key,'twilight_meteor_v1');assert.ok(Math.abs(s.floor.displayWidth*60/64-130)<1e-9);assert.equal(s.floor.x,s.state.x);assert.equal(s.floor.y,s.state.y);}
 h.step(60);h.step(399);assert.equal(h.vfx.activeCount,4);h.step(1);assert.equal(h.vfx.activeCount,0);assert.equal(h.damage.length,4);
});

test('176 VFX frames are available, transparent and mapped to complete eight-frame tracks',()=>{
 const review=JSON.parse(readFileSync('src/assets/boss-vfx-v2/frame-review.json','utf8'));
 assert.equal(Object.keys(atlas.frames).length,176);assert.equal(review.length,176);
 for(const[id,kinds]of Object.entries(BOSS_VFX_MOTIONS))for(const[kind,count]of Object.entries(kinds)){
  assert.equal(count,8);
  for(let i=0;i<count;i++){const f=atlas.frames[`${id}_${kind}_${i}`].frame;assert.equal(f.w,96);assert.equal(f.h,96);assert.ok(f.x+f.w<=1024&&f.y+f.h<=1824);}
 }
 for(const r of review)assert.ok(r.opaque>=5&&r.transparent>=2000);
 const dark=review.filter(r=>r.key.startsWith('twilight_king_summon_')||r.key.startsWith('twilight_king_impact_'));
 assert.ok(dark.reduce((n,r)=>n+r.purple,0)>dark.reduce((n,r)=>n+r.blue,0)*100,'king restraint/impact must remain purple rather than queen ice');
});

test('new loop sampling preserves cycle duration and smooth fades stay within zero and one',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>bossVfxFrameIndex(i/8,8)),[0,1,2,3,4,5,6,7]);
 assert.equal(bossVfxFrameIndex(1,8),7);assert.equal(bossVfxFrameIndex(-1,8),0);
 assert.deepEqual(Array.from({length:9},(_,i)=>bossVfxFrameIndex(i*.5,8,true)),[0,1,2,3,4,5,6,7,0]);
 assert.equal(bossVfxFrameIndex(4,4,true),0);
 let previous=1;for(let elapsed=-10;elapsed<=500;elapsed+=10){const alpha=bossVfxFade(elapsed,420);assert.ok(alpha>=0&&alpha<=previous);previous=alpha;}
 assert.equal(bossVfxFade(0,420),1);assert.equal(bossVfxFade(420,420),0);
});

test('impact starts once, tail age is not counted twice, and zero delta freezes the remaining visual',()=>{
 const h=harness();h.hazards.add('METEOR',360,650,10,7,{bossId:'twilight_king',warningMs:1000,durationMs:250});
 h.step(999);assert.equal(h.damage.length,0);h.step(1);assert.equal(h.damage.length,1);assert.equal(h.source.impacts,1);
 h.step(250);const slot=h.vfx.slots[0];assert.equal(slot.elapsed,0);assert.equal(slot.released,true);
 h.step(40);assert.equal(slot.elapsed,40);assert.equal(slot.flare.texture.key,'twilight_meteor_v1');assert.equal(slot.flare.frame.name,'lava_air_0_9');
 const frame=slot.flare.frame.name,alpha=slot.flare.alpha;h.step(0);assert.equal(slot.flare.frame.name,frame);assert.equal(slot.flare.alpha,alpha);
 slot.floor.setTexture=()=>{throw Error('Texture upload failed');};
 h.hazards.add('SHOT',360,650,10,7,{warningMs:80});
 assert.doesNotThrow(()=>h.step(80));assert.equal(h.vfx.activeCount,0);assert.equal(h.damage.length,2,'visual update failure must not suppress the next real attack');
});

test('persistent eight-frame loops expire with combat and reuse the same masks across queen and king, with legacy fallback',()=>{
 const h=harness();let mask;
 for(const id of['frost_queen','twilight_king']){
  h.hazards.add('FROST',360,650,10,7,{bossId:id,warningMs:1000,durationMs:2200});h.step(1000);
  const slot=h.vfx.slots[0];if(mask)assert.equal(slot.mask,mask);mask=slot.mask;
  const frames=new Set([slot.floor.frame.name]);for(let i=0;i<7;i++){h.step(90);frames.add(slot.floor.frame.name);}
  assert.equal(frames.size,8);assert.equal(slot.floor.texture.key,'boss_ground_v2');
  assert.ok([...frames].every(f=>f.startsWith(id+(id==='twilight_king'?'_summon_':'_field_'))));
  h.step(2200-630-80);assert.ok(slot.floor.alpha>0&&slot.floor.alpha<.7,'field fades near its real deadline');
  h.step(80);assert.equal(h.vfx.activeCount,0);assert.equal(slot.floor.visible,false);
 }
 const legacy=harness(false);legacy.hazards.add('FROST',360,650,10,7,{bossId:'twilight_king',warningMs:1000,durationMs:2200});legacy.step(1000);
 assert.equal(legacy.vfx.slots[0].floor.frame.name,'twilight_king_summon_0');assert.equal(legacy.vfx.slots[0].floor.texture.key,'boss_ground_v1');
 h.vfx.clear();assert.equal(h.vfx.activeCount,0);
});
