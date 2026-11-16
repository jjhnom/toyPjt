import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const out='artifacts/boss-audio-20261113',b=await browserSession(),report={cases:[],checks:[]};
try{
 await mkdir(out,{recursive:true});
 await b.evaluate(`(async()=>{
  const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]');
  const main=await(await fetch(entry.src)).text(),url=main.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1];
  window.audio=(await import(url)).soundManager;
  window.audioTrace=[];window.audioStep=0;const play=audio.playSound.bind(audio);
  audio.playSound=function(id,...args){const n=this.getDiagnostics().played;play(id,...args);if(this.getDiagnostics().played>n)audioTrace.push({id,step:audioStep});};
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
   gs.clearEncounter();audio.stopAllBossAudio(0);audio.lastStart={};audioTrace.length=0;audioStep=0;
   gs.progression.index=stage;gs.squad.health.maxHp=gs.squad.health.currentHp=10000000;
   for(const d of gs.squad.drones)d.health.maxHp=d.health.currentHp=10000000;
   const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile(id);
   gs.bossPatternNumber=sequence;gs.bossPatternLeft=0;gs.updateBossPatterns(0);
   return{warning:bossProfiles[id].warningMs,skill:soundData.bossSkillSound(id,bossProfiles[id].patterns[sequence]),hazards:gs.hazards.slots.filter(h=>h.active).length};
  };
 })()`);
 const cases=[['forest_guardian',0],['swamp_lord',1],['lava_colossus',2],['frost_queen',3],['twilight_king',4],['desert_emperor',5]];
 for(const [id,stage]of cases){
  const count=await b.evaluate(`bossProfiles['${id}'].patterns.length`);
  for(let sequence=0;sequence<count;sequence++){
   const result=await b.evaluate(`(()=>{
    const setup=prepareBoss('${id}',${stage},${sequence}),{warning,skill}=setup;
    const step=ms=>{audioStep+=ms;gs.hazards.update(ms);};
    step(warning-151);const early=audioTrace.slice();step(1);step(149);step(1);step(16);
    const active=audio.getDiagnostics().activeBySound;step(2600);const trace=audioTrace.slice();
    return{...setup,early,trace,active,remaining:gs.hazards.slots.filter(h=>h.active).length};
   })()`);
   assert.deepEqual(result.early,[{id:'boss_attack_warning',step:0}],id);
   assert.equal(result.trace.filter(e=>e.id==='boss_attack_warning').length,1,id);
   assert.deepEqual(result.trace.filter(e=>e.id===result.skill.cast),[{id:result.skill.cast,step:result.warning}],id);
   if(result.skill.fall)assert.deepEqual(result.trace.filter(e=>e.id===result.skill.fall),[{id:result.skill.fall,step:result.warning-150}],id);
   if(result.skill.loop){assert.equal(result.active[result.skill.loop],1);assert.equal(result.trace.filter(e=>e.id===result.skill.loop).length,1);}
   assert.equal(result.remaining,0);assert.equal(result.trace.some(e=>e.id==='boss_lava_meteor'||e.id==='boss_twilight_meteor'),false);
   report.cases.push({id,sequence,...result});
  }
 }
 await sleep(180);
 assert.equal(await b.evaluate('Object.entries(audio.getDiagnostics().activeBySound).filter(([id])=>id.endsWith("_loop")).reduce((n,[,count])=>n+count,0)'),0);
 report.checks.push('13 native GameScene skills: one warning/cast per plan, fall -150ms, impact at deadline, all loops end');
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
 report.status='passed';await writeFile(`${out}/result.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,patterns:report.cases.length,samples:levels.length,checks:report.checks}));
}finally{b.close();}
