import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
import {FakeAudioContext,flush} from './helpers/fake-audio.mjs';
const {SoundManager}=load('src/systems/SoundManager.ts');
const {BossAudioController}=load('src/systems/BossAudioController.ts');
const {EncounterHazards}=load('src/entities/EncounterHazards.ts');
const {BOSS_IDS,BOSS_PROFILES,planBossAttack}=load('src/config/bossData.ts');
const {BOSS_SOUND_IDS,bossSkillSound}=load('src/config/bossSoundData.ts');
const scene=()=>{let g;g=new Proxy({},{get:()=>()=>g});return{add:{graphics:()=>g}};};
const fakeSound=()=>({events:[],playBoss(id){this.events.push(id);},stopBossSound(){},startBossLoop(id){this.events.push(['start',id]);},stopBossLoop(id){this.events.push(['stop',id]);},stopAllBossAudio(){this.events.push('clear');}});
const mixer=async()=>{
 const ctx=new FakeAudioContext();let time=0;
 const sound=new SoundManager({createContext:()=>ctx,now:()=>time,loadSample:async()=>new ArrayBuffer(8)});
 await sound.preloadBossSounds();await sound.unlockFromUserGesture();await flush();
 return{ctx,sound,advance(ms){time+=ms;ctx.advance(ms);}};
};

test('26 shipped boss files match supplied assets, and all 19 real skills use the correct identities',()=>{
 assert.equal(BOSS_SOUND_IDS.length,26);
 for(const id of BOSS_SOUND_IDS){
  const bytes=readFileSync(`public/audio/boss/${id}.ogg`),folder=id.endsWith('_fall')||id.endsWith('_impact')?'extras':'ogg';
  assert.equal(bytes.subarray(0,4).toString(),'OggS');
  assert.deepEqual(bytes,readFileSync(`.agent/skills/sound/20261113/rnd_boss_sfx_v1/${folder}/${id}.ogg`));
 }
 let count=0;
 for(const id of BOSS_IDS)for(const pattern of BOSS_PROFILES[id].patterns){assert.ok(bossSkillSound(id,pattern));count++;}
 assert.equal(count,19);
 assert.equal(bossSkillSound('desert_emperor','POISON').cast,'boss_desert_sandstorm_cast');
 assert.equal(bossSkillSound('twilight_king','FROST').cast,'boss_twilight_binding');
 assert.equal(bossSkillSound('forest_guardian','FROST'),undefined);
});

test('all skills warn once per plan, follow their cast policy and retain identical damage callbacks',()=>{
 for(const id of BOSS_IDS)for(let sequence=0;sequence<BOSS_PROFILES[id].patterns.length;sequence++){
  const plan=planBossAttack(id,3,sequence,{x:360,y:300,speed:105},{x:360,y:650});
  const sound=fakeSound(),audio=new BossAudioController(sound),heard=[],silent=[];
  const h=new EncounterHazards(scene(),(...a)=>heard.push(a),undefined,audio);
  const baseline=new EncounterHazards(scene(),(...a)=>silent.push(a));
  for(const attack of plan.attacks){
   const options={...attack,bossId:id,patternId:sequence+1};
   h.add(attack.kind,attack.x,attack.y,35,7,options);baseline.add(attack.kind,attack.x,attack.y,35,7,options);
  }
  const warning=plan.attacks[0].warningMs,skill=bossSkillSound(id,plan.attacks[0].kind);
  assert.deepEqual(sound.events,['boss_attack_warning'],id);
  for(const delta of [warning-151,1,149,1,16,100,2200,200,500]){
   h.update(delta);baseline.update(delta);
   assert.deepEqual(heard,silent,id);
  }
  assert.equal(sound.events.filter(e=>e===skill.cast).length,skill.repeatedImpact?2:1,id);
  if(skill.fall)assert.equal(sound.events.filter(e=>e===skill.fall).length,1,id);
  if(skill.loop)assert.equal(sound.events.filter(e=>Array.isArray(e)&&e[0]==='stop').length,1,id);
  assert.equal(h.slots.some(s=>s.active),false);
  const fall=sound.events.indexOf(skill.fall),cast=sound.events.indexOf(skill.cast);
  if(skill.fall)assert.ok(fall<cast);
 }
});

