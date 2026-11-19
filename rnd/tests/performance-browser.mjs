import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import {browserSession} from './helpers/browser-session.mjs';
import {installPerformanceFixture} from './helpers/performance-fixture.mjs';

// Opt-in benchmark: report timings, assert fixture integrity, never assert host-specific FPS.
const hardware=process.env.SMASH_BROWSER_RENDERER==='hardware';
const soak=process.env.SMASH_PERFORMANCE_SOAK==='1';
const out=hardware?'artifacts/performance-hardware-20261119':'artifacts/performance-20261119';
const browser=await browserSession(),{evaluate,send,click,waitFor}=browser;
const report={startedAt:new Date().toISOString(),host:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},cases:[]};
try{
 await mkdir(out,{recursive:true});
 report.browser=await send('Browser.getVersion');
 await evaluate(`(async()=>{const {soundManager}=await import('/src/systems/SoundManager.ts');soundManager.setEnabled(false);})()`);
 await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 report.environment=await evaluate(`(()=>{window.gs=smash.scene.getScene('GameScene');const gl=smash.renderer.gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory,viewport:[innerWidth,innerHeight],gameSize:[smash.config.width,smash.config.height],renderer:gl?'WebGL':'Canvas',gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,squadUnits:gs.squad.drones.length,audioEnabled:false};})()`);
 if(hardware)assert.ok(report.environment.gpu&&!/swiftshader|llvmpipe|software|basic render|warp/i.test(report.environment.gpu),'hardware renderer required');
 // Each call stays below the CDP timeout. Production entity updates/physics/render remain running.
 await installPerformanceFixture(evaluate);
 const memory=async()=>{await send('HeapProfiler.collectGarbage');return send('Runtime.getHeapUsage');};
 // Warm maximum-sized pools before retained-heap baseline (not a timed result).
 await evaluate('runLoadCase(64,160,true)');report.heapBaseline=await memory();
 const cases=[];for(const e of [10,32,64])for(const b of [40,100,160])cases.push([e,b,false]);cases.push([32,100,true],[64,160,true]);
 for(let pass=1;pass<=2;pass++)for(const [e,b,vfx]of(pass===1?cases:[...cases].reverse())){
  const result=await evaluate(`runLoadCase(${e},${b},${vfx})`);result.pass=pass;
  assert.ok(result.frames>30&&Number.isFinite(result.fps),'valid frame samples');
  assert.equal(result.counts.enemies.min,e);assert.equal(result.counts.enemies.max,e);
  assert.equal(result.counts.bullets.min,b);assert.equal(result.counts.bullets.max,b);
  assert.equal(result.visualFailed,false);assert.ok(result.counts.particles.max<=120);assert.ok(result.counts.bossVfx.max<=32);
  if(vfx)assert.ok(result.counts.bossVfx.max>0&&result.hazardsAdded>=12);
  report.cases.push(result);await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({pass,enemies:e,bullets:b,vfx,fps:result.fps,p95:result.frameTime.p95Ms}));
 }
 report.heapAfter=await memory();report.retainedHeapDeltaBytes=report.heapAfter.usedSize-report.heapBaseline.usedSize;
 if(soak){
  const start=Date.now();report.soak={startedAt:new Date().toISOString(),targetObservedMs:900000,samples:[],restarts:[]};
  const resources=()=>evaluate(`({children:gs.children.length,bodies:gs.physics.world.bodies.size,colliders:gs.physics.world.colliders.getActive().length,sceneListeners:gs.sys.events.eventNames().reduce((n,k)=>n+gs.sys.events.listenerCount(k),0),gameListeners:smash.events.eventNames().reduce((n,k)=>n+smash.events.listenerCount(k),0),enemyPool:gs.enemies.getLength(),bulletPool:gs.bullets.getLength(),particlePool:gs.particles.getLength(),sceneCount:smash.scene.scenes.length})`);
  report.soak.baseline={heap:await memory(),resources:await resources()};
  for(let cycle=1;cycle<=36;cycle++){
   const result=await evaluate('runLoadCase(64,160,true,25000)');
   assert.equal(result.counts.enemies.min,64);assert.equal(result.counts.bullets.min,160);assert.equal(result.visualFailed,false);
   const row={cycle,elapsedMs:Date.now()-start,result,heapBeforeGc:await send('Runtime.getHeapUsage'),resources:await resources()};
   if(cycle%3===0)row.heapAfterGc=await memory();
   report.soak.samples.push(row);
   if(cycle%6===0){
    await evaluate('gs.handlePlayerDeath();undefined;');await waitFor("smash.scene.isActive('GameOverScene')");
    await evaluate("smash.scene.getScene('GameOverScene').scene.start('GameScene');undefined;");await waitFor("smash.scene.isActive('GameScene')");
    await evaluate("window.gs=smash.scene.getScene('GameScene');gs.clearEncounter();gs.roomState='TRANSITION';undefined;");
    report.soak.restarts.push({cycle,heapAfterGc:await memory(),resources:await resources()});
   }
   await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');
   console.log(JSON.stringify({soakCycle:cycle,elapsedSeconds:Math.round((Date.now()-start)/1000),fps:result.fps,heapAfterGc:row.heapAfterGc?.usedSize,restarts:report.soak.restarts.length}));
  }
  report.soak.finishedAt=new Date().toISOString();report.soak.elapsedMs=Date.now()-start;
  report.soak.observedMs=report.soak.samples.reduce((n,s)=>n+s.result.durationMs,0);
  assert.ok(report.soak.observedMs>=900000,'at least 15 minutes observed load');
 }
 report.cleanup=await evaluate(`({enemies:gs.enemies.countActive(true),bullets:gs.bullets.countActive(true),particles:gs.particles.countActive(true),vfx:gs.bossVfx.activeCount,hazards:gs.hazards.slots.filter(h=>h.active).length,benchmarkSceneListeners:gs.sys.events.listeners('postupdate').filter(fn=>fn.name==='maintain').length})`);
 for(const value of Object.values(report.cleanup))assert.equal(value,0,'fixture cleanup');
 assert.deepEqual(browser.errors,[]);report.status='passed';report.finishedAt=new Date().toISOString();
 await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');
}finally{browser.close();}
