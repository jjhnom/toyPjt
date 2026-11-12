import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession} from './helpers/browser-session.mjs';
const out=process.env.SMASH_AUDIO_ARTIFACTS??'artifacts/audio-p0-20261112',b=await browserSession(),{evaluate,click,send,waitFor}=b,report={checks:[]};
const startRun=async()=>{
 await click('MenuScene','new-run');
 if(await evaluate('!!smash.scene.getScene("MenuScene").children.getByName("new-run-confirmation")'))await click('MenuScene','new-run-confirm');
 await waitFor('smash.scene.isActive("GameScene")');
};
try{
 await mkdir(out,{recursive:true});
 await evaluate(`(async()=>{const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]');
  const main=await(await fetch(entry.src)).text(),url=main.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1];
  window.audio=(await import(url)).soundManager;
  window.audioTrace={contexts:[],constructGestures:[],resumeGestures:[],oscillators:0,gains:0};const Native=window.AudioContext;
  window.AudioContext=class extends Native{constructor(...args){super(...args);audioTrace.contexts.push(this);audioTrace.constructGestures.push(navigator.userActivation.isActive);}};
  const osc=Native.prototype.createOscillator,gain=Native.prototype.createGain,resume=Native.prototype.resume;
  Native.prototype.createOscillator=function(){audioTrace.oscillators++;return osc.call(this);};
  Native.prototype.createGain=function(){audioTrace.gains++;return gain.call(this);};
  Native.prototype.resume=function(){audioTrace.resumeGestures.push(navigator.userActivation.isActive);return resume.call(this);};undefined;})()`);
 assert.equal(await evaluate('smash.config.audio.noAudio'),true);assert.equal(await evaluate('audio.getDiagnostics().contextState'),'uninitialized');
 const menuListeners=await evaluate('smash.events.listenerCount("hidden")');
 await click('MenuScene','sound-toggle');assert.equal(await evaluate('audio.isEnabled()'),false);
 assert.equal(await evaluate('audioTrace.contexts.length'),0,'muting as the first touch must not allocate an audio graph');
 await startRun();
 assert.equal(await evaluate('audioTrace.contexts.length'),0);report.checks.push('first mute and muted start create no context');
 await evaluate(`smash.scene.getScene('GameScene').scene.start('MenuScene');undefined;`);await waitFor('smash.scene.isActive("MenuScene")');
 assert.equal(await evaluate('smash.events.listenerCount("hidden")'),menuListeners);
 await click('MenuScene','sound-toggle');await waitFor('audio.getDiagnostics().contextState==="running"');
 assert.equal(await evaluate('audioTrace.contexts.length'),1);assert.deepEqual(await evaluate('audioTrace.constructGestures'),[true]);
 assert.equal(await evaluate('audioTrace.gains'),3);report.checks.push('single context and reusable mixer unlock from a real touch');
 await startRun();await waitFor('audio.getDiagnostics().played>0');
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();undefined;`);
 report.burst=await evaluate(`(()=>{const d=audio.getDiagnostics(),o=audioTrace.oscillators,t=performance.now();for(let i=0;i<100;i++)audio.playShoot(1);const elapsed=performance.now()-t,n=audio.getDiagnostics();return{elapsed,played:n.played-d.played,skipped:n.skippedCooldown-d.skippedCooldown,nodes:audioTrace.oscillators-o,active:n.activeVoices,peak:n.peakVoices};})()`);
 assert.equal(report.burst.nodes,report.burst.played);assert.ok(report.burst.played<=Math.floor(report.burst.elapsed/40)+1);assert.ok(report.burst.active<=8);assert.ok(report.burst.peak<=8);
 report.checks.push('100 synchronous shoot requests are bounded without allocating skipped nodes');
 await evaluate(`smash.events.emit('hidden');undefined;`);await waitFor('audio.getDiagnostics().contextState==="suspended"');
 const stopped=await evaluate(`(()=>{const n=audioTrace.oscillators;for(let i=0;i<100;i++)audio.playExplosion();return audioTrace.oscillators===n&&audio.getDiagnostics().activeVoices===0;})()`);assert.equal(stopped,true);
 const failures=await evaluate('audio.getDiagnostics().unlockFailures');
 await evaluate(`window.realResume=audioTrace.contexts[0].resume;audioTrace.contexts[0].resume=()=>Promise.reject(new DOMException('simulated rejection','NotAllowedError'));smash.events.emit('visible');undefined;`);
 await waitFor(`audio.getDiagnostics().unlockFailures>${failures}`);assert.equal(await evaluate('audio.getDiagnostics().contextState'),'suspended');
 await evaluate('audioTrace.contexts[0].resume=realResume;undefined;');await b.tap(130,700);await waitFor('audio.getDiagnostics().contextState==="running"');
 assert.equal(await evaluate('audioTrace.contexts.length'),1);report.checks.push('hidden blocks audio and rejected foreground resume recovers on the next real touch');
 await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.audioHidden});window.audioHidden=true;document.dispatchEvent(new Event('visibilitychange'));undefined;`);
 await waitFor('audio.getDiagnostics().contextState==="suspended"');
 await evaluate(`window.audioHidden=false;document.dispatchEvent(new Event('visibilitychange'));undefined;`);await waitFor('audio.getDiagnostics().contextState==="running"');
 await evaluate(`window.dispatchEvent(new Event('pagehide'));undefined;`);await waitFor('audio.getDiagnostics().contextState==="suspended"');
 await evaluate(`window.dispatchEvent(new Event('pageshow'));undefined;`);await waitFor('audio.getDiagnostics().contextState==="running"');report.checks.push('document visibility and pagehide/pageshow recover without recreating the context');
 for(let i=0;i<3;i++){
  await evaluate(`gs.scene.start('MenuScene');undefined;`);await waitFor('smash.scene.isActive("MenuScene")');assert.equal(await evaluate('smash.events.listenerCount("hidden")'),menuListeners);
  await startRun();await evaluate(`window.gs=smash.scene.getScene('GameScene');undefined;`);
 }
 report.checks.push('three scene restarts retain one context and no duplicate application listener');
 report.diagnostics=await evaluate('audio.getDiagnostics()');report.trace=await evaluate('({contexts:audioTrace.contexts.length,constructGestures:audioTrace.constructGestures,resumeGestures:audioTrace.resumeGestures,oscillators:audioTrace.oscillators,gains:audioTrace.gains})');
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/battle-mobile360.png',Buffer.from(shot.data,'base64'));
 await evaluate('smash.destroy(true);undefined;');await waitFor('audio.getDiagnostics().disposed');await waitFor('audioTrace.contexts[0].state==="closed"');
 assert.equal(await evaluate('audio.getDiagnostics().activeVoices'),0);report.checks.push('game destruction closes the context and releases voices');
 // Reload with Web Audio unavailable. It must not prevent entering the actual battle.
 await send('Page.reload');await b.attach();
 await evaluate(`Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});undefined;`);
 await startRun();report.checks.push('Web Audio unsupported: battle still starts');
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(out+'/browser-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{b.close();}