test('warning and fall cannot trigger a hit early; a long frame skips stale fall but keeps the impact',()=>{
 for(const largeFrame of [false,true]){
  const sound=fakeSound(),audio=new BossAudioController(sound),damage=[];
  const h=new EncounterHazards(scene(),(...a)=>damage.push(a),undefined,audio);
  h.add('METEOR',360,650,35,1,{bossId:'lava_colossus',warningMs:1100,patternId:1});
  if(!largeFrame){h.update(949);assert.equal(sound.events.length,1);h.update(1);assert.equal(sound.events.at(-1),'boss_lava_meteor_fall');h.update(149);assert.equal(damage.length,0);h.update(1);}
  else h.update(1100);
  assert.equal(sound.events.at(-1),'boss_lava_meteor_impact');assert.equal(damage.length,1);
  assert.equal(sound.events.includes('boss_lava_meteor'),false);
 }
});

test('queen barrage has one warning, nine quiet impacts and one full impact at the ten actual deadlines',()=>{
 const sound=fakeSound(),events=[];sound.playBoss=(id,options)=>events.push({id,options});
 const audio=new BossAudioController(sound),hits=[],h=new EncounterHazards(scene(),(...args)=>hits.push(args),undefined,audio);
 const plan=planBossAttack('frost_queen',2,2,{x:360,y:300,speed:80},{x:360,y:630});
 for(const attack of plan.attacks)h.add(attack.kind,attack.x,attack.y,10,7,{...attack,bossId:'frost_queen',patternId:4});
 assert.equal(events.filter(e=>e.id==='boss_attack_warning').length,1);
 let age=0;
 for(const attack of plan.attacks){h.update(attack.warningMs-age-1);assert.equal(hits.length,events.filter(e=>e.id==='boss_frost_eruption').length);h.update(1);age=attack.warningMs;}
 const impacts=events.filter(e=>e.id==='boss_frost_eruption');
 assert.equal(hits.length,10);assert.equal(impacts.length,10);
 assert.deepEqual(impacts.map(e=>e.options),Array.from({length:10},(_,i)=>({gainScale:i===9?1:.35,restart:true})));
 h.update(1);assert.equal(events.filter(e=>e.id==='boss_frost_eruption').length,10);
});

test('a delayed barrage frame coalesces expired impact sounds while retaining all ten combat resolutions',()=>{
 const sound=fakeSound(),events=[];sound.playBoss=(id,options)=>events.push({id,options});
 const audio=new BossAudioController(sound),hits=[],h=new EncounterHazards(scene(),(...args)=>hits.push(args),undefined,audio);
 const plan=planBossAttack('frost_queen',1,2,{x:360,y:300,speed:80},{x:360,y:630});
 for(const attack of plan.attacks)h.add(attack.kind,attack.x,attack.y,10,7,{...attack,bossId:'frost_queen',patternId:4});
 h.update(plan.attacks.at(-1).warningMs);
 assert.equal(hits.length,10);
 assert.deepEqual(events.filter(e=>e.id==='boss_frost_eruption'),[{id:'boss_frost_eruption',options:{gainScale:1,restart:true}}]);
});

