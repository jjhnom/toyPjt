import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {load} from './helpers/skill-fixture.mjs';
import {FakeAudioContext,flush} from './helpers/fake-audio.mjs';
const {BgmManager}=load('src/systems/BgmManager.ts');
const {BGM_TRACKS}=load('src/config/bgmData.ts');
const {SoundManager}=load('src/systems/SoundManager.ts');
const {installSoundLifecycle}=load('src/systems/soundLifecycle.ts');

class Music {
 isPlaying=false;isPaused=false;pendingRemove=false;volume=0;plays=0;resumes=0;audio={paused:true,currentTime:0,loop:false};
 constructor(manager,key){this.manager=manager;this.key=key;}
 play(){this.plays++;if(this.manager.failPlay)return false;this.isPlaying=true;this.audio.paused=false;return true;}
 pause(){if(!this.isPlaying)return false;this.isPlaying=false;this.isPaused=true;this.audio.paused=true;return true;}
 resume(){this.resumes++;if(this.manager.failResume)return false;this.isPaused=false;this.isPlaying=true;this.audio.paused=false;return true;}
 stop(){this.isPlaying=this.isPaused=false;this.audio.paused=true;}
 destroy(){this.pendingRemove=true;}
 setVolume(value){assert.ok(Number.isFinite(value)&&value>=0&&value<=1);this.volume=value;}
}
class Tag extends EventTarget {
 dataset={locked:'true'};loads=0;listeners=0;
 load(){this.loads++;}
 addEventListener(...args){this.listeners++;super.addEventListener(...args);}
 removeEventListener(...args){this.listeners--;super.removeEventListener(...args);}
}
function fixture(locked=false){
 const tags=new Map(Object.keys(BGM_TRACKS).map(key=>[key,locked?[new Tag()]:[]]));
 const sound=new EventEmitter();Object.assign(sound,{locked,sounds:[],pauseOnBlur:true,loopEndOffset:.05,unlocks:0});
 sound.add=key=>{if(sound.failAdd)throw Error('unavailable');const music=new Music(sound,key);sound.sounds.push(music);return music;};
 sound.unlock=()=>{sound.unlocks++;sound.locked=[...tags.values()].flat().some(tag=>tag.dataset.locked==='true');};
 const game={sound,events:new EventEmitter()},scene={game,cache:{audio:{exists:key=>tags.has(key),get:key=>tags.get(key)}}};
 const bgm=new BgmManager();
 return{bgm,sound,scene,game,tags,step(ms){game.events.emit('step',0,ms);},active(){return sound.sounds.filter(s=>!s.pendingRemove);}};
}

test('three shipped BGM OGG files match supplied originals and keep the guide mixing levels',()=>{
 assert.deepEqual(Object.values(BGM_TRACKS).map(t=>t.volume),[.22,.17,.15]);
 for(const track of Object.values(BGM_TRACKS)){
  const bytes=readFileSync(`public/audio/bgm/${track.file}`);
  assert.equal(bytes.subarray(0,4).toString(),'OggS');
  assert.deepEqual(bytes,readFileSync(`.agent/skills/sound/20261116/audio/ogg/${track.file}`));
 }
});

test('music waits for a gesture and only starts the latest scene request, without per-scene listeners',()=>{
 const f=fixture();
 f.bgm.play(f.scene,'bgm_lobby');f.bgm.play(f.scene,'bgm_battle');
 assert.equal(f.active().length,0);assert.equal(f.game.events.listenerCount('step'),1);
 f.bgm.unlockFromUserGesture();f.step(600);
 assert.equal(f.bgm.getDiagnostics().current,'bgm_battle');assert.equal(f.active().length,1);assert.equal(f.active()[0].volume,.17);
 for(let i=0;i<100;i++)f.bgm.play(f.scene,'bgm_battle');
 assert.equal(f.bgm.getDiagnostics().starts,1);assert.equal(f.sound.listenerCount('unlocked'),1);
 assert.equal(f.active()[0].audio.loop,true);assert.equal(f.sound.loopEndOffset,0);f.bgm.dispose();
});

