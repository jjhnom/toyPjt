import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
import {installPerformanceFixture} from './helpers/performance-fixture.mjs';

const selectedTeam=process.env.SMASH_FULL_LOAD_TEAM;
const out=selectedTeam==='legendary'?'artifacts/full-load-legendary-20261119':'artifacts/full-load-20261119',browser=await browserSession();
const {evaluate,click,waitFor,send}=browser;
const report={startedAt:new Date().toISOString(),cases:[]};
try{
 await mkdir(out,{recursive:true});report.browser=await send('Browser.getVersion');
 // Use the exact module URLs loaded by main, including any Vite timestamp.
 await evaluate(`(async()=>{
  const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]'),main=await(await fetch(entry.src)).text();
  window.audio=(await import(main.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1])).soundManager;
  window.music=(await import(main.match(/from ["']([^"']*systems\\/BgmManager\\.ts[^"']*)["']/)[1])).bgmManager;
  audio.setEnabled(true);audio.setMasterVolume(1);audio.setGroupVolume('sfx',1);music.setVolume(1);
 })()`);
 await click('MenuScene','sound-toggle');await click('MenuScene','sound-toggle');
 await waitFor('audio.getDiagnostics().decodedSamples===41&&audio.getDiagnostics().unlocked');
 await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 report.environment=await evaluate(`(()=>{window.gs=smash.scene.getScene('GameScene');const gl=smash.renderer.gl,e=gl?.getExtension('WEBGL_debug_renderer_info');return{gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],audio:audio.getDiagnostics(),music:music.getDiagnostics(),master:1,sfx:1};})()`);
 assert.ok(report.environment.gpu&&!/swiftshader|llvmpipe|software|basic render|warp/i.test(report.environment.gpu),'hardware renderer required');
 await installPerformanceFixture(evaluate);
 await evaluate(`window.soundCase=null;window.nativePlay=audio.playSound;
  audio.playSound=function(id,...args){const before=this.counters.played;nativePlay.call(this,id,...args);if(soundCase){soundCase.requests[id]=(soundCase.requests[id]??0)+1;if(this.counters.played>before)soundCase.admitted[id]=(soundCase.admitted[id]??0)+1;}};
  window.analyser=audio.ctx.createAnalyser();analyser.fftSize=2048;
  window.probeMute=audio.ctx.createGain();probeMute.gain.value=0;
  audio.outputGuard.connect(analyser);analyser.connect(probeMute);probeMute.connect(audio.ctx.destination);
  window.pcm=new Float32Array(analyser.fftSize);undefined;`);
 const teams={rapid:Array(6).fill('GATLING_BOT'),skills:['BLACKHOLE_MISSILE','THUNDER_MAGE','STORM_ARCHER','THORN_GUARD','PHOENIX_LORD','PIERCE_BEAM'],legendary:['BLACKHOLE_MISSILE','PHOENIX_LORD','STORM_GENERAL','EARTH_DEITY','PHOENIX_LORD','STORM_GENERAL']};
 if(selectedTeam)assert.ok(Object.hasOwn(teams,selectedTeam),'unknown selected team');
 const cases=[];for(const team of selectedTeam?[selectedTeam]:Object.keys(teams))for(const mode of ['off','battle','boss'])cases.push({team,mode});
 const run=async({team,mode},pass,crossfade=false)=>{
  const row=await evaluate(`(async()=>{
   const {UNIT_TYPES}=await import('/src/config/unitData.ts'),{SQUAD_LIMITS}=await import('/src/config/squadData.ts');
   const members=${JSON.stringify(teams[team])};
   if(members.length!==SQUAD_LIMITS.deployed)throw Error('Fixture must fill current deployment limit');
   gs.clearEncounter();audio.stopVoices(false);
   gs.squad.roster.units=members.map((archetype,i)=>({id:'load-'+i,archetype,tier:UNIT_TYPES[archetype].tier,star:3,deployed:true}));gs.squad.syncRoster();
   if(gs.squad.drones.length!==SQUAD_LIMITS.deployed)throw Error('Deployment did not fill all slots');
   audio.setEnabled(${mode!=='off'});music.play(gs,'${mode==='boss'?'bgm_twilight':'bgm_battle'}');
   const start=audio.getDiagnostics();soundCase={requests:{},admitted:{}};
   const observed={samples:0,maxVoices:0,maxTracks:0,bgmRunningSamples:0,bgmProgressSamples:0,contextRunningSamples:0,guardedSfxPeak:0,guardedSfxClippedSamples:0};
   let lastTime,lastTag,changes=0;
   const sampler=setInterval(()=>{
    const s=audio.getDiagnostics(),m=music.getDiagnostics(),tag=music.current?.sound.audio;observed.samples++;
    observed.maxVoices=Math.max(observed.maxVoices,s.activeVoices);observed.maxTracks=Math.max(observed.maxTracks,m.activeTracks);
    if(s.contextState==='running')observed.contextRunningSamples++;
    if(m.playing&&m.volume>0&&tag&&!tag.paused&&!tag.error&&tag.readyState>=2){observed.bgmRunningSamples++;if(tag===lastTag&&tag.currentTime!==lastTime)observed.bgmProgressSamples++;}
    lastTime=tag?.currentTime;lastTag=tag;
    analyser.getFloatTimeDomainData(pcm);for(const value of pcm){observed.guardedSfxPeak=Math.max(observed.guardedSfxPeak,Math.abs(value));if(Math.abs(value)>=1)observed.guardedSfxClippedSamples++;}
   },100);
   const transition=${crossfade}?setInterval(()=>{changes++;music.play(gs,changes%2?'bgm_twilight':'bgm_battle');},2500):null;
   try{
    const load=await runLoadCase(64,160,true,${crossfade?15000:10000});
    const end=audio.getDiagnostics(),musicEnd=music.getDiagnostics(),events=soundCase;soundCase=null;
    return{load,observed,start,end,musicEnd,events,changes,units:members,tiers:members.map(id=>UNIT_TYPES[id].tier),deployed:gs.squad.drones.length,star:3,contextTime:audio.ctx.currentTime};
   }finally{clearInterval(sampler);if(transition)clearInterval(transition);soundCase=null;}
  })()`);
  row.team=team;row.mode=mode;row.pass=pass;row.crossfade=crossfade;
  if(team==='legendary')assert.ok(row.tiers.every(tier=>tier===4),'all legendary members must be tier 4');
  assert.equal(row.deployed,6);assert.equal(row.load.counts.enemies.min,64);assert.equal(row.load.counts.bullets.min,160);
  assert.equal(row.load.visualFailed,false);assert.ok(row.load.counts.bossVfx.max>=12);
  assert.ok(row.load.counts.particles.max<=120);assert.equal(row.end.audioErrors,0);assert.ok(row.end.outputGuard);
  assert.ok(row.observed.maxVoices<=8);assert.equal(row.observed.guardedSfxClippedSamples,0);
  if(mode!=='off'){
   assert.ok(row.end.played>row.start.played);assert.ok(row.observed.bgmProgressSamples>50);
   assert.equal(row.observed.contextRunningSamples,row.observed.samples);assert.equal(row.musicEnd.errors,0);
   assert.ok(Object.keys(row.events.admitted).some(id=>id.startsWith('boss_')),'native boss sounds admitted');
   assert.ok(Object.keys(row.events.admitted).some(id=>!id.startsWith('boss_')),'native combat sounds admitted');
  }else assert.equal(row.end.played,row.start.played);
  if(crossfade){assert.ok(row.observed.maxTracks===2);assert.ok(row.changes>=5);}else assert.ok(row.observed.maxTracks<=2);
  report.cases.push(row);await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({team,mode,pass,crossfade,fps:row.load.fps,p95:row.load.frameTime.p95Ms,voices:row.observed.maxVoices,bgmProgress:row.observed.bgmProgressSamples,played:row.end.played-row.start.played}));
 };
 for(let pass=1;pass<=2;pass++)for(const c of pass===1?cases:[...cases].reverse())await run(c,pass);
 await run({team:selectedTeam??'skills',mode:'battle'},3,true);
 await evaluate('gs.clearEncounter();audio.stopVoices(false);music.stop();audio.outputGuard.disconnect(analyser);analyser.disconnect();probeMute.disconnect();audio.playSound=nativePlay;undefined;');
 await sleep(250);report.cleanup=await evaluate('({voices:audio.getDiagnostics().activeVoices,tracks:music.getDiagnostics().activeTracks,vfx:gs.bossVfx.activeCount,bullets:gs.bullets.countActive(true),enemies:gs.enemies.countActive(true)})');
 for(const value of Object.values(report.cleanup))assert.equal(value,0);
 assert.deepEqual(browser.errors,[]);report.status='passed';report.finishedAt=new Date().toISOString();
 await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
}catch(error){report.status='failed';report.error=error.stack;await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');throw error;}
finally{browser.close();}