test('barrage retriggers keep two bounded voices, preserve quiet gain during bus changes and do not replay muted hits',async()=>{
 const f=await mixer(),audio=new BossAudioController(f.sound),h=new EncounterHazards(scene(),()=>{},undefined,audio);
 const plan=planBossAttack('frost_queen',1,2,{x:360,y:300,speed:80},{x:360,y:630});
 for(const attack of plan.attacks)h.add(attack.kind,attack.x,attack.y,10,7,{...attack,bossId:'frost_queen',patternId:4});
 f.advance(1100);h.update(1100);
 assert.ok(Math.abs(f.ctx.gains.at(-1).gain.value-.65*.35)<1e-9);
 f.sound.setBossVolume('bossCast',.5);assert.ok(Math.abs(f.ctx.gains.at(-1).gain.value-.65*.35*.5)<1e-9);
 f.sound.setBossVolume('bossCast',1);
 let age=1100;
 for(const attack of plan.attacks.slice(1)){
  const delta=attack.warningMs-age;f.advance(delta);h.update(delta);age=attack.warningMs;
  assert.ok(f.sound.getDiagnostics().activeBySound.boss_frost_eruption<=2);
 }
 assert.equal(f.sound.getDiagnostics().played,11);assert.equal(f.sound.getDiagnostics().skippedVoiceLimit,0);
 assert.equal(f.sound.getDiagnostics().skippedCooldown,0);assert.equal(f.ctx.gains.at(-1).gain.value,.65);
 h.clear();f.advance(150);assert.equal(f.sound.getDiagnostics().activeVoices,0);
 for(const attack of plan.attacks)h.add(attack.kind,attack.x,attack.y,10,7,{...attack,bossId:'frost_queen',patternId:5});
 f.advance(1100);h.update(1100);f.sound.setEnabled(false);f.advance(360);h.update(360);
 f.sound.setEnabled(true);const played=f.sound.getDiagnostics().played;h.update(0);
 assert.equal(f.sound.getDiagnostics().played,played);
 f.advance(180);h.update(180);assert.equal(f.sound.getDiagnostics().played,played+1);
 h.clear();f.advance(150);h.update(5000);assert.equal(f.sound.getDiagnostics().activeVoices,0);
 await f.sound.dispose();
});

test('a late penultimate barrage sound cannot consume the final impact cooldown',async()=>{
 const f=await mixer(),audio=new BossAudioController(f.sound),h=new EncounterHazards(scene(),()=>{},undefined,audio);
 const plan=planBossAttack('frost_queen',1,2,{x:360,y:300,speed:80},{x:360,y:630});
 for(const attack of plan.attacks)h.add(attack.kind,attack.x,attack.y,10,7,{...attack,bossId:'frost_queen',patternId:4});
 f.advance(2700);h.update(2700);assert.equal(f.sound.getDiagnostics().activeBySound.boss_frost_eruption,0);
 f.advance(20);h.update(20);assert.equal(f.sound.getDiagnostics().activeBySound.boss_frost_eruption,1);
 assert.equal(f.ctx.gains.at(-1).gain.value,.65);assert.equal(f.sound.getDiagnostics().skippedCooldown,0);
 await f.sound.dispose();
});

test('overlapping fields share one loop until their last actual end, with 150ms fade and no scheduled duration',async()=>{
 const f=await mixer(),audio=new BossAudioController(f.sound),h=new EncounterHazards(scene(),()=>{},undefined,audio);
 h.add('POISON',250,650,10,9,{bossId:'swamp_lord',patternId:1,warningMs:1000,durationMs:2400});
 h.add('POISON',470,650,10,9,{bossId:'swamp_lord',patternId:1,warningMs:1100,durationMs:2400});
 h.update(1000);f.advance(1000);h.update(100);f.advance(100);
 assert.equal(f.sound.getDiagnostics().activeBySound.boss_swamp_poison_loop,1);
 const loop=f.ctx.buffers.find(b=>b.loop);assert.ok(loop);assert.equal(loop.stopAt,Infinity);
 h.update(2300);assert.equal(loop.stopAt,Infinity,'second field remains alive');
 h.update(100);assert.ok(Math.abs(loop.stopAt-f.ctx.currentTime-.15)<1e-9);
 f.advance(150);assert.equal(f.sound.getDiagnostics().activeBySound.boss_swamp_poison_loop,0);
 assert.equal(loop.disconnected,true);await f.sound.dispose();
});

