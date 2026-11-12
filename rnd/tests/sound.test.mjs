import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {load} from './helpers/skill-fixture.mjs';
import {FakeAudioContext,deferred,flush} from './helpers/fake-audio.mjs';
const {SoundManager,soundManager}=load('src/systems/SoundManager.ts');
const {installSoundLifecycle}=load('src/systems/soundLifecycle.ts');
const make=()=>{const ctx=new FakeAudioContext();let time=0,creates=0;const manager=new SoundManager({createContext:()=>{creates++;return ctx;},now:()=>time});
 return{ctx,manager,setTime:t=>{time=t;},advance:ms=>{time+=ms;ctx.advance(ms);},creates:()=>creates};};

test('lazy mixer preserves all four tones and routes group gains through a single master',async()=>{
 const f=make(),m=f.manager;m.playShoot(1);assert.equal(f.creates(),0);assert.equal(await m.unlockFromUserGesture(),true);
 assert.equal(f.ctx.gains.length,3);const [master,sfx,ui]=f.ctx.gains;
 assert.equal(sfx.connections[0],master);assert.equal(ui.connections[0],master);assert.equal(master.connections[0],f.ctx.destination);
 for(const [tier,hz,wave]of[[1,620,'triangle'],[2,760,'triangle'],[3,920,'sawtooth']]){f.advance(100);m.playShoot(tier);const o=f.ctx.oscillators.at(-1);assert.equal(o.frequency.calls[0][1],hz);assert.equal(o.type,wave);assert.equal(o.connections[0].connections[0],sfx);}
 f.advance(100);m.playHit();assert.equal(f.ctx.oscillators.at(-1).frequency.calls[0][1],220);
 m.playExplosion();assert.equal(f.ctx.oscillators.at(-1).frequency.calls[0][1],140);
 m.playPowerup();assert.equal(f.ctx.oscillators.at(-1).connections[0].connections[0],ui);
 f.advance(300);assert.equal(m.getDiagnostics().activeVoices,0);
 assert.ok(f.ctx.oscillators.every(o=>o.disconnected));assert.ok(f.ctx.gains.slice(3).every(g=>g.disconnected));await m.dispose();
});

test('100 rapid shots obey the 40ms policy without allocating nodes for skipped requests',async()=>{
 const f=make();await f.manager.unlockFromUserGesture();
 for(let i=0;i<100;i++){f.manager.playShoot(1);f.advance(1);}
 const d=f.manager.getDiagnostics();assert.equal(d.requested,100);assert.equal(d.played,3);assert.equal(d.skippedCooldown,97);
 assert.equal(f.ctx.oscillators.length,3);assert.ok(d.peakVoices<=4);
 for(let i=1;i<f.ctx.oscillators.length;i++)assert.ok(f.ctx.oscillators[i].startAt-f.ctx.oscillators[i-1].startAt>=.04-1e-8);
 await f.manager.dispose();
});

test('per-sound and total caps protect important UI sounds by replacing lower priority voices',async()=>{
 const f=make(),m=f.manager;await m.unlockFromUserGesture();let clock=0;
 // Simulate delayed onended events while the wall clock advances.
 for(let i=0;i<4;i++){f.setTime(clock+=40);m.playShoot(1);}f.setTime(clock+=40);m.playShoot(1);assert.equal(m.getDiagnostics().activeBySound.shoot,4);
 for(let i=0;i<3;i++){f.setTime(clock+=60);m.playHit();}f.setTime(clock+=100);m.playExplosion();assert.equal(m.getDiagnostics().activeVoices,8);
 f.setTime(clock+=120);m.playPowerup();assert.equal(m.getDiagnostics().activeVoices,8);assert.equal(m.getDiagnostics().activeBySound.powerup,1);assert.equal(m.getDiagnostics().activeBySound.shoot,3);
 f.setTime(clock+=120);m.playPowerup();f.setTime(clock+=120);m.playPowerup();assert.equal(m.getDiagnostics().activeBySound.powerup,2);
 f.setTime(clock+=60);m.playHit();assert.ok(m.getDiagnostics().skippedVoiceLimit>=3);assert.ok(m.getDiagnostics().peakVoices<=8);await m.dispose();
});