test('rapid crossfades preserve actual fade levels, keep at most two tracks and release every cancelled tail',()=>{
 const f=fixture();f.bgm.play(f.scene,'bgm_lobby');f.bgm.unlockFromUserGesture();f.step(600);
 const lobby=f.active()[0];f.bgm.play(f.scene,'bgm_battle');f.step(300);
 const battle=f.active().find(s=>s.key==='bgm_battle');assert.equal(lobby.volume,.11);assert.equal(battle.volume,.085);
 f.bgm.play(f.scene,'bgm_twilight');assert.equal(lobby.pendingRemove,true);assert.equal(f.active().length,2);
 f.step(300);assert.equal(battle.volume,.0425);f.step(300);
 assert.equal(f.active().length,1);assert.equal(f.active()[0].volume,.15);
 for(let i=0;i<30;i++){f.bgm.play(f.scene,i%2?'bgm_battle':'bgm_lobby');f.step(30);assert.ok(f.active().length<=2);}
 f.bgm.stop();f.step(10000);assert.equal(f.active().length,0);assert.equal(f.bgm.getDiagnostics().desired,null);f.bgm.dispose();
});

test('mute and live volume changes cannot be overwritten by an old crossfade target',()=>{
 const f=fixture();f.bgm.play(f.scene,'bgm_lobby');f.bgm.unlockFromUserGesture();f.step(300);
 f.bgm.setVolume(.5);assert.equal(f.active()[0].volume,.055);f.step(300);assert.equal(f.active()[0].volume,.11);
 f.bgm.play(f.scene,'bgm_battle');f.step(100);f.bgm.setMuted(true);f.step(2000);
 assert.equal(f.active().length,1);assert.equal(f.active()[0].volume,0);assert.equal(f.active()[0].isPaused,true);
 f.bgm.play(f.scene,'bgm_twilight');assert.equal(f.active().length,0);
 f.bgm.setMuted(false);f.step(600);assert.equal(f.active()[0].key,'bgm_twilight');assert.equal(f.active()[0].volume,.075);
 for(const value of[NaN,Infinity,-1]){f.bgm.setVolume(value);assert.equal(f.active()[0].volume,0);}
 f.bgm.setVolume(1);assert.equal(f.active()[0].volume,.15);f.bgm.dispose();
});

test('overlapping background reasons pause music until all clear, preserving position and retrying rejected resumes',()=>{
 const f=fixture();f.bgm.play(f.scene,'bgm_battle');f.bgm.unlockFromUserGesture();f.step(600);
 const music=f.active()[0];music.audio.currentTime=12;
 f.bgm.suspendForBackground('game');f.bgm.suspendForBackground('document');f.bgm.resumeAfterForeground('game');
 assert.equal(music.isPaused,true);assert.equal(music.volume,0);
 f.sound.failResume=true;f.bgm.resumeAfterForeground('document');assert.equal(music.isPaused,true);
 f.sound.failResume=false;f.bgm.unlockFromUserGesture();assert.equal(music.isPlaying,true);assert.equal(music.audio.currentTime,12);
 assert.equal(music.plays,1);assert.equal(f.bgm.getDiagnostics().starts,1);f.bgm.dispose();
});

