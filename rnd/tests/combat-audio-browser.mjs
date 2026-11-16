import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const out='artifacts/audio-phase2-20261113',b=await browserSession();
try{
 const manifest=JSON.parse(await readFile('.agent/skills/sound/20261113/rnd_phase2_combat_sfx_v2/manifest.json','utf8'));
 await b.evaluate(`(async()=>{const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]'),text=await(await fetch(entry.src)).text(),url=text.match(/from ["']([^"']*systems\\/SoundManager\\.ts[^"']*)["']/)[1];window.audio=(await import(url)).soundManager;window.sfxTrace={buffers:0,oscillators:0};const p=AudioContext.prototype,buffer=p.createBufferSource,osc=p.createOscillator;p.createBufferSource=function(){sfxTrace.buffers++;return buffer.call(this);};p.createOscillator=function(){sfxTrace.oscillators++;return osc.call(this);};})()`);
 await b.click('MenuScene','sound-toggle');await b.click('MenuScene','sound-toggle');
 await b.waitFor('audio.getDiagnostics().contextState==="running"&&audio.getDiagnostics().unlocked');
 await b.click('MenuScene','new-run');await b.waitFor("smash.scene.isActive('GameScene')");await b.waitFor('audio.getDiagnostics().decodedSamples===41');
 console.log(await b.evaluate('JSON.stringify(audio.getDiagnostics())'));
 await b.evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();undefined");await sleep(500);
 const levels=await b.evaluate(`Array.from(audio.buffers).filter(([id])=>!id.startsWith('boss_')).map(([id,buffer])=>{let peak=0,sum=0,edge=0;const d=buffer.getChannelData(0);for(let i=0;i<d.length;i++){peak=Math.max(peak,Math.abs(d[i]));sum+=d[i]*d[i];if(i<16||i>=d.length-16)edge=Math.max(edge,Math.abs(d[i]));}return{id,duration:buffer.duration,peak,rms:Math.sqrt(sum/d.length),edge};})`);
 assert.equal(levels.length,15);for(const row of levels){const source=manifest.find(m=>m.id===row.id);assert.ok(Math.abs(row.duration-source.duration_s)<.05);assert.ok(row.peak<1&&row.rms>.005);assert.ok(row.edge<.1);}
 const before=await b.evaluate('({...sfxTrace})');
 for(const row of manifest){const played=await b.evaluate(`audio.getDiagnostics().played`);await b.evaluate(`audio.playCombat('${row.id}');undefined`);assert.equal(await b.evaluate('audio.getDiagnostics().played'),played+1);await sleep(350);}
 const preview=await b.evaluate('({...sfxTrace})');assert.equal(preview.buffers-before.buffers,15);assert.equal(preview.oscillators-before.oscillators,0,'decoded sample events must not synthesize oscillators');
 await b.evaluate(`gs.squad.health.maxHp=gs.squad.health.currentHp=100000;const target=gs.enemies.spawnEnemy('TANK',360,550);target.health.maxHp=target.health.currentHp=1000000;gs.scene.resume();undefined`);
 const observation=[];for(let i=0;i<6;i++){await sleep(5000);const d=await b.evaluate('audio.getDiagnostics()');assert.ok(d.activeVoices<=8&&d.peakVoices<=8);assert.equal(d.audioErrors,0);observation.push(d);}
 assert.ok(observation.at(-1).played>observation[0].played);assert.ok((await b.evaluate('sfxTrace.buffers'))>preview.buffers);
 await b.evaluate('gs.scene.pause();undefined');assert.deepEqual(b.errors,[]);
 await writeFile(`${out}/combat-browser-result.json`,JSON.stringify({levels,previewDelta:{buffers:preview.buffers-before.buffers,oscillators:preview.oscillators-before.oscillators},observation,status:'passed'},null,2));
 console.log('15 real OGG files decoded with non-silent unclipped PCM; all sample IDs played, 30s controlled combat stayed within 8 voices without audio errors.');
}finally{b.close();}
