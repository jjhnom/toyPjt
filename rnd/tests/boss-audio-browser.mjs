import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const out='artifacts/frost-audio-20261118',b=await browserSession(),report={cases:[],checks:[]};
try{
 await mkdir(out,{recursive:true});
 await b.evaluate(`(async()=>{
  const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]');
  const main=await(await fetch(entry.src)).text(),url=main.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1];
  window.audio=(await import(url)).soundManager;
  window.audioTrace=[];window.frostTrace=[];window.audioStep=0;const play=audio.playSound.bind(audio);
  audio.playSound=function(id,...args){const n=this.getDiagnostics().played;play(id,...args);if(this.getDiagnostics().played>n){
   audioTrace.push({id,step:audioStep});
   if(id==='boss_frost_eruption'){
    const voices=Array.from(this.voices).filter(v=>v.id===id);
    const voice=voices.at(-1),event={step:audioStep,gainScale:args[1]??1,gain:null,voices:voices.length,contextTime:this.ctx.currentTime};
    frostTrace.push(event);setTimeout(()=>{event.gain=voice.gain.gain.value;},10);
   }
  }};
 })()`);
 assert.equal(await b.evaluate('audio.getDiagnostics().contextState'),'uninitialized');
 await b.click('MenuScene','sound-toggle');await b.click('MenuScene','sound-toggle');
 await b.waitFor('audio.getDiagnostics().unlocked&&audio.getDiagnostics().decodedSamples===41');
 const levels=await b.evaluate(`Array.from(audio.buffers).filter(([id])=>id.startsWith('boss_')).map(([id,buffer])=>{
  let peak=0,sum=0;const samples=buffer.getChannelData(0);for(const value of samples){peak=Math.max(peak,Math.abs(value));sum+=value*value;}
  return{id,duration:buffer.duration,peak,rms:Math.sqrt(sum/samples.length)};
 })`);
 assert.equal(levels.length,26);for(const row of levels){assert.ok(row.rms>.001,row.id);assert.ok(row.peak<=1,row.id);}
 report.levels=levels;report.checks.push('26 supplied OGG files decoded after a real touch; non-silent PCM');
 await b.click('MenuScene','new-run');await b.waitFor("smash.scene.isActive('GameScene')");
 await b.evaluate(`(async()=>{
  window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  const data=await import('/src/config/bossData.ts');window.bossProfiles=data.BOSS_PROFILES;
  window.soundData=await import('/src/config/bossSoundData.ts');
  window.prepareBoss=(id,stage,sequence)=>{
   gs.clearEncounter();audio.stopAllBossAudio(0);audio.lastStart={};audioTrace.length=0;frostTrace.length=0;audioStep=0;
   gs.progression.index=stage;gs.squad.health.maxHp=gs.squad.health.currentHp=10000000;
   for(const d of gs.squad.drones)d.health.maxHp=d.health.currentHp=10000000;
   const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile(id);
   gs.bossPatternNumber=sequence;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
   const hazards=gs.hazards.slots.filter(h=>h.active);
   return{warning:Math.min(...hazards.map(h=>h.warningMs)),endAge:Math.max(...hazards.map(h=>h.warningMs+h.duration+350)),skill:soundData.bossSkillSound(id,bossProfiles[id].patterns[sequence]),hazards:hazards.length};
  };
 })()`);
 const cases=[['forest_guardian',0],['swamp_lord',1],['lava_colossus',2],['frost_queen',3],['twilight_king',4],['desert_emperor',5]];
 for(const [id,stage]of cases){
  const count=await b.evaluate(`bossProfiles['${id}'].patterns.length`);
  for(let sequence=0;sequence<count;sequence++){
   const result=await b.evaluate(`(async()=>{
    const setup=prepareBoss('${id}',${stage},${sequence}),{warning,skill}=setup;
    const step=ms=>{audioStep+=ms;gs.hazards.update(ms);};
    step(warning-151);const early=audioTrace.slice();step(1);step(149);step(1);step(16);
    const active=audio.getDiagnostics().activeBySound;
    if(skill.repeatedImpact)for(let i=1;i<10;i++){
     await new Promise(resolve=>setTimeout(resolve,180));step(i===1?164:180);
    }
    step(Math.max(0,setup.endAge-audioStep));await new Promise(resolve=>setTimeout(resolve,30));const trace=audioTrace.slice();
    return{...setup,early,trace,active,frostTrace:[...frostTrace],remaining:gs.hazards.slots.filter(h=>h.active).length};
   })()`);
   assert.deepEqual(result.early,[{id:'boss_attack_warning',step:0}],id);
   assert.equal(result.trace.filter(e=>e.id==='boss_attack_warning').length,1,id);
   const casts=Array.from({length:result.skill.repeatedImpact?10:1},(_,i)=>({id:result.skill.cast,step:result.warning+i*180}));
   assert.deepEqual(result.trace.filter(e=>e.id===result.skill.cast),casts,id);
   if(result.skill.repeatedImpact){
    assert.equal(result.frostTrace.length,10);
    for(const [i,event]of result.frostTrace.entries()){
     assert.equal(event.gainScale,i===9?1:.35);
     assert.ok(Math.abs(event.gain-.65*event.gainScale)<1e-6,JSON.stringify(event));
     assert.ok(event.voices<=2);
    }
   }
   if(result.skill.fall)assert.deepEqual(result.trace.filter(e=>e.id===result.skill.fall),[{id:result.skill.fall,step:result.warning-150}],id);
   if(result.skill.loop){assert.equal(result.active[result.skill.loop],1);assert.equal(result.trace.filter(e=>e.id===result.skill.loop).length,1);}
   assert.equal(result.remaining,0);assert.equal(result.trace.some(e=>e.id==='boss_lava_meteor'||e.id==='boss_twilight_meteor'),false);
   report.cases.push({id,sequence,...result});
  }
 }
 await sleep(180);
 assert.equal(await b.evaluate('Object.entries(audio.getDiagnostics().activeBySound).filter(([id])=>id.endsWith("_loop")).reduce((n,[,count])=>n+count,0)'),0);
 report.checks.push('19 native GameScene skills: one warning per plan, queen barrage impacts at ten deadlines, fall -150ms, all loops end');
 await b.evaluate("prepareBoss('desert_emperor',5,0);gs.hazards.update(1200);undefined");
 assert.equal(await b.evaluate('audio.getDiagnostics().activeBySound.boss_desert_sandstorm_loop'),1);
 await b.evaluate('audio.setEnabled(false);undefined');await sleep(30);
 assert.equal(await b.evaluate('audio.getDiagnostics().activeVoices'),0);
 await b.evaluate('audio.setEnabled(true);gs.hazards.update(1);undefined');
 assert.equal(await b.evaluate('audio.getDiagnostics().activeBySound.boss_desert_sandstorm_loop'),1);
 await b.evaluate("gs.events.emit('pause');undefined");await sleep(180);
 assert.equal(await b.evaluate('audio.getDiagnostics().activeBySound.boss_desert_sandstorm_loop'),0);
 await b.evaluate("gs.events.emit('resume');gs.hazards.update(1);undefined");
 assert.equal(await b.evaluate('audio.getDiagnostics().activeBySound.boss_desert_sandstorm_loop'),1);
 await b.evaluate("smash.events.emit('hidden');undefined");await b.waitFor('audio.getDiagnostics().contextState==="suspended"');
 assert.equal(await b.evaluate('audio.getDiagnostics().activeVoices'),0);
 await b.evaluate("smash.events.emit('visible');undefined");await b.waitFor('audio.getDiagnostics().contextState==="running"');
 await b.evaluate('gs.scene.pause();gs.hazards.update(1);undefined');
 assert.equal(await b.evaluate('audio.getDiagnostics().activeBySound.boss_desert_sandstorm_loop'),1);
 report.checks.push('mute/unmute, scene pause/resume and background/foreground clear and recover only live loops');
 const death=await b.evaluate(`(()=>{
  gs.clearEncounter();audio.stopAllBossAudio(0);audio.lastStart={};audioTrace.length=0;
  gs.progression.index=0;gs.queueEnemy('BOSS_CORE',360,300);gs.processSpawns(0);
  const boss=gs.enemies.getChildren().find(e=>e.active&&e.bossId);
  gs.bossAudio.encounterStarted(boss.lifeId);gs.updateBossHud();
  gs.bossAudio.phaseChanged(boss.lifeId,2);gs.bossAudio.phaseChanged(boss.lifeId,2);
  gs.handleEnemyKilled(boss);gs.handleEnemyKilled(boss);
  return{trace:audioTrace.slice(),diagnostics:audio.getDiagnostics()};
 })()`);
 assert.equal(death.trace.filter(e=>e.id==='boss_encounter_start').length,1);
 assert.equal(death.trace.filter(e=>e.id==='boss_phase_change').length,1);
 assert.equal(death.trace.filter(e=>e.id==='boss_death').length,1);
 assert.equal(death.trace.some(e=>e.id==='death_enemy_elite'),false);report.death=death;
 report.checks.push('actual queued boss spawn, phase change and duplicate-kill guard emit each cue once; no elite death');
 await b.evaluate("gs.scene.start('MenuScene');undefined");await b.waitFor("smash.scene.isActive('MenuScene')");await sleep(180);
 assert.equal(await b.evaluate('gs.bossAudio.slots.size'),0);
 assert.equal(await b.evaluate('Object.entries(audio.getDiagnostics().activeBySound).filter(([id])=>id.endsWith("_loop")).reduce((n,[,count])=>n+count,0)'),0);
 assert.equal(await b.evaluate('audio.getDiagnostics().audioErrors'),0);
 assert.ok((await b.evaluate('audio.getDiagnostics().peakVoices'))<=8);assert.deepEqual(b.errors,[]);
 report.checks.push('scene shutdown releases field ownership; no audio errors and at most 8 voices');
 const preview=await b.evaluate(`(async()=>{
  const sample=audio.buffers.get('boss_frost_eruption'),warning=audio.buffers.get('boss_attack_warning');
  const rate=sample.sampleRate,duration=2.72+sample.duration+.05,ctx=new OfflineAudioContext(2,Math.ceil(duration*rate),rate);
  const cue=ctx.createBufferSource(),cueGain=ctx.createGain();cue.buffer=warning;cueGain.gain.value=.36;cue.connect(cueGain).connect(ctx.destination);cue.start(0);
  for(let i=0;i<10;i++){
   const start=1.1+i*.18,source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=sample;
   const level=.65*(i===9?1:.35);gain.gain.setValueAtTime(level,start);
   if(i<9){gain.gain.setValueAtTime(level,start+.18);gain.gain.linearRampToValueAtTime(0,start+.20);}
   source.connect(gain).connect(ctx.destination);source.start(start);
   if(i<9)source.stop(Math.min(start+.20,start+sample.duration));
  }
  const rendered=await ctx.startRendering(),channels=[rendered.getChannelData(0),rendered.getChannelData(1)];let peak=0,sum=0;
  const bytes=new ArrayBuffer(44+rendered.length*4),view=new DataView(bytes),put=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  put(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);put(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,rendered.length*4,true);
  for(let i=0;i<rendered.length;i++)for(let c=0;c<2;c++){const v=channels[c][i];peak=Math.max(peak,Math.abs(v));sum+=v*v;view.setInt16(44+(i*2+c)*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true);}
  const windowRms=start=>{let n=0;const a=Math.round((start+.03)*rate),end=Math.round((start+.13)*rate);for(let i=a;i<end;i++)n+=channels[0][i]**2;return Math.sqrt(n/(end-a));};
  const data=new Uint8Array(bytes);let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode(...data.subarray(i,i+32768));
  return{wav:btoa(binary),duration:rendered.duration,sampleRate:rate,peak,rms:Math.sqrt(sum/(rendered.length*2)),firstImpactRms:windowRms(1.1),finalImpactRms:windowRms(2.72)};
 })()`);
 assert.ok(preview.peak<1);assert.ok(preview.firstImpactRms>0);assert.ok(preview.finalImpactRms>preview.firstImpactRms*2);
 await writeFile(`${out}/frost-barrage-preview.wav`,Buffer.from(preview.wav,'base64'));
 delete preview.wav;report.preview=preview;
 report.status='passed';await writeFile(`${out}/result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,patterns:report.cases.length,samples:levels.length,checks:report.checks}));
}finally{b.close();}