test('mute, zero volumes and invalid numbers never create fresh contexts or playback nodes',async()=>{
 const f=make(),m=f.manager;m.setEnabled(false);assert.equal(await m.unlockFromUserGesture(),false);m.playHit();assert.equal(f.creates(),0);
 m.setEnabled(true);m.setMasterVolume(0);assert.equal(await m.unlockFromUserGesture(),false);m.playPowerup();assert.equal(f.creates(),0);
 m.setMasterVolume(2);m.setGroupVolume('sfx',0);m.setGroupVolume('ui',0);assert.equal(await m.unlockFromUserGesture(),false);
 m.setGroupVolume('ui',1);await m.unlockFromUserGesture();const gains=f.ctx.gains.length;m.playShoot(1);assert.equal(f.ctx.gains.length,gains);
 m.playPowerup();const voices=f.ctx.oscillators.length;m.setEnabled(false);m.playPowerup();assert.equal(f.ctx.oscillators.length,voices);assert.equal(f.ctx.gains[0].gain.value,0);
 f.advance(10);assert.equal(m.getDiagnostics().activeVoices,0);
 for(const value of[NaN,Infinity,-Infinity,-1]){m.setMasterVolume(value);assert.equal(m.getSettings().masterVolume,0);}
 assert.equal(m.getSettings().uiVolume,1);m.setGroupVolume('ui',NaN);assert.equal(m.getSettings().uiVolume,0);await m.dispose();
});

test('unsupported, construction, graph, playback and asynchronous activation failures are isolated from callers',async()=>{
 const unsupported=new SoundManager({createContext:()=>null});assert.equal(await unsupported.unlockFromUserGesture(),false);assert.doesNotThrow(()=>unsupported.playExplosion());
 let rejectCreate=true;const ctx=new FakeAudioContext(),m=new SoundManager({createContext:()=>{if(rejectCreate)throw Error('unsupported');return ctx;}});
 assert.equal(await m.unlockFromUserGesture(),false);rejectCreate=false;ctx.resumeImpl=()=>Promise.reject(Error('gesture rejected'));assert.equal(await m.unlockFromUserGesture(),false);
 ctx.resumeImpl=null;assert.equal(await m.unlockFromUserGesture(),true);ctx.failGain=true;assert.doesNotThrow(()=>m.playHit());assert.equal(m.getDiagnostics().activeVoices,0);assert.equal(ctx.oscillators.at(-1).disconnected,true);
 ctx.failGain=false;ctx.failStart=true;assert.doesNotThrow(()=>m.playHit());assert.equal(m.getDiagnostics().activeVoices,0);ctx.failStart=false;m.playHit();assert.equal(m.getDiagnostics().played,1);
 ctx.suspendImpl=()=>Promise.reject(Error('suspend failed'));await m.suspendForBackground();const count=ctx.oscillators.length;m.playHit();assert.equal(ctx.oscillators.length,count);
 ctx.closeImpl=()=>Promise.reject(Error('close failed'));await assert.doesNotReject(m.dispose());await unsupported.dispose();
 const bad=new FakeAudioContext();bad.failGain=true;const partial=new SoundManager({createContext:()=>bad});assert.equal(await partial.unlockFromUserGesture(),false);assert.equal(bad.closeCalls,1);await partial.dispose();
});

test('concurrent unlocks share one resume, failures can retry, and a hung resume times out',async()=>{
 const ctx=new FakeAudioContext(),gate=deferred();ctx.resumeImpl=()=>gate.promise.then(()=>ctx.changeState('running'));
 const m=new SoundManager({createContext:()=>ctx}),first=m.unlockFromUserGesture();
 const all=Array.from({length:100},()=>m.unlockFromUserGesture());assert.ok(all.every(p=>p===first));assert.equal(ctx.resumeCalls,1);gate.resolve();assert.equal(await first,true);await m.dispose();
 const stuck=new FakeAudioContext();stuck.resumeImpl=()=>new Promise(()=>{});const retry=new SoundManager({createContext:()=>stuck,resumeTimeoutMs:5});
 assert.equal(await retry.unlockFromUserGesture(),false);stuck.resumeImpl=null;assert.equal(await retry.unlockFromUserGesture(),true);assert.equal(stuck.resumeCalls,2);await retry.dispose();
});

test('background reasons block all output until both sources clear and a failed foreground resume retries on input',async()=>{
 const f=make(),m=f.manager;await m.unlockFromUserGesture();m.playHit();
 await m.suspendForBackground('game');await m.suspendForBackground('document');assert.equal(m.getDiagnostics().activeVoices,0);
 const count=f.ctx.oscillators.length;m.playPowerup();assert.equal(f.ctx.oscillators.length,count);
 assert.equal(await m.resumeAfterForeground('game'),false);assert.equal(f.ctx.state,'suspended');
 f.ctx.resumeImpl=()=>Promise.reject(Error('autoplay rejected'));assert.equal(await m.resumeAfterForeground('document'),false);
 f.ctx.resumeImpl=null;assert.equal(await m.unlockFromUserGesture(),true);m.playPowerup();assert.equal(m.getDiagnostics().activeBySound.powerup,1);
 f.ctx.changeState('interrupted');const before=f.ctx.oscillators.length;m.playShoot(1);assert.equal(f.ctx.oscillators.length,before);assert.equal(await m.unlockFromUserGesture(),true);await m.dispose();
});

