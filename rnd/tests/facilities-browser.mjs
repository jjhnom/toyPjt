import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
import {load} from '../scripts/lib/load-typescript.mjs';
const {RoomGridManager}=load('src/systems/RoomGridManager.ts');
const {getStageDefinition}=load('src/config/stageData.ts');
const {seededRandom}=load('src/systems/EconomySimulation.ts');
const {isRunCheckpoint}=load('src/systems/RunSaveManager.ts');
const {upgradedUnitMaxHp}=load('src/systems/UpgradeEffects.ts');
const browser=await browserSession(),{evaluate,tap,send,attach,waitFor}=browser,output='artifacts/facilities',report={};
const save=()=>evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const ref=()=>evaluate("window.gs=smash.scene.getScene('GameScene');undefined;");
const click=async name=>{const p=await evaluate(`(()=>{const c=smash.scene.getScene('SquadScene').children.getByName('${name}');return{x:c.x,y:c.y};})()`);await tap(p.x,p.y);};
const keepButton=name=>evaluate(`window.oldButton=smash.scene.getScene('SquadScene').children.getByName('${name}').list.find(c=>c.input);undefined;`);
const replayButton=()=>evaluate("oldButton.emit('pointerdown',{},{},{},{stopPropagation(){}});undefined;");
const reload=async data=>{
 if(data)await evaluate(`localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(JSON.stringify(data))});undefined;`);
 await send('Page.reload',{ignoreCache:true});
 try { await attach(); } catch(error) {
  console.error('reload diagnostics',await evaluate(`({url:location.href,html:document.documentElement.outerHTML.slice(-700),
    resources:performance.getEntriesByType('resource').slice(-12).map(r=>({name:r.name,duration:r.duration,size:r.transferSize})),
    scripts:[...document.scripts].map(s=>s.src),hasGame:!!window.smash})`));throw error;
 }
 await tap(360, 910);await waitFor("smash.scene.isActive('SquadScene')");await ref();
};
const screenshots=async label=>{
 await mkdir(output,{recursive:true});
 for(const width of[720,360]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width*1280/720,deviceScaleFactor:1,mobile:true});await sleep(200);
  const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/${label}-${width}.png`,Buffer.from(png.data,'base64'));
 }
};
function fixture(initial,bossTarget=false){
 const grid=new RoomGridManager(getStageDefinition(2),undefined,seededRandom(1)),start=grid.getCurrentRoom(),supply=grid.grid.flat().find(r=>r?.sideSupply);
 const target=bossTarget?grid.grid.flat().find(r=>r?.type==='BOSS'):supply,queue=[start],previous=new Map([[start.id,null]]);
 for(const room of queue)for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){
  const next=grid.grid[room.gridY+dy]?.[room.gridX+dx];if(next&&!previous.has(next.id)){previous.set(next.id,room);queue.push(next);}}
 let count=0;for(let room=target;room;room=previous.get(room.id)){room.cleared=room.visited=true;if(room.type==='EVENT')room.circleChoice='SKIP';count++;}
 if(bossTarget){ // Include the connected supply branch to test explicit abandonment at stage exit.
  for(let room=supply;room;room=previous.get(room.id))if(!room.cleared){room.cleared=room.visited=true;if(room.type==='EVENT')room.circleChoice='SKIP';count++;}
 }
 const data=structuredClone(initial);Object.assign(data,{phase:bossTarget?'stage-cleared':'room-cleared',currentRoomId:target.id,grid:grid.grid});
 Object.assign(data.stats,{stageIndex:2,bossesDefeated:2+Number(bossTarget),roomsCleared:2+count,mineralsCollected:10000});
 data.roster.minerals=10000;data.roster.units[0].star=3;data.roster.units[1].archetype='PHOENIX_LORD';data.roster.units[1].tier=4;
 data.leaderHealth.currentHp=23;data.hero.activeRemainingMs=8000;
 data.unitHealth[0].currentHp=13;Object.assign(data.unitHealth[1],{currentHp:0,reviveRemainingMs:9000,skillRemainingMs:1234});
 assert.equal(isRunCheckpoint(data),true);return data;
}
try{
 await tap(360,910);await waitFor("smash.scene.isActive('GameScene')");const initial=await save(),data=fixture(initial);
 await reload(data);assert.equal(await evaluate("smash.scene.getScene('SquadScene').facilityMode"),'supply');
 await screenshots('supply');
 await click('facility-open');await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
 await reload();assert.equal(await evaluate("smash.scene.getScene('SquadScene').facilityMode"),'supply');
 const pending=await save();
 await evaluate('window.realSave=gs.saveCheckpoint.bind(gs);gs.saveCheckpoint=()=>false;undefined;');
 await keepButton('supply-VOUCHERS');await click('supply-VOUCHERS');
 assert.equal(await evaluate('gs.squad.roster.freeSummons'),2);assert.deepEqual(await save(),pending);
 await replayButton();assert.equal(await evaluate('gs.squad.roster.freeSummons'),2);
 await reload();assert.equal(await evaluate('gs.squad.roster.freeSummons'),0);
 await click('supply-VOUCHERS');const claimed=await save();assert.equal(claimed.roster.freeSummons,2);
 assert.equal(claimed.grid.flat().find(r=>r?.sideSupply).supplyChoice,'VOUCHERS');
 await reload();assert.equal(await evaluate('gs.squad.roster.freeSummons'),2);
 await click('facility-open');
 await keepButton('awaken-unit_1');await click('awaken-unit_1');const awakened=await save();
 assert.equal(awakened.roster.units[0].awakening,1);assert.equal(awakened.roster.minerals,9920);
 assert.equal(awakened.unitHealth[0].currentHp,13);
 assert.equal(await evaluate('gs.squad.drones[0].health.maxHp'),upgradedUnitMaxHp('BASIC_LASER',3,1,1));
 await replayButton();assert.deepEqual(await save(),awakened);
 await screenshots('awakening');
 await click('facility-service');await screenshots('services');
  const pausedBefore=await save();
  assert.equal(await evaluate(`(()=>{const quote=gs.squad.serviceQuote('HEAL');gs.game.events.emit('hidden');
    const bought=smash.scene.getScene('SquadScene').dataSource.onService(quote);gs.game.events.emit('visible');return bought;})()`),false);
  assert.deepEqual(await save(),pausedBefore);assert.equal(await evaluate('gs.scene.isPaused()'),true);
 await keepButton('service-HEAL');await click('service-REVIVE');const revived=await save();
 assert.equal(revived.roster.minerals,9890);assert.equal(revived.unitHealth[1].reviveRemainingMs,0);
 assert.equal(revived.unitHealth[1].currentHp,Math.round(upgradedUnitMaxHp('PHOENIX_LORD',1,1)*0.5));
 assert.equal(revived.unitHealth[1].skillRemainingMs,1234);assert.equal(revived.hero.activeRemainingMs,8000);
 await replayButton();assert.deepEqual(await save(),revived,'stale heal quote cannot buy against changed targets');
 await click('service-HEAL');const healed=await save();assert.equal(healed.roster.minerals,9850);assert.equal(healed.leaderHealth.currentHp,100);
 assert.equal(healed.unitHealth[0].currentHp,upgradedUnitMaxHp('BASIC_LASER',3,1,1));
 await reload();assert.equal(await evaluate('gs.squad.roster.units[0].awakening'),1);assert.equal(await evaluate('gs.squad.drones[1].reviveAt'),0);
 assert.equal(await evaluate('gs.squad.activeRemaining()'),8000);
 // Destructive confirmation: cancel and stale confirmation preserve the exact awakened instance.
 await tap(575,228);await click('roster-sell-unit_1');await waitFor("smash.scene.getScene('SquadScene').confirmation!==null");
  await screenshots('loss');
  const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const point=(x,y)=>({x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(80,1000),point(640,1000)]});
  await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await tap(570,123);assert.equal(await evaluate("smash.scene.getScene('SquadScene').confirmation!==null"),true);
  await evaluate("gs.game.events.emit('hidden');gs.game.events.emit('visible');undefined;");
  assert.equal(await evaluate('gs.scene.isPaused()'),true);assert.equal((await save()).roster.minerals,9850);
  await keepButton('loss-confirm');await click('loss-cancel');await replayButton();
 assert.equal(await evaluate('gs.squad.roster.units.length'),2);assert.equal((await save()).roster.minerals,9850);
 await click('roster-sell-unit_1');await click('loss-confirm');assert.equal(await evaluate('gs.squad.roster.units.length'),1);
 assert.equal((await save()).roster.minerals,9880);assert.equal(await evaluate("gs.squad.drones.some(d=>d.id==='unit_1')"),false);
 // Restore the committed fixture and test combination loss confirmation independently of selling.
 await reload(healed);await tap(360,228);
 // 'cryo' consumes BASIC_LASER + GATLING_BOT; use the existing gatling recipe with a second controlled basic unit.
 await evaluate(`gs.squad.roster.units[1].archetype='BASIC_LASER';gs.squad.roster.units[1].tier=1;
   gs.squad.drones.forEach(d=>d.destroy());gs.squad.drones=[];gs.squad.syncRoster();undefined;`);
 await evaluate(`smash.scene.getScene('SquadScene').requestCombine('gatling');undefined;`);
 await waitFor("smash.scene.getScene('SquadScene').confirmation!==null");await click('loss-cancel');
 assert.equal(await evaluate('gs.squad.roster.units[0].awakening'),1);
 await evaluate("smash.scene.getScene('SquadScene').requestCombine('gatling');undefined;");await click('loss-confirm');
 const combined=await save();assert.equal(combined.roster.units.length,1);assert.equal(combined.roster.units[0].archetype,'GATLING_BOT');
 assert.equal(combined.roster.units[0].awakening,undefined);assert.ok(!['unit_1','unit_2'].includes(combined.roster.units[0].id));
  // Enter a generated supply room through its actual door, then run the normal first-clear flow.
  const entering=fixture(initial),cache=entering.grid.flat().find(r=>r?.sideSupply);
  const parent=[[0,-1],[0,1],[-1,0],[1,0]].map(([dx,dy])=>entering.grid[cache.gridY+dy]?.[cache.gridX+dx]).find(r=>r?.cleared);
  cache.cleared=cache.visited=false;entering.currentRoomId=parent.id;entering.stats.roomsCleared--;
  assert.equal(isRunCheckpoint(entering),true);await reload(entering);await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
  const clearFlow=await evaluate(`(()=>{gs.scene.pause();const current=gs.gridManager.getCurrentRoom(),room=gs.gridManager.grid.flat().find(r=>r?.sideSupply);
    gs.roomState='CLEARED';gs.doorCooldownMs=0;const direction=room.gridX>current.gridX?'right':room.gridX<current.gridX?'left':room.gridY>current.gridY?'bottom':'top';
    const zone=gs.doors[direction].triggerZone;gs.squad.setPositionImmediate(zone.centerX,zone.centerY);gs.checkDoorTransition();
    gs.startRoomLogic(gs.gridManager.getCurrentRoom());const before=gs.squad.roster.minerals;
    const blocked=smash.scene.getScene('SquadScene').dataSource.onService(gs.squad.serviceQuote('HEAL'));
    gs.finishRoom(gs.gridManager.getCurrentRoom());const earned=gs.squad.roster.minerals-before;
    gs.finishRoom(gs.gridManager.getCurrentRoom());return {id:gs.gridManager.getCurrentRoom().id,earned,blocked,once:gs.squad.roster.minerals-before===earned};})()`);
  await waitFor("smash.scene.isActive('SquadScene')");assert.equal(clearFlow.blocked,false);assert.equal(clearFlow.once,true);assert.equal(clearFlow.id,cache.id);
  const beforeMinerals=(await save()).roster.minerals;await click('supply-MINERALS');assert.equal((await save()).roster.minerals,beforeMinerals+25);
 // Pending supplies remain available at a later boss; stage advance requires explicit abandonment.
 await reload(fixture(initial,true));await tap(360, 1210);await waitFor("smash.scene.getScene('SquadScene').confirmation!==null");
 await click('loss-cancel');assert.equal(await evaluate('gs.progression.index'),2);
 await tap(360, 1210);await click('loss-confirm');await waitFor("smash.scene.isActive('GameScene')");
 assert.equal((await save()).stats.stageIndex,3);
 report.awakening={level:1,cost:80,hp:awakened.unitHealth[0].currentHp,maxHp:healed.unitHealth[0].currentHp,lossConfirmed:true};
 report.services={reviveCost:30,healCost:40,skillRemaining:revived.unitHealth[1].skillRemainingMs,activeRemaining:revived.hero.activeRemainingMs};
  report.supply={vouchers:2,minerals:25,deferred:true,duplicateBlocked:true,saveFailureReplay:true,abandonConfirmed:true,clearFlow};
 assert.deepEqual(browser.errors,[]);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',...report}));
}finally{browser.close();}