test('touch-loaded tags unlock only the latest requested song, handle errors, and remove pending listeners on disposal',()=>{
 const f=fixture(true);f.bgm.play(f.scene,'bgm_lobby');f.bgm.unlockFromUserGesture();
 assert.equal(f.active().length,0);f.bgm.play(f.scene,'bgm_twilight');
 const tags=[...f.tags.values()].flat();assert.ok(tags.every(t=>t.loads===1));
 tags[0].dispatchEvent(new Event('canplaythrough'));tags[1].dispatchEvent(new Event('canplaythrough'));
 assert.equal(f.active().length,0);tags[2].dispatchEvent(new Event('canplaythrough'));
 assert.equal(f.active()[0].key,'bgm_twilight');assert.ok(tags.every(t=>t.listeners===0));f.bgm.dispose();
 const pending=fixture(true);pending.bgm.play(pending.scene,'bgm_lobby');pending.bgm.unlockFromUserGesture();pending.bgm.dispose();
 for(const tag of [...pending.tags.values()].flat()){assert.equal(tag.listeners,0);tag.dispatchEvent(new Event('canplaythrough'));}
 assert.equal(pending.active().length,0);assert.equal(pending.game.events.listenerCount('step'),0);
 const bad=fixture(true);bad.bgm.play(bad.scene,'bgm_lobby');bad.bgm.unlockFromUserGesture();
 for(const [key,[tag]]of bad.tags)tag.dispatchEvent(new Event(key==='bgm_lobby'?'error':'canplaythrough'));
 assert.equal(bad.active().length,0);bad.bgm.play(bad.scene,'bgm_battle');assert.equal(bad.active().length,1);bad.bgm.dispose();
});

test('missing files, allocation/play failures and asynchronous media rejection never block scene requests',()=>{
 const f=fixture();f.tags.delete('bgm_lobby');assert.doesNotThrow(()=>f.bgm.play(f.scene,'bgm_lobby'));f.bgm.unlockFromUserGesture();assert.equal(f.active().length,0);
 f.sound.failAdd=true;assert.doesNotThrow(()=>f.bgm.play(f.scene,'bgm_battle'));assert.equal(f.active().length,0);
 f.sound.failAdd=false;f.sound.failPlay=true;f.bgm.unlockFromUserGesture();assert.equal(f.active().length,0);
 f.sound.failPlay=false;f.bgm.unlockFromUserGesture();assert.equal(f.active().length,1);
 f.active()[0].audio.paused=true;f.bgm.unlockFromUserGesture();assert.equal(f.active()[0].audio.paused,false);f.bgm.dispose();
});

test('the existing global lifecycle shares toggle/master settings and gesture/visibility listeners with BGM, preserving SFX groups',async()=>{
 const f=fixture(),ctx=new FakeAudioContext(),sfx=new SoundManager({createContext:()=>ctx});
 const doc=new EventTarget(),win=new EventTarget();doc.hidden=false;
 const cleanup=installSoundLifecycle(sfx,f.game.events,doc,win,f.bgm);f.bgm.play(f.scene,'bgm_lobby');
 assert.equal(installSoundLifecycle(sfx,f.game.events,doc,win,f.bgm),cleanup);assert.equal(f.game.events.listenerCount('hidden'),1);
 sfx.setEnabled(false);doc.dispatchEvent(new Event('pointerup'));await flush();assert.equal(ctx.resumeCalls,0);assert.equal(f.active().length,0);
 sfx.setEnabled(true);doc.dispatchEvent(new Event('keydown'));await flush();f.step(600);assert.equal(f.active()[0].volume,.22);
 sfx.setMasterVolume(.5);assert.equal(f.active()[0].volume,.11);sfx.setGroupVolume('sfx',0);assert.equal(f.active()[0].volume,.11);
 f.bgm.setVolume(.5);assert.equal(f.active()[0].volume,.055);assert.equal(sfx.getSettings().masterVolume,.5);
 f.game.events.emit('hidden');doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.active()[0].isPaused,true);
 f.game.events.emit('visible');assert.equal(f.active()[0].isPaused,true);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(f.active()[0].isPlaying,true);
 f.game.events.emit('destroy');await flush();assert.equal(f.active().length,0);assert.equal(f.game.events.listenerCount('step'),0);assert.equal(ctx.closeCalls,1);
 assert.equal(sfx.settingsListeners.size,0);cleanup();
});
