import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
import {load} from '../scripts/lib/load-typescript.mjs';
const {getStageDefinition,getStageScaling}=load('src/config/stageData.ts');
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {SquadRoster}=load('src/systems/SquadRoster.ts');
const {seededRandom}=load('src/systems/EconomySimulation.ts');
const {isRunCheckpoint}=load('src/systems/RunSaveManager.ts');
function fixture(initial,index,clearedBoss=false){
 const stage=getStageDefinition(index),grid=new RoomGridManager(stage,undefined,seededRandom(index)),start=grid.getCurrentRoom();
 const boss=grid.grid.flat().find(r=>r?.type==='BOSS'),queue=[start],prev=new Map([[start.id,null]]);
 for(const r of queue)for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){const next=grid.grid[r.gridY+dy]?.[r.gridX+dx];
  if(next&&!prev.has(next.id)){prev.set(next.id,r);queue.push(next);}}
 const target=clearedBoss?boss:prev.get(boss.id);let count=0;
 for(let r=target;r;r=prev.get(r.id)){r.visited=r.cleared=true;if(r.type==='EVENT')r.circleChoice='SKIP';count++;}
 const roster=new SquadRoster(1000);Object.assign(roster.upgrades,{squadAttack:2,squadHealth:3,heroAttack:1,heroHealth:2});
 roster.relicRewards=['COMMAND_BANNER','SEED_CHALICE','ARTISAN_SEAL'].map((relicId,i)=>({sourceRoomId:`stage_${i}_room_0_0`,relicId}));
 const data={...structuredClone(initial),runId:`endless_fixture_${index}`,phase:clearedBoss?'stage-cleared':'room-cleared',
  currentRoomId:target.id,mode:index>=5?'endless':'campaign',endlessChoice:clearedBoss?'pending':'none',
  stats:{...initial.stats,stageIndex:index,bossesDefeated:index+Number(clearedBoss),roomsCleared:index+count,
   enemiesDefeated:index+10,bossDefeated:index>=5||clearedBoss,mineralsCollected:1000,damageMultiplier:1.7},
  roster:roster.snapshot(),grid:grid.grid,leaderHealth:{currentHp:23,maxHp:120},relicHealRemainingMs:3100,
  unitHealth:roster.units.map(u=>({id:u.id,currentHp:30,reviveRemainingMs:0,healRemainingMs:1500,skillRemainingMs:0}))};
 assert.equal(isRunCheckpoint(data),true);return data;
}
const browser=await browserSession(),{evaluate,waitFor,tap,send,attach}=browser;
const output='artifacts/endless';
const save=()=>evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const click=async(scene,name)=>{const p=await evaluate(`(()=>{const c=smash.scene.getScene(${JSON.stringify(scene)}).children.getByName(${JSON.stringify(name)});return{x:c.x,y:c.y};})()`);await tap(p.x,p.y);};
const refreshRefs=()=>evaluate("window.gs=smash.scene.getScene('GameScene');undefined;");
const reload=async(expected,data)=>{
 if(data)await evaluate(`localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(JSON.stringify(data))});undefined;`);
 await send('Page.reload',{ignoreCache:true});await attach();await tap(360, 910);await waitFor(expected);await refreshRefs();
};
try{
 await tap(360,910);await waitFor("smash.scene.isActive('GameScene')");const initial=await save();
 await refreshRefs();await reload("smash.scene.isActive('SquadScene')",fixture(initial,4));
 await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
 const bossResult=await evaluate(`(()=>{gs.scene.pause();gs.clearEncounter();gs.doorCooldownMs=0;
  const current=gs.gridManager.getCurrentRoom(),bossRoom=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');
  const direction=bossRoom.gridX>current.gridX?'right':bossRoom.gridX<current.gridX?'left':bossRoom.gridY>current.gridY?'bottom':'top';
  const zone=gs.doors[direction].triggerZone;gs.squad.setPositionImmediate(zone.centerX,zone.centerY);gs.checkDoorTransition();
  const room=gs.gridManager.getCurrentRoom();gs.startRoomLogic(room);gs.spawnNextWave(room);gs.processSpawns(10000);
  const boss=gs.enemies.getChildren().find(e=>e.active&&e.spec.archetype==='BOSS_CORE');
  const hp=boss.health.maxHp;gs.squad.health.currentHp=23;gs.squad.drones[0].health.currentHp=20;
  gs.squad.drones[1].health.takeDamage(100000,gs.time.now);gs.squad.drones[1].reviveAt=gs.time.now+9000;
  boss.receiveDamage(hp,gs.time.now);gs.handleEnemyKilled(boss,gs.squad.drones[0].id);
  const money=gs.squad.roster.minerals;gs.handleEnemyKilled(boss);gs.finishRoom(room);
  return{stage:gs.stats.stageIndex,bosses:gs.stats.bossesDefeated,once:money===gs.squad.roster.minerals,hp,
   clean:gs.enemies.countActive(true)===0&&gs.bullets.countActive(true)===0&&gs.pendingSpawns.length===0};})()`);
 assert.equal(bossResult.once,true);assert.equal(bossResult.clean,true);assert.equal(bossResult.bosses,5);
 await waitFor("smash.scene.isActive('EndlessChoiceScene') && smash.scene.isPaused('GameScene')");
 assert.equal(await evaluate("smash.scene.isActive('GameOverScene')"),false);
 const pending=await save();assert.equal(pending.endlessChoice,'pending');assert.equal(pending.stats.bossDefeated,true);
 assert.equal(pending.roster.freeSummons,0);assert.equal(pending.leaderHealth.currentHp,23);
 await mkdir(output,{recursive:true});
 for(const width of[720,360]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width*1280/720,deviceScaleFactor:1,mobile:true});await sleep(200);
  const layout=await evaluate(`['endless-continue','endless-exit','endless-title'].map(name=>{
   const r=smash.scene.getScene('EndlessChoiceScene').children.getByName(name).getBounds();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom};})`);
  assert.ok(layout.every(r=>r.x>=28&&r.right<=692&&r.y>=600&&r.bottom<=990));
  const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/choice-${width}.png`,Buffer.from(png.data,'base64'));
 }
 await evaluate("window.realSave=gs.saveCheckpoint.bind(gs);gs.saveCheckpoint=()=>false;undefined;");
 await click('EndlessChoiceScene','endless-continue');assert.equal(await evaluate('gs.progression.endlessChoice'),'pending');
 assert.deepEqual(await save(),pending);assert.equal(await evaluate('gs.squad.roster.freeSummons'),0);
 assert.equal(await evaluate("smash.scene.getScene('EndlessChoiceScene').children.getByName('endless-choice-warning').text.includes('저장에 실패')"),true);
 await evaluate('gs.saveCheckpoint=realSave;undefined;');
  const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const point=(x,y)=>({x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(180,450),point(520,470)]});
  await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.deepEqual(await save(),pending);assert.equal(await evaluate('gs.joystick.dirX===0 && gs.joystick.dirY===0'),true);
 await click('EndlessChoiceScene','endless-title');await waitFor("smash.scene.isActive('MenuScene')");
 await tap(360, 910);await waitFor("smash.scene.isActive('EndlessChoiceScene')");await refreshRefs();
 assert.deepEqual((await save()).roster,pending.roster);assert.equal(await evaluate('gs.squad.health.currentHp'),23);
 await evaluate("window.oldChoice=smash.scene.getScene('EndlessChoiceScene').children.getByName('endless-continue').list.find(c=>c.input?.enabled);undefined;");
 await click('EndlessChoiceScene','endless-continue');await waitFor("smash.scene.isActive('SquadScene') && !smash.scene.isActive('EndlessChoiceScene')");
 const committed=await save();assert.equal(committed.endlessChoice,'continue');assert.equal(committed.roster.freeSummons,0);
 await evaluate("oldChoice.emit('pointerdown',{},0,0,{stopPropagation(){}});undefined;");assert.equal(await evaluate('gs.stats.stageIndex'),4);
 await reload("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
 assert.equal(await evaluate("smash.scene.isActive('EndlessChoiceScene')"),false);
 assert.equal(await evaluate('gs.progression.endlessChoice'),'continue');assert.deepEqual((await save()).roster,committed.roster);
  // Interruption after entering S6 but before its checkpoint succeeds must replay from the confirmed choice, not stack benefits.
  await evaluate('gs.saveCheckpoint=()=>false;undefined;');await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
  assert.equal(await evaluate('gs.stats.stageIndex'),5);assert.equal(await evaluate('gs.squad.roster.freeSummons'),1);
  assert.equal((await save()).stats.stageIndex,4);assert.equal((await save()).endlessChoice,'continue');
  await reload("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  assert.equal(await evaluate('gs.squad.roster.freeSummons'),0);assert.equal(await evaluate('gs.squad.health.currentHp'),23);
 await evaluate("smash.events.emit('hidden');undefined;");await tap(360, 1210);await waitFor("!smash.scene.isActive('SquadScene')");
 assert.equal(await evaluate("smash.scene.isPaused('GameScene')"),true);
 const sixth=await save();assert.equal(sixth.stats.stageIndex,5);assert.equal(sixth.mode,'endless');assert.equal(sixth.endlessChoice,'none');
 assert.equal(sixth.roster.freeSummons,1);assert.equal(sixth.leaderHealth.currentHp,Math.min(committed.leaderHealth.maxHp,23+Math.round(committed.leaderHealth.maxHp*0.4)));
 assert.deepEqual(sixth.roster.upgrades,pending.roster.upgrades);assert.deepEqual(sixth.roster.relicRewards,pending.roster.relicRewards);
 assert.deepEqual(sixth.unitHealth.map(d=>d.currentHp),[46,46]);assert.equal(sixth.relicHealRemainingMs,3100);
 await reload("smash.scene.isActive('GameScene')",sixth);await evaluate('gs.scene.pause();undefined;');
 assert.equal(await evaluate('gs.squad.health.currentHp'),sixth.leaderHealth.currentHp);assert.equal(await evaluate('gs.squad.roster.freeSummons'),1);
 assert.deepEqual(await save(),sixth);assert.equal(await evaluate("gs.hudStageIndex.text.includes('STAGE 6 ∞')"),true);
 const combat=await evaluate(`(()=>{gs.clearEncounter();gs.startRoomLogic(gs.gridManager.getCurrentRoom());
  gs.spawnNextWave(gs.gridManager.getCurrentRoom());gs.processSpawns(10000);
  const spawned=gs.enemies.getChildren().filter(e=>e.active);const health=spawned.map(e=>e.health.maxHp);
  for(const [i,e]of spawned.entries()){e.setPosition(430+(i%3)*35,500+Math.floor(i/3)*35);e.body.moves=false;e.body.immovable=true;}
  gs.squad.setPositionImmediate(360,650);gs.startCombatMeasurement();gs.physics.world.resume();gs.physics.world.fixedStep=false;
  for(let frame=1;frame<=90;frame++){const delta=1000/60,time=gs.time.now+frame*delta;
   gs.combatMeasurements.advance(delta,true);gs.squad.update(time,delta,0,0,gs.enemies,gs.stats.damageMultiplier,gs.stats.attackSpeedMultiplier,0,true);
   for(const b of gs.bullets.getChildren())if(b.active)b.update(time,delta);gs.physics.world.update(time,delta);gs.physics.world.postUpdate();}
  gs.physics.world.pause();const report=gs.getCombatReport();return{spawned:health.length,health,fired:report.projectiles.fired,
   contacts:report.projectiles.contacts,enemyDamage:report.enemies.effective,bullets:gs.bullets.getChildren().length};})()`);
 assert.ok(combat.spawned>0&&combat.health.every(h=>Number.isFinite(h)&&h>0));assert.ok(combat.fired>0&&combat.contacts>0&&combat.enemyDamage>0);assert.ok(combat.bullets<=160);
 // An actual endless boss clear on its generated map still asks once, preserving the story achievement.
 await reload("smash.scene.isActive('SquadScene')",fixture(initial,5));await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`(()=>{gs.scene.pause();gs.clearEncounter();const bossRoom=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS'),current=gs.gridManager.getCurrentRoom();
  const dir=bossRoom.gridX>current.gridX?'right':bossRoom.gridX<current.gridX?'left':bossRoom.gridY>current.gridY?'bottom':'top';
  gs.gridManager.moveTo(dir);gs.enterRoom(bossRoom,dir);gs.startRoomLogic(bossRoom);gs.spawnNextWave(bossRoom);gs.processSpawns(10000);
  const boss=gs.enemies.getChildren().find(e=>e.active&&e.spec.archetype==='BOSS_CORE');boss.receiveDamage(boss.health.maxHp,gs.time.now);
  gs.handleEnemyKilled(boss);gs.handleEnemyKilled(boss);})()`);
 await waitFor("smash.scene.isActive('EndlessChoiceScene')");assert.equal((await save()).stats.bossesDefeated,6);
 await click('EndlessChoiceScene','endless-exit');await waitFor("smash.scene.isActive('GameOverScene')");
 assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"),null);
 assert.ok(await evaluate("JSON.parse(localStorage.getItem('smash.endless-record.v1')).highestStage")>=6);
 await reload("smash.scene.isActive('EndlessChoiceScene')",fixture(initial,999,true));
 assert.equal(await evaluate("smash.scene.getScene('EndlessChoiceScene').children.getByName('endless-continue').list.some(c=>c.input?.enabled)"),false);
 await click('EndlessChoiceScene','endless-continue');assert.equal(await evaluate('gs.stats.stageIndex'),999);assert.equal((await save()).endlessChoice,'pending');
  const pool=await evaluate(`(()=>{gs.clearEncounter();for(let i=0;i<65;i++)gs.queueEnemy('SWARMER',150+(i%8)*50,300+Math.floor(i/8)*50);
   for(let i=0;i<65;i++)gs.processSpawns(1000);const active=gs.enemies.getChildren().filter(e=>e.active);
   const result={active:active.length,pending:gs.pendingSpawns.length,allocated:gs.enemies.getChildren().length,
    finite:active.every(e=>Number.isFinite(e.health.maxHp)&&Number.isFinite(e.spec.contactDamage)&&Number.isFinite(e.spec.speed))};
   gs.clearEncounter();return result;})()`);
  assert.equal(pool.active,64);assert.equal(pool.pending,1);assert.ok(pool.allocated<=80);assert.equal(pool.finite,true);
 await click('EndlessChoiceScene','endless-exit');await waitFor("smash.scene.isActive('GameOverScene')");
 assert.equal(await evaluate("JSON.parse(localStorage.getItem('smash.endless-record.v1')).highestStage"),1000);
  const exiting=structuredClone(pending);exiting.endlessChoice='exit';
  await reload("smash.scene.isActive('GameOverScene')",exiting);
  assert.equal(await evaluate("smash.scene.isActive('EndlessChoiceScene')"),false);
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"),null);
 assert.equal(await evaluate('gs.stats.bossDefeated'),true);await click('GameOverScene','result-retry');await waitFor("smash.scene.isActive('GameScene')");await refreshRefs();
 assert.equal(await evaluate('gs.stats.stageIndex'),0);assert.equal(await evaluate('gs.stats.bossDefeated'),false);
 assert.equal(await evaluate('gs.squad.roster.minerals'),30);assert.deepEqual(await evaluate('gs.squad.roster.relicRewards'),[]);
 await evaluate('gs.returnToTitle();undefined;');await waitFor("smash.scene.isActive('MenuScene')");
 assert.equal(await evaluate("smash.scene.getScene('MenuScene').children.getByName('endless-record').text.includes('1000')"),true);
 assert.deepEqual(browser.errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({browser:await send('Browser.getVersion'),
  scenario:'controlled upgraded S5/S6 boss fixtures on real connected grids; real UI/save/physics; not human balance measurement',bossResult,
  pendingChoice:pending.endlessChoice,committedChoice:committed.endlessChoice,sixth:{hp:sixth.leaderHealth,freeSummons:sixth.roster.freeSummons,mode:sixth.mode},
  combat,pool,saveFailure:true,defer:true,duplicate:true,reload:true,safeLimit:1000,recordPreserved:true,scalingSamples:[4,5,9,99,999].map(index=>({stage:index+1,...getStageScaling(index)})),errors:browser.errors},null,2));
 console.log(JSON.stringify({ok:true,choice:true,saveFailure:true,reload:true,stage6:true,combat,safeLimit:1000,record:true,widths:[720,360],report:`${output}/report.json`}));
}finally{browser.close();}
