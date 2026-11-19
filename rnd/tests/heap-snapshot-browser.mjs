import assert from 'node:assert/strict';
import {createWriteStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {finished} from 'node:stream/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
import {installPerformanceFixture} from './helpers/performance-fixture.mjs';
import {analyzeHeapCheckpoints} from './helpers/analyze-heap.mjs';

const out='artifacts/heap-snapshot-20261119';
const names=['GameScene','PlayerSquad','EnemyGroup','Enemy','BulletGroup','Bullet','EffectParticleGroup','EffectParticle','VirtualJoystick','EncounterHazards','BossVfxController','BossAudioController','DroneUnit','HealthComponent','SquadRoster','Text2','CanvasTexture2','TextureManager2'];
const browser=await browserSession(),{evaluate,send,click,waitFor,onEvent}=browser;
const report={startedAt:new Date().toISOString(),checkpoints:[],cycles:[]};
try{
 await mkdir(out,{recursive:true});await send('HeapProfiler.enable');
 report.browser=await send('Browser.getVersion');
 await evaluate(`(async()=>{const {soundManager}=await import('/src/systems/SoundManager.ts');soundManager.setEnabled(false);})()`);
 await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 report.environment=await evaluate(`(()=>{window.gs=smash.scene.getScene('GameScene');window.retired=[];const gl=smash.renderer.gl,e=gl?.getExtension('WEBGL_debug_renderer_info');return{gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],audioEnabled:false,squadUnits:gs.squad.drones.length};})()`);
 assert.ok(report.environment.gpu&&!/swiftshader|llvmpipe|software|basic render|warp/i.test(report.environment.gpu),'hardware renderer required');
 await installPerformanceFixture(evaluate);
 const resources=()=>evaluate(`({children:gs.children.length,bodies:gs.physics.world.bodies.size,colliders:gs.physics.world.colliders.getActive().length,sceneListeners:gs.sys.events.eventNames().reduce((n,k)=>n+gs.sys.events.listenerCount(k),0),gameListeners:smash.events.eventNames().reduce((n,k)=>n+smash.events.listenerCount(k),0)})`);
 const snapshot=async label=>{
  await sleep(250);await send('HeapProfiler.collectGarbage');
  const row={label,heap:await send('Runtime.getHeapUsage'),resources:await resources(),file:out+'/'+label+'.heapsnapshot'};
  const stream=createWriteStream(row.file);let streamError,bytes=0;
  stream.on('error',error=>{streamError=error;});
  const unsubscribe=onEvent('HeapProfiler.addHeapSnapshotChunk',({chunk})=>{bytes+=Buffer.byteLength(chunk);stream.write(chunk);});
  try{await send('HeapProfiler.takeHeapSnapshot',{reportProgress:false});}
  finally{unsubscribe();stream.end();await finished(stream);}
  if(streamError)throw streamError;assert.ok(bytes>0);row.snapshotBytes=bytes;
  // The snapshot itself performs GC. Dereference only afterwards, so probes cannot keep objects alive during GC.
  row.retired=await evaluate(`retired.map(({cycle,refs})=>({cycle,alive:Object.entries(refs).filter(([,ref])=>ref.deref()!==undefined).map(([name])=>name)}))`);
  assert.ok(row.retired.every(record=>record.alive.length===0),'retired encounter objects must be collected');
  report.checkpoints.push(row);await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checkpoint:label,bytes,heap:row.heap.usedSize,aliveRetired:row.retired.filter(r=>r.alive.length)}));
 };
 // Compile/load the fixture and fill pools before comparing equal warmed states.
 await evaluate('runLoadCase(64,160,true)');await evaluate('runLoadCase(64,160,true)');await snapshot('baseline');
 for(let cycle=1;cycle<=12;cycle++){
  await evaluate(`retired.push({cycle:${cycle},refs:Object.fromEntries(['enemies','bullets','particles','squad','hazards','bossVfx','joystick','bossAudio'].map(name=>[name,new WeakRef(gs[name])]))});gs.handlePlayerDeath();undefined;`);
  await waitFor("smash.scene.isActive('GameOverScene')");await evaluate("smash.scene.getScene('GameOverScene').scene.start('GameScene');undefined;");await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');undefined;");
  const result=await evaluate('runLoadCase(64,160,true)');
  assert.equal(result.counts.enemies.min,64);assert.equal(result.counts.bullets.min,160);assert.equal(result.visualFailed,false);
  report.cycles.push({cycle,result,resources:await resources()});
  console.log(JSON.stringify({cycle,fps:result.fps}));
  if(cycle===6||cycle===12)await snapshot('restart-'+cycle);
 }
 report.analysis=await analyzeHeapCheckpoints(report.checkpoints,names);
 for(const checkpoint of report.checkpoints.slice(1))assert.equal(checkpoint.baselineSurvivorPaths.length,0,'baseline encounter instances must not survive a restart');
 assert.deepEqual(browser.errors,[]);report.status='passed';report.finishedAt=new Date().toISOString();
 await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
}catch(error){report.status='failed';report.error=error.stack;await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');throw error;}
finally{browser.close();}
