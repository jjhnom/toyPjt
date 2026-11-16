import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const out='artifacts/bgm-20261116',b=await browserSession(),report={checks:[],loops:[]};
const waitMusic=async key=>{
 await b.waitFor(`music.getDiagnostics().current==='${key}'&&music.current.sound.audio&&!music.current.sound.audio.paused&&music.current.sound.audio.readyState>=2`);
 await sleep(650);
};
try{
 await mkdir(out,{recursive:true});
 await b.evaluate(`(async()=>{
  const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]'),main=await(await fetch(entry.src)).text();
  const soundUrl=main.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1];
  const musicUrl=main.match(/from ["']([^"']*systems\\/BgmManager\\.ts[^"']*)["']/)[1];
  window.audio=(await import(soundUrl)).soundManager;window.music=(await import(musicUrl)).bgmManager;
  window.menu=smash.scene.getScene('MenuScene');
 })()`);
 assert.equal(await b.evaluate('smash.config.audio.disableWebAudio'),true);
 assert.equal(await b.evaluate('music.getDiagnostics().activeTracks'),0);
 await b.click('MenuScene','sound-toggle');await sleep(100);
 assert.equal(await b.evaluate('audio.getDiagnostics().contextState'),'uninitialized');
 assert.equal(await b.evaluate('music.getDiagnostics().activeTracks'),0);
 await b.click('MenuScene','sound-toggle');await waitMusic('bgm_lobby');
 console.log('BGM lobby unlocked by a real touch.');
 assert.equal(await b.evaluate('music.getDiagnostics().volume'),.22);
 assert.equal(await b.evaluate('music.current.sound.audio.loop'),true);
 report.checks.push('no music before input or after first mute; real touch unlocks lobby at 0.22 without a second AudioContext');
 report.pcm=await b.evaluate(`(async()=>{
  const {BGM_TRACKS}=await import('/src/config/bgmData.ts'),rows=[];
  for(const [key,track]of Object.entries(BGM_TRACKS)){
   const data=await(await fetch('audio/bgm/'+track.file)).arrayBuffer(),buffer=await audio.ctx.decodeAudioData(data);
   const samples=buffer.getChannelData(0);let sum=0,peak=0;for(const value of samples){sum+=value*value;peak=Math.max(peak,Math.abs(value));}
   rows.push({key,duration:buffer.duration,peak,rms:Math.sqrt(sum/samples.length),seamJump:Math.abs(samples[0]-samples.at(-1))});
  }return rows;
 })()`);
 for(const row of report.pcm){assert.ok(row.rms>.01,row.key);assert.ok(row.peak<1,row.key);assert.ok(row.seamJump<.1,row.key);}
 console.log(JSON.stringify({decodedPcm:report.pcm}));
 // Accelerated boundary checks: seek near the end, observe ten real native wraps per song.
 for(const key of ['bgm_lobby','bgm_battle','bgm_twilight']){
  await b.evaluate(`music.play(menu,'${key}');undefined`);await waitMusic(key);
  const duration=await b.evaluate('music.current.sound.audio.duration');assert.ok(duration>20);
  for(let i=0;i<10;i++){
   await b.evaluate('music.current.sound.audio.currentTime=Math.min(music.current.sound.duration,music.current.sound.audio.duration)-.15;undefined');
   try { await b.waitFor('music.current.sound.audio.currentTime<1&&!music.current.sound.audio.paused'); }
   catch(error){console.log(await b.evaluate(`(()=>{const a=music.current?.sound.audio;return{diagnostics:music.getDiagnostics(),soundDuration:music.current?.sound.duration,tag:a&&{time:a.currentTime,duration:a.duration,loop:a.loop,ended:a.ended,paused:a.paused,ready:a.readyState,error:a.error?.message},config:music.current?.sound.currentConfig};})()`));throw error;}
  }
  report.loops.push({key,duration,boundaryWraps:10,activeTracks:await b.evaluate('music.getDiagnostics().activeTracks')});
  assert.equal(report.loops.at(-1).activeTracks,1);
  console.log(`${key}: 10 native loop boundary checks passed.`);
 }
 report.checks.push('all three OGGs decode to non-silent unclipped PCM; each completes ten accelerated native loop boundaries');
 const rapid=await b.evaluate(`(()=>{
  let max=0;for(let i=0;i<40;i++){music.play(menu,i%2?'bgm_battle':'bgm_lobby');max=Math.max(max,music.getDiagnostics().activeTracks);}
  music.play(menu,'bgm_lobby');return{max,stepListeners:smash.events.listenerCount('step'),unlockedListeners:smash.sound.listenerCount('unlocked')};
 })()`);
 assert.ok(rapid.max<=2);await waitMusic('bgm_lobby');assert.equal(await b.evaluate('music.getDiagnostics().activeTracks'),1);
 await b.evaluate("music.play(menu,'bgm_battle');undefined");await sleep(100);
 await b.evaluate('audio.setEnabled(false);undefined');await sleep(700);
 assert.equal(await b.evaluate('music.getDiagnostics().volume'),0);assert.equal(await b.evaluate('music.getDiagnostics().paused'),true);
 await b.evaluate("music.play(menu,'bgm_lobby');audio.setEnabled(true);undefined");await waitMusic('bgm_lobby');
 await b.evaluate('audio.setMasterVolume(.5);audio.setGroupVolume("sfx",0);undefined');
 assert.equal(await b.evaluate('music.getDiagnostics().volume'),.11);
 await b.evaluate('music.setVolume(.5);undefined');assert.equal(await b.evaluate('music.getDiagnostics().volume'),.055);
 assert.equal(await b.evaluate('audio.getSettings().masterVolume'),.5);
 await b.evaluate('music.setVolume(1);audio.setMasterVolume(1);audio.setGroupVolume("sfx",1);undefined');
 report.rapid=rapid;report.checks.push('40 rapid requests retain at most two tracks; fade cannot overwrite mute/master/BGM volume changes; SFX volume is independent');
 await b.click('MenuScene','new-run');await b.waitFor("smash.scene.isActive('GameScene')");await waitMusic('bgm_battle');
 await b.evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();undefined");
 // BGM fades use the game clock while GameScene is paused for management.
 await b.evaluate('gs.progression.index=4;gs.queueEnemy("BOSS_CORE",360,300);gs.processSpawns(0);undefined');await waitMusic('bgm_twilight');
 const starts=await b.evaluate('music.getDiagnostics().starts');
 await b.evaluate("music.play(gs,'bgm_twilight');music.play(gs,'bgm_twilight');undefined");
 assert.equal(await b.evaluate('music.getDiagnostics().starts'),starts);
 await b.evaluate(`(async()=>{
  const {RoomGridManager}=await import('/src/systems/RoomGridManager.ts');gs.gridManager=new RoomGridManager(gs.progression.current);
  const room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');gs.gridManager.restoreCurrentRoom(room.id);
  const boss=gs.enemies.getChildren().find(e=>e.active&&e.bossId==='twilight_king');gs.handleEnemyKilled(boss);
 })()`);await waitMusic('bgm_battle');
 report.checks.push('real GameScene spawn switches to twilight once; boss death returns to battle while management is paused');
 await b.evaluate(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});window.testHidden=true;
  smash.events.emit('hidden');document.dispatchEvent(new Event('visibilitychange'));undefined`);
 assert.equal(await b.evaluate('music.getDiagnostics().paused'),true);
 await b.evaluate("smash.events.emit('visible');undefined");assert.equal(await b.evaluate('music.getDiagnostics().paused'),true);
 await b.evaluate("window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));undefined");await waitMusic('bgm_battle');
 // Reject a native play promise on foreground, then recover from a genuine user input.
 await b.evaluate(`smash.events.emit('hidden');window.nativePlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('test rejection','NotAllowedError'));};
  smash.events.emit('visible');undefined`);await sleep(150);
 assert.equal(await b.evaluate('music.current.sound.audio.paused'),true);
 await b.evaluate('HTMLMediaElement.prototype.play=nativePlay;undefined');await b.tap(350,350);await waitMusic('bgm_battle');
 report.checks.push('overlapping visibility reasons stay paused; rejected native foreground play recovers on the next touch');
 await b.evaluate('gs.handlePlayerDeath();undefined');await b.waitFor("smash.scene.isActive('GameOverScene')");
 assert.equal(await b.evaluate('music.getDiagnostics().activeTracks'),0);
 await b.evaluate("smash.scene.getScene('GameOverScene').scene.start('MenuScene');undefined");await b.waitFor("smash.scene.isActive('MenuScene')");await waitMusic('bgm_lobby');
 assert.equal(await b.evaluate('smash.events.listenerCount("step")'),rapid.stepListeners);
 assert.equal(await b.evaluate('smash.sound.listenerCount("unlocked")'),rapid.unlockedListeners);
 assert.equal(await b.evaluate('music.getDiagnostics().errors'),0);assert.equal(await b.evaluate('audio.getDiagnostics().audioErrors'),0);
 assert.deepEqual(b.errors,[]);
 await b.evaluate('smash.destroy(true);undefined');await b.waitFor('music.getDiagnostics().disposed');
 assert.equal(await b.evaluate('music.getDiagnostics().activeTracks'),0);
 report.checks.push('result screen stops BGM; lobby returns without duplicate listeners; game destruction releases music');
 report.status='passed';await writeFile(`${out}/result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,checks:report.checks,pcm:report.pcm,loops:report.loops}));
}finally{b.close();}
