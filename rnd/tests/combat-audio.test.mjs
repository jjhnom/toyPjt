import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from './helpers/skill-fixture.mjs';
import {FakeAudioContext,flush} from './helpers/fake-audio.mjs';
const {SoundManager}=load('src/systems/SoundManager.ts');
const {COMBAT_SOUND_IDS,COMBAT_SOUNDS,ATTACK_SOUNDS,enemyDeathSound}=load('src/config/soundData.ts');
test('15 shipped OGG samples match supplied files and every real unit has an attack mapping',()=>{
 assert.equal(COMBAT_SOUND_IDS.length,15);
 for(const id of COMBAT_SOUND_IDS){const data=readFileSync(`public/audio/sfx/${id}.ogg`);assert.equal(data.subarray(0,4).toString(),'OggS');assert.deepEqual(data,readFileSync(`.agent/skills/sound/20261113/rnd_phase2_combat_sfx_v2/assets/audio/sfx/${id}.ogg`));assert.ok(COMBAT_SOUNDS[id].sampleGain>0);}
 const {UNIT_TYPES}=load('src/config/unitData.ts');for(const id of Object.keys(UNIT_TYPES))assert.ok(COMBAT_SOUNDS[ATTACK_SOUNDS[id]]);
 assert.equal(enemyDeathSound('SWARMER'),'death_enemy_small');assert.equal(enemyDeathSound('TANK'),'death_enemy_medium');assert.equal(enemyDeathSound('SPORE_SHOOTER'),'death_enemy_magic');assert.equal(enemyDeathSound('BOSS_CORE'),'death_enemy_elite');
});
test('boot loading creates no context; samples decode once after gesture and play through the existing mixer',async()=>{
 const ctx=new FakeAudioContext();let creates=0,time=0,loads=0;const m=new SoundManager({createContext:()=>{creates++;return ctx;},now:()=>time,loadSample:async()=>{loads++;return new ArrayBuffer(8);}});
 await Promise.all([m.preloadCombatSounds(),m.preloadCombatSounds()]);assert.equal(creates,0);assert.equal(loads,15);
 await m.unlockFromUserGesture();await flush();assert.equal(m.getDiagnostics().decodedSamples,15);assert.equal(ctx.decodeCalls,15);
 m.playUnitAttack('BASIC_LASER');assert.equal(ctx.buffers.length,1);assert.equal(ctx.oscillators.length,0);assert.equal(ctx.gains.at(-1).gain.value,.2);
 m.playUnitAttack('ROCKET_BOT');assert.equal(ctx.buffers.length,1,'40ms attack throttle spans different IDs');
 time=60;m.playCombat('hit_flesh_light');m.playCombat('hit_critical');assert.equal(ctx.buffers.length,3,'critical bypasses lower-priority impact cooldown');
 await m.suspendForBackground();assert.equal(m.getDiagnostics().activeVoices,0);await m.resumeAfterForeground();m.playUnitAttack('ROCKET_BOT');assert.equal(ctx.buffers.length,4);assert.equal(ctx.decodeCalls,15);
 await m.dispose();assert.ok(ctx.buffers.every(b=>b.disconnected));assert.equal(m.getDiagnostics().decodedSamples,0);
});
test('missing or undecodable samples fall back without queueing old attacks or blocking combat',async()=>{
 const ctx=new FakeAudioContext(),m=new SoundManager({createContext:()=>ctx,loadSample:async()=>{throw Error('missing');}});
 await m.preloadCombatSounds();m.playUnitAttack('BASIC_LASER');await m.unlockFromUserGesture();await flush();assert.equal(ctx.oscillators.length,0);
 assert.doesNotThrow(()=>m.playUnitAttack('BASIC_LASER'));assert.equal(ctx.oscillators.length,1);await m.dispose();
 const bad=new FakeAudioContext();bad.decodeAudioData=()=>Promise.reject(Error('codec'));
 const n=new SoundManager({createContext:()=>bad,loadSample:async()=>new ArrayBuffer(8)});await n.preloadCombatSounds();await n.unlockFromUserGesture();await flush();n.playCombat('hit_armor');assert.equal(bad.oscillators.length,1);await n.dispose();
});
test('sample priority replaces ordinary attacks at the eight-voice cap and late decoding cannot revive a disposed mixer',async()=>{
 const ctx=new FakeAudioContext();let time=0;const m=new SoundManager({createContext:()=>ctx,now:()=>time,loadSample:async()=>new ArrayBuffer(8)});
 await m.preloadCombatSounds();await m.unlockFromUserGesture();await flush();
 for(let i=0;i<8;i++){m.playCombat(i%2?'attack_arrow':'attack_sword_light');time+=40;}
 assert.equal(m.getDiagnostics().activeVoices,8);m.playCombat('death_enemy_elite');assert.equal(m.getDiagnostics().activeVoices,8);assert.equal(m.getDiagnostics().activeBySound.death_enemy_elite,1);await m.dispose();
 const pending=new FakeAudioContext();let finish;const decode=new Promise(r=>finish=r);pending.decodeAudioData=()=>decode;
 const n=new SoundManager({createContext:()=>pending,loadSample:async()=>new ArrayBuffer(8)});await n.preloadCombatSounds();await n.unlockFromUserGesture();await n.dispose();finish({duration:.3});await flush();assert.equal(n.getDiagnostics().decodedSamples,0);assert.equal(n.getDiagnostics().activeVoices,0);
});
