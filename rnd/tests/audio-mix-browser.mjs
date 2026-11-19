import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const out='artifacts/audio-mix-20261118',b=await browserSession();
try{
 await mkdir(out,{recursive:true});
 await b.evaluate(`(async()=>{
  const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]'),main=await(await fetch(entry.src)).text();
  window.audio=(await import(main.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1])).soundManager;
  window.music=(await import(main.match(/from ["']([^"']*systems\\/BgmManager\\.ts[^"']*)["']/)[1])).bgmManager;
  window.definitions=(await import('/src/config/soundData.ts')).SOUND_DEFINITIONS;
 })()`);
 await b.click('MenuScene','sound-toggle');await b.click('MenuScene','sound-toggle');
 await b.waitFor('audio.getDiagnostics().decodedSamples===41&&audio.getDiagnostics().unlocked');
 await b.click('MenuScene','new-run');await b.waitFor("smash.scene.isActive('GameScene')");
 await b.evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();undefined;`);
 await b.waitFor("music.getDiagnostics().current==='bgm_battle'");await sleep(650);
 const native=await b.evaluate(`(async()=>{
  const {planBossAttack}=await import('/src/config/bossData.ts');
  window.mixCases=[];let current,origin=0;const records=new WeakMap();
  const play=audio.playSound.bind(audio),fade=audio.fadeBossVoice.bind(audio);
  audio.playSound=function(id,...args){
   const before=this.getDiagnostics().played;play(id,...args);
   if(!current||this.getDiagnostics().played===before)return;
   const voice=Array.from(this.voices).at(-1),buffer=voice.osc.buffer;
   if(!buffer)throw Error('Mix fixture contains an unmeasured oscillator: '+id);
   const def=definitions[id],start=this.ctx.currentTime-origin;
   const event={id,start,stop:def.loop?Infinity:start+buffer.duration,loop:!!def.loop,
    gain:(def.sampleGain??def.gain)*voice.gainScale*(def.bossBus?this.bossVolumes[def.bossBus]:1)};
   current.events.push(event);records.set(voice,event);
   const stop=voice.osc.stop.bind(voice.osc);
   voice.osc.stop=when=>{event.stop=(when??this.ctx.currentTime)-origin;return stop(when);};
  };
  audio.fadeBossVoice=function(voice,ms){const stopping=voice.stopping,at=this.ctx.currentTime-origin;fade(voice,ms);
   const event=records.get(voice);if(event&&!stopping&&voice.stopping)event.fade={at,seconds:ms/1000};
  };
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(const name of ['combat-barrage','eight-voice-burst']){
   gs.clearEncounter();audio.stopVoices(false);origin=audio.ctx.currentTime;
   current={name,events:[],maxVoices:0};mixCases.push(current);
   if(name==='combat-barrage'){
    const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,300);boss.applyBossProfile('frost_queen');
    gs.squad.setPositionImmediate(360,1000);gs.squad.health.currentHp=gs.squad.health.maxHp=100000;
    for(const a of planBossAttack('frost_queen',2,2,{x:360,y:300,speed:80},{x:360,y:630}).attacks)
     gs.hazards.add(a.kind,a.x,a.y,10,boss.lifeId,{...a,bossId:'frost_queen',patternId:900});
    audio.startBossLoop('boss_frost_field_loop');
    for(let i=0;i<40;i++){
     audio.playCombat(i%2?'attack_arrow':'attack_fire_magic');
     if(i%3===0)audio.playCombat('hit_critical');
     if(i%7===0)audio.playCombat('death_enemy_elite');
     await pause(80);gs.hazards.update(80);
     current.maxVoices=Math.max(current.maxVoices,audio.getDiagnostics().activeVoices);
    }
   }else{
    audio.playCombat('attack_fire_magic');audio.playCombat('hit_critical');audio.playCombat('death_enemy_elite');
    audio.startBossLoop('boss_frost_field_loop');
    for(const id of ['boss_frost_eruption','boss_phase_change','boss_frost_summon','boss_attack_warning'])audio.playBoss(id);
    current.maxVoices=audio.getDiagnostics().activeVoices;
    if(current.maxVoices!==8)throw Error('Stress fixture did not reach eight admitted voices');
    await pause(1600);
   }
   gs.clearEncounter();audio.stopVoices(false);current.duration=audio.ctx.currentTime-origin+.05;
   for(const event of current.events){if(!Number.isFinite(event.stop))throw Error('Unreleased mix voice');}
   current=undefined;
  }
  const {BGM_TRACKS}=await import('/src/config/bgmData.ts');window.mixMusic={};
  for(const [key,track]of Object.entries(BGM_TRACKS)){
   const buffer=await audio.ctx.decodeAudioData(await(await fetch('audio/bgm/'+track.file)).arrayBuffer());let peak=0;
   for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(value));
   mixMusic[key]={volume:track.volume,buffer,peak};
  }
  window.mixGuardFactory=audio.outputGuard?(await import('/src/systems/audioMix.ts')).createAudioOutputGuard:null;
  return {cases:mixCases.map(c=>({name:c.name,events:c.events.length,maxVoices:c.maxVoices,duration:c.duration})),diagnostics:audio.getDiagnostics(),music:music.getDiagnostics(),musicPcm:Object.entries(mixMusic).map(([key,m])=>({key,volume:m.volume,peak:m.peak}))};
 })()`);
 for(const c of native.cases)assert.ok(c.maxVoices<=8);
 assert.equal(native.diagnostics.audioErrors,0);
 assert.equal(native.diagnostics.outputGuard,true);
 for(const track of native.musicPcm)assert.ok(track.peak<1);
 const rendered=await b.evaluate(`(async()=>{
  const rows=[];let worst,unprotectedWorst,preview;
  for(const c of mixCases)for(const [key,music]of Object.entries(mixMusic))for(const offset of [0,5,11])for(const guarded of [false,true]){
   const rate=48000,ctx=new OfflineAudioContext(2,Math.ceil(c.duration*rate),rate),sfx=ctx.createGain();
   const guard=guarded?mixGuardFactory?.(ctx):undefined;
   if(guard){sfx.connect(guard);guard.connect(ctx.destination);}else sfx.connect(ctx.destination);
   for(const e of c.events){
    if(e.stop<=e.start)continue;
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=audio.buffers.get(e.id);source.loop=e.loop;
    gain.gain.setValueAtTime(e.loop?0:e.gain,e.start);if(e.loop)gain.gain.linearRampToValueAtTime(e.gain,e.start+.03);
    if(e.fade){gain.gain.setValueAtTime(e.gain,e.fade.at);gain.gain.linearRampToValueAtTime(0,e.fade.at+e.fade.seconds);}
    source.connect(gain).connect(sfx);source.start(e.start);source.stop(Math.max(e.start,e.stop));
   }
   const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=music.buffer;gain.gain.value=music.volume;source.connect(gain).connect(ctx.destination);source.start(0,offset);
   const result=await ctx.startRendering();let peak=0,sum=0,clipped=0;
   for(let channel=0;channel<2;channel++)for(const v of result.getChannelData(channel)){peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=1)clipped++;}
   const row={scene:c.name,music:key,offset,guarded:!!guard,peak,rms:Math.sqrt(sum/(result.length*2)),clippedSamples:clipped};rows.push(row);
   if(guarded&&(!worst||peak>worst.peak)){worst=row;preview=result;}
   if(!guarded&&(!unprotectedWorst||peak>unprotectedWorst.peak))unprotectedWorst=row;
  }
  const bytes=new ArrayBuffer(44+preview.length*4),view=new DataView(bytes),put=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  put(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);put(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,preview.length*4,true);
  for(let i=0;i<preview.length;i++)for(let channel=0;channel<2;channel++)view.setInt16(44+(i*2+channel)*2,Math.round(Math.max(-1,Math.min(1,preview.getChannelData(channel)[i]))*32767),true);
  const data=new Uint8Array(bytes);let text='';for(let i=0;i<data.length;i+=32768)text+=String.fromCharCode(...data.subarray(i,i+32768));
  return {rows,worst,unprotectedWorst,wav:btoa(text)};
 })()`);
 const {wav,...metrics}=rendered;
 const protectedRows=rendered.rows.filter(r=>r.guarded);
 const report={native,...metrics,status:protectedRows.some(r=>r.clippedSamples>0)?'clipping-detected':'passed'};
 await writeFile(`${out}/result.json`,JSON.stringify(report,null,2)+'\n');
 assert.equal(protectedRows.length,18);
 assert.ok(rendered.unprotectedWorst.peak>1,'fixture must exercise actual output overload');
 assert.ok(protectedRows.every(r=>r.clippedSamples===0),JSON.stringify(rendered.worst));
 await writeFile(`${out}/mix-preview.wav`,Buffer.from(wav,'base64'));
 await b.evaluate("audio.playBoss('boss_frost_eruption');audio.setEnabled(false);undefined");await sleep(40);
 assert.equal(await b.evaluate('audio.getDiagnostics().activeVoices'),0);
 assert.equal(await b.evaluate('music.getDiagnostics().paused'),true);
 await b.evaluate('audio.setEnabled(true);undefined');await b.waitFor('!music.getDiagnostics().paused');
 assert.equal(await b.evaluate('audio.getDiagnostics().activeVoices'),0);
 await b.evaluate("audio.playBoss('boss_frost_eruption');smash.events.emit('hidden');undefined");
 await b.waitFor("audio.getDiagnostics().contextState==='suspended'");
 assert.equal(await b.evaluate('music.getDiagnostics().paused'),true);
 assert.equal(await b.evaluate('audio.getDiagnostics().activeVoices'),0);
 await b.evaluate("smash.events.emit('visible');gs.scene.pause();undefined");
 await b.waitFor("audio.getDiagnostics().contextState==='running'&&!music.getDiagnostics().paused");
 assert.equal(await b.evaluate('audio.getDiagnostics().activeVoices'),0);
 report.lifecycle='global mute and hidden/visible pause both outputs; foreground does not replay past SFX';
 await writeFile(`${out}/result.json`,JSON.stringify(report,null,2)+'\n');
 assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({status:'passed',cases:native.cases,measurements:rendered.rows.length,worst:rendered.worst}));
}finally{b.close();}
