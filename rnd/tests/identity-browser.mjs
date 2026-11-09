import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
import {load} from '../scripts/lib/load-typescript.mjs';
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {getStageDefinition}=load('src/config/stageData.ts');
const {seededRandom}=load('src/systems/EconomySimulation.ts');
const {BOSS_IDS,BOSS_PROFILES}=load('src/config/bossData.ts');
const {isRunCheckpoint}=load('src/systems/RunSaveManager.ts');
const b=await browserSession(),{evaluate,tap,send,attach,waitFor}=b,output='artifacts/identity',report={bosses:[]};
const save=()=>evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const discoveries=()=>evaluate("JSON.parse(localStorage.getItem('smash.discovery-codex.v1'))");
const ref=()=>evaluate("window.gs=smash.scene.getScene('GameScene');undefined;");
const click=async(scene,name)=>{const p=await evaluate(`(()=>{const o=smash.scene.getScene('${scene}').children.getByName('${name}');return{x:o.x,y:o.y};})()`);await tap(p.x,p.y);};
const shots=async label=>{await mkdir(output,{recursive:true});for(const width of[720,360]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width*1280/720,deviceScaleFactor:1,mobile:true});await sleep(180);
 const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/${label}-${width}.png`,Buffer.from(png.data,'base64'));}};
function fixture(initial,index){
 const grid=new RoomGridManager(getStageDefinition(index),undefined,seededRandom(index+42)),start=grid.getCurrentRoom(),boss=grid.grid.flat().find(r=>r?.type==='BOSS');
 const queue=[start],prev=new Map([[start.id,null]]);for(const r of queue)for(const[dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){
  const next=grid.grid[r.gridY+dy]?.[r.gridX+dx];if(next&&!prev.has(next.id)){prev.set(next.id,r);queue.push(next);}}
 const parent=prev.get(boss.id);let count=0;for(let r=parent;r;r=prev.get(r.id)){r.visited=r.cleared=true;if(r.type==='EVENT')r.circleChoice='SKIP';count++;}
 const d=structuredClone(initial);Object.assign(d,{runId:`identity_boss_${index}`,phase:'room-cleared',currentRoomId:parent.id,grid:grid.grid});
 Object.assign(d.stats,{stageIndex:index,bossesDefeated:index,roomsCleared:index+count});assert.equal(isRunCheckpoint(d),true);return d;
}
try{
 await tap(360,910);await waitFor("smash.scene.isActive('GameScene')");await ref();const initial=await save();
 assert.deepEqual((await discoveries()).units,['BASIC_LASER']);
 await evaluate('gs.scene.pause();gs.clearEncounter();gs.squad.health.currentHp=23;gs.finishRoom(gs.gridManager.getCurrentRoom());undefined;');
 await waitFor("smash.scene.isActive('SquadScene')");await click('SquadScene','summon-GATLING_BOT');
 assert.deepEqual((await discoveries()).units,['BASIC_LASER','GATLING_BOT']);
 await click('SquadScene','facility-open');await click('SquadScene','facility-synergy');await shots('synergy');
 assert.equal(await evaluate("smash.scene.getScene('SquadScene').children.getByName('synergy-FOREST_BOND').text.includes('발동')"),true);
 const effects=await evaluate('({attack:gs.squad.upgradeEffects.squadAttack,speed:gs.squad.upgradeEffects.squadSpeed,hp:gs.squad.health.currentHp})');
 assert.equal(effects.attack,1.05);assert.equal(effects.speed,1.05);assert.equal(effects.hp,23);
 const before=await save();await click('SquadScene','codex-open');await waitFor("smash.scene.isActive('CodexScene')");await shots('codex-units');
 for(let page=0;page<6;page++){
  const overflow=await evaluate(`smash.scene.getScene('CodexScene').children.list.filter(o=>o.name?.startsWith('codex-acquisition-')).map(o=>{
   const index=Number(o.name.split('-').at(-1)),r=o.getBounds();return{bottom:r.bottom,limit:450+index*192,right:r.right};})`);
  assert.ok(overflow.every(r=>r.bottom<=r.limit&&r.right<=684),JSON.stringify({page,overflow}));
  if(page<5)await click('CodexScene','codex-next');
 }
 await click('CodexScene','codex-bosses');await shots('codex-bosses');
 const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()"),point=(x,y)=>({x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(80,1040),point(640,1040)]});await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await evaluate("gs.game.events.emit('hidden');gs.game.events.emit('visible');undefined;");await sleep(200);
 assert.equal(await evaluate('gs.scene.isPaused()'),true);assert.deepEqual(await save(),before);
 await click('CodexScene','codex-close');assert.equal(await evaluate('gs.scene.isPaused()'),true);
 await tap(360,228);await click('SquadScene','combine-gatling');assert.equal(await evaluate('gs.squad.roster.units.length'),2);
 assert.equal(await evaluate('gs.squad.upgradeEffects.squadAttack'),1);assert.equal(await evaluate('gs.squad.upgradeEffects.squadSpeed'),1);
 assert.deepEqual((await discoveries()).units,['BASIC_LASER','GATLING_BOT']);
 await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");await evaluate('gs.returnToTitle();undefined;');await waitFor("smash.scene.isActive('MenuScene')");
 await click('MenuScene','codex-open');await waitFor("smash.scene.isActive('CodexScene')");await click('CodexScene','codex-close');
 await send('Page.reload',{ignoreCache:true});await attach();await click('MenuScene','codex-open');
 assert.equal(await evaluate("smash.scene.getScene('CodexScene').children.getByName('codex-count').text.includes('2/22')"),true);await click('CodexScene','codex-close');
 await evaluate("smash.scene.getScene('MenuScene').scene.start('GameScene');undefined;");await waitFor("smash.scene.isActive('GameScene')");await ref();
 assert.equal(await evaluate('gs.squad.roster.units.length'),2);assert.deepEqual((await discoveries()).units,['BASIC_LASER','GATLING_BOT']);
 for(let index=0;index<5;index++){
  const data=fixture(initial,index);await evaluate(`localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(JSON.stringify(data))});gs.scene.restart({resume:true});undefined;`);
  await waitFor(`smash.scene.getScene('GameScene').runId==='identity_boss_${index}' && smash.scene.isActive('SquadScene')`);await ref();
  await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
  const pattern=await evaluate(`(()=>{gs.scene.pause();gs.clearEncounter();const current=gs.gridManager.getCurrentRoom(),room=gs.gridManager.grid.flat().find(r=>r?.type==='BOSS');
   const dir=room.gridX>current.gridX?'right':room.gridX<current.gridX?'left':room.gridY>current.gridY?'bottom':'top';
   gs.doorCooldownMs=0;const zone=gs.doors[dir].triggerZone;gs.squad.setPositionImmediate(zone.centerX,zone.centerY);gs.checkDoorTransition();
   gs.squad.setPositionImmediate(360,630);gs.startRoomLogic(room);gs.spawnNextWave(room);gs.processSpawns(10000);
   window.boss=gs.enemies.getChildren().find(e=>e.active&&e.spec.archetype==='BOSS_CORE');gs.bossPatternLeft=0;gs.updateBossPatterns(0);
   window.resolved=0;window.realResolve=gs.resolveHazard.bind(gs);gs.resolveHazard=(...args)=>{resolved++;realResolve(...args);};
   gs.squad.health.invulnerableUntil=0;gs.hazards.update(0);return{id:boss.bossId,tint:boss.tintTopLeft,attacks:gs.hazards.slots.filter(s=>s.active).map(s=>({kind:s.kind,x:s.x,y:s.y,warning:s.warningMs,fromX:s.fromX})),left:gs.bossPatternLeft};})()`);
  const profile=BOSS_PROFILES[BOSS_IDS[index]];assert.equal(pattern.id,BOSS_IDS[index]);assert.equal(pattern.tint,profile.color);
  assert.equal(pattern.attacks.length,[1,2,3,4,4][index]);assert.equal(pattern.left,profile.intervalMs);
  await shots(`boss-${index+1}`);
  await evaluate(`gs.hazards.update(${profile.warningMs-1});undefined;`);assert.equal(await evaluate('resolved'),0);
  const state=await evaluate('({left:gs.bossPatternLeft,ages:gs.hazards.slots.filter(s=>s.active).map(s=>s.age)})');
  await evaluate("gs.game.events.emit('hidden');undefined;");await sleep(200);assert.deepEqual(await evaluate('({left:gs.bossPatternLeft,ages:gs.hazards.slots.filter(s=>s.active).map(s=>s.age)})'),state);
  await evaluate("gs.game.events.emit('visible');gs.scene.pause();gs.hazards.update(1);undefined;");assert.equal(await evaluate('resolved'),pattern.attacks.length);
  const damage=await evaluate('boss.spec.contactDamage');
  if(index===2){
   assert.equal(await evaluate('gs.squad.health.currentHp'),100-damage,'lava meteor must deal its real scaled damage after the warning');
   await evaluate(`gs.hazards.clear();gs.squad.health.currentHp=100;gs.squad.health.invulnerableUntil=0;
     gs.bossPatternLeft=0;gs.updateBossPatterns(0);gs.squad.setPositionImmediate(360,900);gs.hazards.update(1100);undefined;`);
   assert.equal(await evaluate('gs.squad.health.currentHp'),100,'leaving the locked row must avoid the next lava attack');
  }
  if(index===1||index===3){
   await evaluate(`gs.squad.health.currentHp=100;gs.squad.health.invulnerableUntil=0;
     gs.squad.setPositionImmediate(${pattern.attacks[0].x},${pattern.attacks[0].y});gs.hazards.update(1);undefined;`);
   assert.equal(await evaluate('gs.squad.health.currentHp'),100-damage,'entering the persistent field must apply real damage');
   if(index===3)assert.equal(await evaluate('gs.squad.movement.slowFactor'),0.65);
  }
  if(index===4)assert.equal(await evaluate('gs.squad.health.currentHp'),100,'the cross center must remain safe');
  const killed=await evaluate(`(()=>{const hp=boss.health.maxHp;boss.receiveDamage(hp,gs.time.now);gs.handleEnemyKilled(boss,gs.squad.drones[0].id);
   const money=gs.squad.roster.minerals;gs.handleEnemyKilled(boss);return{clean:gs.hazards.slots.every(s=>!s.active)&&gs.enemies.countActive(true)===0&&gs.pendingSpawns.length===0,once:money===gs.squad.roster.minerals};})()`);
  assert.equal(killed.clean,true);assert.equal(killed.once,true);assert.ok((await discoveries()).bosses.includes(BOSS_IDS[index]));
  report.bosses.push({id:pattern.id,warning:profile.warningMs,attacks:pattern.attacks.length,tint:pattern.tint,pause:true,cleanup:true,
   ...(index===1||index===2||index===3?{effectiveDamage:damage}:{}),...(index===2?{dodge:true}:{}),...(index===4?{safeCenter:true}:{})});
  await evaluate('gs.resolveHazard=realResolve;undefined;');
 }
 assert.equal((await discoveries()).bosses.length,5);
 const good=await discoveries(),run=await save();await evaluate("localStorage.setItem('smash.discovery-codex.v1','{bad');undefined;");
 await send('Page.reload',{ignoreCache:true});await attach();await click('MenuScene','codex-open');
 assert.equal(await evaluate("smash.scene.getScene('CodexScene').children.getByName('codex-status').text.includes('읽지 못')"),true);
 assert.equal(await evaluate("localStorage.getItem('smash.discovery-codex.v1')"),'{bad');assert.deepEqual(await save(),run);
 report.synergy={attack:effects.attack,speed:effects.speed,removedOnCompositionChange:true};report.codex={units:good.units,bosses:good.bosses.length,persistent:true,invalidPreserved:true};
 assert.deepEqual(b.errors,[]);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',...report}));
}finally{b.close();}