test('mute, SFX/category volume, pause and background stop loops; only still-active fields restart on recovery',async()=>{
 const f=await mixer(),audio=new BossAudioController(f.sound),h=new EncounterHazards(scene(),()=>{},undefined,audio);
 h.add('FROST',360,650,10,8,{bossId:'twilight_king',patternId:1,warningMs:1000,durationMs:2200});h.update(1000);
 const active=()=>f.sound.getDiagnostics().activeBySound.boss_twilight_binding_loop;
 assert.equal(active(),1);
 f.sound.setEnabled(false);f.advance(10);assert.equal(active(),0);h.update(1);assert.equal(active(),0);
 f.sound.setEnabled(true);h.update(1);assert.equal(active(),1,'a live loop recovers immediately without a one-shot cooldown');
 f.sound.setBossVolume('bossLoop',0);assert.equal(active(),0);h.update(1);assert.equal(active(),0);
 f.sound.setBossVolume('bossLoop',.5);f.advance(100);h.update(1);assert.equal(active(),1);assert.equal(f.ctx.gains.at(-1).gain.value,.06);
 f.sound.setGroupVolume('sfx',0);assert.equal(active(),0);f.sound.setGroupVolume('sfx',1);f.advance(100);h.update(1);assert.equal(active(),1);
 audio.pause();f.advance(150);assert.equal(active(),0);h.update(1);assert.equal(active(),1);
 await f.sound.suspendForBackground();assert.equal(active(),0);await f.sound.resumeAfterForeground();f.advance(100);h.update(1);assert.equal(active(),1);
 h.clear();f.advance(150);h.update(5000);assert.equal(active(),0);assert.equal(audio.slots.size,0);
 await f.sound.dispose();
});

test('encounter and increasing phase cues occur once per life; death has priority and survives encounter cleanup',async()=>{
 const f=await mixer(),audio=new BossAudioController(f.sound);
 audio.encounterStarted(1);audio.encounterStarted(1);audio.phaseChanged(1,1);audio.phaseChanged(1,2);audio.phaseChanged(1,2);
 assert.equal(f.sound.getDiagnostics().activeBySound.boss_encounter_start,1);
 assert.equal(f.sound.getDiagnostics().activeBySound.boss_phase_change,1);
 f.sound.startBossLoop('boss_frost_field_loop');audio.clear();f.sound.playBoss('boss_death');audio.clear();audio.pause();f.advance(150);
 assert.equal(f.sound.getDiagnostics().activeBySound.boss_frost_field_loop,0);
 assert.equal(f.sound.getDiagnostics().activeBySound.boss_death,1);
 assert.equal(f.sound.getDiagnostics().activeBySound.death_enemy_elite,0);
 await f.sound.dispose();assert.equal(f.sound.getDiagnostics().activeVoices,0);
});

test('missing boss files stay silent without deferred casts, and broken audio/visual observers cannot alter damage',async()=>{
 const ctx=new FakeAudioContext(),sound=new SoundManager({createContext:()=>ctx,loadSample:async()=>{throw Error('404');}});
 await sound.preloadBossSounds();await sound.unlockFromUserGesture();sound.playBoss('boss_forest_slam');sound.startBossLoop('boss_frost_field_loop');
 assert.equal(ctx.oscillators.length,0);assert.equal(ctx.buffers.length,0);await sound.dispose();
 const throwing={start(){throw Error('observer');},draw(){throw Error('observer');},end(){throw Error('observer');},clear(){throw Error('observer');}};
 const events=[],h=new EncounterHazards(scene(),(...a)=>events.push(a),throwing,throwing);
 assert.doesNotThrow(()=>{h.add('METEOR',360,650,35,7,{bossId:'lava_colossus'});h.update(800);h.update(250);h.clear();});assert.equal(events.length,1);
});
