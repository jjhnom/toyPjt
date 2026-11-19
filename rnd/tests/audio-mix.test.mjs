import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers/skill-fixture.mjs';
import {FakeAudioContext} from './helpers/fake-audio.mjs';
const {limitAudioSample,createAudioOutputGuard,AUDIO_OUTPUT_CEILING}=load('src/systems/audioMix.ts');
const {SoundManager}=load('src/systems/SoundManager.ts');

test('output guard preserves quiet signals, symmetry and bounded output for overloaded input',()=>{
 for(const sample of [-.5,-.25,0,.25,.5])assert.equal(limitAudioSample(sample),sample);
 let previous=-1;
 for(let i=-4000;i<=4000;i++){
  const value=limitAudioSample(i/1000);
  assert.ok(Number.isFinite(value)&&Math.abs(value)<=AUDIO_OUTPUT_CEILING);
  assert.ok(value>=previous);assert.ok(Math.abs(value+limitAudioSample(-i/1000))<1e-12);previous=value;
 }
 for(const value of [NaN,Infinity,-Infinity])assert.equal(limitAudioSample(value),0);
});
test('output guard is connected once and released with the audio graph',async()=>{
 const ctx=new FakeAudioContext(),sound=new SoundManager({createContext:()=>ctx});
 await sound.unlockFromUserGesture();await sound.unlockFromUserGesture();
 assert.equal(ctx.waveShapers.length,1);assert.equal(ctx.waveShapers[0].curve.length,4097);
 assert.equal(ctx.waveShapers[0].oversample,'none');assert.equal(sound.getDiagnostics().outputGuard,true);
 sound.playHit();assert.equal(sound.getDiagnostics().played,1);
 await sound.dispose();assert.equal(ctx.waveShapers[0].disconnected,true);assert.equal(sound.getDiagnostics().outputGuard,false);
});
test('unsupported or failed output guard keeps the existing sound path usable',async()=>{
 for(const mode of ['unsupported','allocation-failure']){
  const ctx=new FakeAudioContext();if(mode==='unsupported')ctx.createWaveShaper=undefined;else ctx.failWaveShaper=true;
  const sound=new SoundManager({createContext:()=>ctx});await sound.unlockFromUserGesture();sound.playHit();
  assert.equal(sound.getDiagnostics().outputGuard,false);assert.equal(sound.getDiagnostics().played,1);
  assert.equal(ctx.gains[0].connections[0],ctx.destination);await sound.dispose();
 }
 let disconnected=false;const broken={createWaveShaper:()=>({set curve(_value){throw Error('invalid curve');},disconnect(){disconnected=true;throw Error('unavailable node');}})};
 assert.equal(createAudioOutputGuard(broken),undefined);assert.equal(disconnected,true);
});
