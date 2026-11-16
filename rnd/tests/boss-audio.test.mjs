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

test('26 shipped boss files match supplied assets, and all 13 real skills use the correct identities',()=>{
 assert.equal(BOSS_SOUND_IDS.length,26);
 for(const id of BOSS_SOUND_IDS){
  const bytes=readFileSync(`public/audio/boss/${id}.ogg`),folder=id.endsWith('_fall')||id.endsWith('_impact')?'extras':'ogg';
  assert.equal(bytes.subarray(0,4).toString(),'OggS');
  assert.deepEqual(bytes,readFileSync(`.agent/skills/sound/20261113/rnd_boss_sfx_v1/${folder}/${id}.ogg`));
 }
 let count=0;
 for(const id of BOSS_IDS)for(const pattern of BOSS_PROFILES[id].patterns){assert.ok(bossSkillSound(id,pattern));count++;}
 assert.equal(count,13);
 assert.equal(bossSkillSound('desert_emperor','POISON').cast,'boss_desert_sandstorm_cast');
 assert.equal(bossSkillSound('twilight_king','FROST').cast,'boss_twilight_binding');
 assert.equal(bossSkillSound('forest_guardian','FROST'),undefined);
});

test('all skills warn once per plan, activate at the damage deadline once, and retain identical damage callbacks',()=>{
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
  assert.equal(sound.events.filter(e=>e===skill.cast).length,1,id);
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