test('late resume cannot wake hidden audio, rapid hide/show waits for suspend, and disposal cancels in-flight work',async()=>{
 const ctx=new FakeAudioContext(),gate=deferred();ctx.resumeImpl=()=>gate.promise.then(()=>ctx.changeState('running'));
 const m=new SoundManager({createContext:()=>ctx}),unlock=m.unlockFromUserGesture();await m.suspendForBackground();gate.resolve();assert.equal(await unlock,false);await flush();
 assert.equal(ctx.state,'suspended');assert.equal(m.getDiagnostics().background,true);ctx.resumeImpl=null;
 assert.equal(await m.resumeAfterForeground(),false,'an interrupted first unlock still needs an explicit gesture');assert.equal(await m.unlockFromUserGesture(),true);
 const suspension=deferred();ctx.suspendImpl=()=>suspension.promise.then(()=>ctx.changeState('suspended'));const hiding=m.suspendForBackground();const showing=m.resumeAfterForeground();
 suspension.resolve();await hiding;assert.equal(await showing,true);assert.equal(ctx.state,'running');await m.dispose();
 const late=new FakeAudioContext(),end=deferred();late.resumeImpl=()=>end.promise.then(()=>late.changeState('running'));
 const doomed=new SoundManager({createContext:()=>late}),pending=doomed.unlockFromUserGesture(),disposal=doomed.dispose();assert.equal(doomed.dispose(),disposal);assert.equal(await pending,false);await disposal;
 end.resolve();await flush();assert.equal(doomed.getDiagnostics().contextState,'uninitialized');assert.equal(await doomed.unlockFromUserGesture(),false);assert.equal(late.closeCalls,1);assert.ok(late.gains.every(g=>g.disconnected));
});

test('lifecycle binding installs once, covers menu/background events, and releases listeners on Game destruction',async()=>{
 const f=make(),events=new EventEmitter(),doc=new EventTarget(),win=new EventTarget();doc.hidden=false;
 const cleanup=installSoundLifecycle(f.manager,events,doc,win);assert.equal(installSoundLifecycle(f.manager,events,doc,win),cleanup);assert.equal(events.listenerCount('hidden'),1);assert.equal(f.creates(),0);
 doc.dispatchEvent(new Event('pointerup'));await flush();assert.equal(f.creates(),1);assert.equal(f.ctx.state,'running');
 events.emit('hidden');doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.ctx.state,'suspended');
 events.emit('visible');await flush();assert.equal(f.manager.getDiagnostics().background,true);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.ctx.state,'running');
 win.dispatchEvent(new Event('pagehide'));await flush();assert.equal(f.ctx.state,'suspended');win.dispatchEvent(new Event('pageshow'));await flush();assert.equal(f.ctx.state,'running');
 events.emit('destroy');await flush();assert.equal(events.listenerCount('hidden'),0);assert.equal(events.listenerCount('visible'),0);assert.equal(f.ctx.closeCalls,1);
 doc.dispatchEvent(new Event('pointerup'));await flush();assert.equal(f.creates(),1);cleanup();assert.equal(f.ctx.closeCalls,1);
});

test('sound rate limits never suppress WeaponComponent fire callbacks or alter their damage',async()=>{
 const {WeaponComponent}=load('src/components/WeaponComponent.ts'),{DRONE_SPECS}=load('src/config/gameData.ts');
 const f=make();await f.manager.unlockFromUserGesture();const real=soundManager.playShoot;soundManager.playShoot=tier=>f.manager.playShoot(tier);
 try{
  const spec=DRONE_SPECS.BASIC_LASER,shots=[],weapon=new WeaponComponent(spec,config=>shots.push({...config}));
  const enemies={getChildren:()=>[{active:true,x:100,y:100}]};
  for(let i=1;i<=100;i++){assert.ok(weapon.tryFire(i*spec.fireRateMs,100,100,enemies,1.5,1));f.advance(1);}
  assert.equal(shots.length,100);assert.ok(shots.every(s=>s.damage===Math.round(spec.damage*1.5)));assert.equal(f.manager.getDiagnostics().played,3);
 }finally{soundManager.playShoot=real;await f.manager.dispose();}
});
