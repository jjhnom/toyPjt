import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession, sleep } from './helpers/browser-session.mjs';
import { load } from '../scripts/lib/load-typescript.mjs';
const { RoomGridManager } = load('src/systems/RoomGridManager.ts');
const { getStageDefinition, getStageScaling } = load('src/config/stageData.ts');
const { isRunCheckpoint } = load('src/systems/RunSaveManager.ts');

const browser = await browserSession(), { evaluate, tap, send, waitFor, attach } = browser;
const output = 'artifacts/abilities', report = {};
const save = () => evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const ref = () => evaluate("window.gs=smash.scene.getScene('GameScene');undefined;");
const click = async (scene, name) => {
  const p = await evaluate(`(()=>{const c=smash.scene.getScene('${scene}').children.getByName('${name}');return{x:c.x,y:c.y};})()`);
  await tap(p.x, p.y);
};
const reload = async data => {
  if (data) await evaluate(`localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(JSON.stringify(data))});undefined;`);
  await send('Page.reload', { ignoreCache: true }); await attach(); await tap(360, 910);
  await waitFor("smash.scene.isActive('SquadScene')"); await ref();
};
let rect;
const point = (id, x, y) => ({ id, x: rect.x + x * rect.width / 720, y: rect.y + y * rect.height / 1280 });
const touch = (type, points = []) => send('Input.dispatchTouchEvent', { type, touchPoints: points });
const ready = async () => {
  // Pause the simulation so input checks use exact HP/cooldown values and no artificial combat kills.
  await evaluate(`gs.activeSkillButton.cancel();gs.squad.restoreHero({...gs.squad.heroSnapshot(),activeRemainingMs:0});
    gs.squad.health.currentHp=23;gs.squad.drones[0].health.currentHp=20;
    gs.activeSkillButton.update(true,0,gs.squad.activeDuration());undefined;`);
};
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')"); await ref();
  await evaluate(`gs.scene.pause();gs.clearEncounter();const room=gs.gridManager.getCurrentRoom();room.cleared=true;
    gs.roomState='CLEARED';gs.stats.roomsCleared=1;gs.squad.recordHeroKill('unit',87);gs.stats.enemiesDefeated=1;
    gs.squad.health.currentHp=23;gs.saveCheckpoint();gs.scene.resume();gs.openSquadModal();undefined;`);
  await waitFor("smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').children.getByName('talent-title-VITALITY')!==null"), true);
  const before = await save(); assert.equal(before.hero.level, 3);
  for (const width of [720,360]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width * 1280 / 720, deviceScaleFactor: 1, mobile: true }); await sleep(200);
    await mkdir(output,{recursive:true});
    const png = await send('Page.captureScreenshot',{format:'png'});
    await writeFile(`${output}/talent-${width}.png`,Buffer.from(png.data,'base64'));
  }
  await click('SquadScene','talent-open'); assert.deepEqual((await save()).hero.talents,[]);
  await tap(360, 1210); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate('gs.openSquadModal();undefined;'); await waitFor("smash.scene.isActive('SquadScene')");
  await evaluate(`window.oldTalent=smash.scene.getScene('SquadScene').children.getByName('talent-select-VITALITY').list.find(o=>o.input);undefined;`);
  await click('SquadScene','talent-select-VITALITY');
  const picked = await save(); assert.deepEqual(picked.hero.talents,['VITALITY']);
  assert.equal(picked.leaderHealth.currentHp,23); assert.equal(picked.leaderHealth.maxHp,before.leaderHealth.maxHp+10);
  await evaluate("oldTalent.emit('pointerdown',{},{},{},{stopPropagation(){}});undefined;");
  assert.deepEqual(await save(),picked);
  await reload(); assert.equal(await evaluate('gs.squad.health.currentHp'),23);
  assert.deepEqual(await evaluate('gs.squad.hero.talents'),['VITALITY']);
  await tap(360, 1210); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`gs.clearEncounter();gs.roomState='LOCKED_WAVES';gs.input.enabled=true;
    window.normalUpdate=gs.sys.sceneUpdate;gs.sys.sceneUpdate=()=>{};undefined;`);
  rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  await ready();
  const skillPng=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/skill-360.png`,Buffer.from(skillPng.data,'base64'));
  const skillBounds=await evaluate("gs.children.getByName('active-skill').getBounds()");
  assert.ok(skillBounds.x>=420&&skillBounds.y>=1180&&skillBounds.x+skillBounds.width<=548&&skillBounds.y+skillBounds.height<=1280,
    'active skill stays in its bottom control slot');
  await touch('touchStart',[point(1,520,1230)]); await sleep(80);
  assert.equal(await evaluate('gs.squad.activeRemaining()'),0,'press alone must not cast');
  assert.equal(await evaluate('gs.joystick.activePointerId'),null,'skill must not capture movement');
  await touch('touchEnd'); await sleep(120);
  assert.equal(await evaluate('gs.squad.health.currentHp'),33); assert.equal(await evaluate('gs.squad.activeRemaining()'),18000);
  await tap(520,1230); assert.equal(await evaluate('gs.squad.health.currentHp'),33,'cooldown blocks repeated input');
  for (const cancel of ['drag','touchcancel','pointercancel','blur','pause','hidden']) {
    await ready(); await touch('touchStart',[point(1,520,1230)]); await sleep(60);
    if(cancel==='drag') { await touch('touchMove',[point(1,500,1040)]); await sleep(100); }
    if(cancel==='touchcancel') await touch('touchCancel');
    if(cancel==='pointercancel') await evaluate("gs.game.canvas.dispatchEvent(new Event('pointercancel'));undefined;");
    if(cancel==='blur') await evaluate("gs.game.events.emit('blur');undefined;");
    if(cancel==='pause') await evaluate('gs.scene.pause();gs.scene.resume();undefined;');
    if(cancel==='hidden') await evaluate("gs.game.events.emit('hidden');gs.game.events.emit('visible');undefined;");
    if(cancel!=='touchcancel') await touch('touchEnd'); await sleep(100);
    assert.equal(await evaluate('gs.squad.activeRemaining()'),0,cancel);
    assert.equal(await evaluate('gs.squad.health.currentHp'),23,cancel);
  }
  await ready();
  await touch('touchStart',[point(1,130,1230)]);
  await touch('touchMove',[point(1,185,1230)]); await sleep(80);
  const moving=await evaluate('gs.joystick.activePointerId');assert.ok(moving!==null);
  await touch('touchStart',[point(1,185,1230),point(2,520,1230)]); await sleep(80);
  assert.ok(await evaluate('gs.activeSkillButton.pointerId!==null'), JSON.stringify(await evaluate(`({arm:gs.activeSkillButton.pointerId,
    enabled:gs.activeSkillButton.enabled,active:gs.scene.isActive(),input:gs.input.enabled,background:gs.backgroundPaused,
    pointers:gs.input.manager.pointers.map(p=>({id:p.id,down:p.isDown,x:p.x,y:p.y,identifier:p.identifier}))})`)));
  // CDP touchEnd lists the ended finger, rather than the remaining fingers.
  await touch('touchEnd',[point(2,520,1230)]); await sleep(100);
  assert.equal(await evaluate('gs.squad.health.currentHp'),33);
  assert.equal(await evaluate('gs.joystick.activePointerId'),moving); assert.ok(await evaluate('gs.joystick.dirX>0'));
  await touch('touchEnd');
  // Releasing the moving finger over the button must clear that finger, without casting.
  await ready(); await touch('touchStart',[point(1,130,1230)]); await touch('touchMove',[point(1,520,1230)]);
  await touch('touchEnd'); await sleep(100);
  assert.equal(await evaluate('gs.joystick.activePointerId'),null); assert.equal(await evaluate('gs.squad.activeRemaining()'),0);
  await ready(); await tap(520,1230);
  await evaluate(`gs.roomState='CLEARED';gs.saveCheckpoint();gs.sys.sceneUpdate=normalUpdate;gs.openSquadModal();undefined;`);
  const cooldown=await save(); assert.equal(cooldown.hero.activeRemainingMs,18000);
  await reload(); assert.equal(await evaluate('gs.squad.activeRemaining()'),18000);
  await evaluate("gs.game.events.emit('hidden');gs.game.events.emit('visible');undefined;");await sleep(300);
  assert.equal(await evaluate('gs.squad.activeRemaining()'),18000);
  report.talents={level:picked.hero.level,choices:picked.hero.talents,hp:picked.leaderHealth};
  report.active={heal:10,cooldown:18000,cancel:['drag','touchcancel','pointercancel','blur','pause','hidden'],dualTouch:true};
  // Valid, connected S5 boss checkpoint for mutation selection and replay.
  const data=structuredClone(cooldown), grid=new RoomGridManager(getStageDefinition(4)),start=grid.getCurrentRoom();
  const boss=grid.grid.flat().find(r=>r?.type==='BOSS'),queue=[start],prev=new Map([[start.id,null]]);
  for(const room of queue)for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){
    const next=grid.grid[room.gridY+dy]?.[room.gridX+dx];if(next&&!prev.has(next.id)){prev.set(next.id,room);queue.push(next);}}
  let count=0;for(let room=boss;room;room=prev.get(room.id)){room.cleared=room.visited=true;if(room.type==='EVENT')room.circleChoice='SKIP';count++;}
  Object.assign(data,{phase:'stage-cleared',currentRoomId:boss.id,grid:grid.grid,endlessChoice:'pending',mutation:'NONE',nextMutation:'NONE'});
  Object.assign(data.stats,{stageIndex:4,bossesDefeated:5,bossDefeated:true,roomsCleared:4+count});
  assert.equal(isRunCheckpoint(data),true);
  await evaluate(`localStorage.setItem('smash.run-checkpoint.v1',${JSON.stringify(JSON.stringify(data))});undefined;`);
  await send('Page.reload',{ignoreCache:true});await attach();await tap(360, 910);
  await waitFor("smash.scene.isActive('EndlessChoiceScene')");await ref();
  await click('EndlessChoiceScene','mutation-ARMORED'); assert.equal((await save()).nextMutation,'NONE');
  await evaluate('window.realSave=gs.saveCheckpoint.bind(gs);gs.saveCheckpoint=()=>false;undefined;');
  await click('EndlessChoiceScene','endless-continue');
  assert.equal(await evaluate('gs.progression.nextMutation'),'NONE');assert.equal(await evaluate('gs.progression.endlessChoice'),'pending');
  await evaluate('gs.saveCheckpoint=realSave;undefined;');
  await click('EndlessChoiceScene','endless-title');await waitFor("smash.scene.isActive('MenuScene')");
  await tap(360, 910);await waitFor("smash.scene.isActive('EndlessChoiceScene')");await ref();
  assert.equal(await evaluate("smash.scene.getScene('EndlessChoiceScene').children.getByName('mutation-description').text.includes('변이 없이')"),true);
  await click('EndlessChoiceScene','mutation-FIERCE');
  for(const width of[720,360]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:width*1280/720,deviceScaleFactor:1,mobile:true});await sleep(200);
    const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/mutation-${width}.png`,Buffer.from(png.data,'base64'));
    const bounds=await evaluate(`(()=>{const scene=smash.scene.getScene('EndlessChoiceScene');return {
      description:scene.children.getByName('mutation-description').getBounds().bottom,
      continueTop:scene.children.getByName('endless-continue').getBounds().top};})()`);
    assert.ok(bounds.description<bounds.continueTop);
  }
  await click('EndlessChoiceScene','endless-continue');
  await waitFor("smash.scene.isActive('SquadScene')");
  const confirmed=await save();assert.equal(confirmed.nextMutation,'FIERCE');assert.equal(confirmed.mutation,'NONE');
  await reload();assert.equal(await evaluate('gs.progression.nextMutation'),'FIERCE');
  await tap(360, 1210);await waitFor("smash.scene.isActive('GameScene')");
  const next=await save();assert.equal(next.stats.stageIndex,5);assert.equal(next.mutation,'FIERCE');assert.equal(next.nextMutation,'NONE');
  const spawned=await evaluate(`(()=>{gs.scene.pause();gs.startRoomLogic(gs.gridManager.getCurrentRoom());
    gs.spawnNextWave(gs.gridManager.getCurrentRoom());gs.processSpawns(10000);
    const enemy=gs.enemies.getChildren().find(e=>e.active);return {damage:enemy.spec.contactDamage,archetype:enemy.spec.archetype,
      pending:gs.pendingSpawns.length,active:gs.enemies.countActive(true)};})()`);
  const { ENEMY_SPECS }=load('src/config/gameData.ts');
  assert.equal(spawned.damage,Math.round(ENEMY_SPECS[spawned.archetype].contactDamage*getStageScaling(5,'FIERCE').enemyDamageMult));
  const rewards=await evaluate(`(()=>{const enemy=gs.enemies.getChildren().find(e=>e.active),before=gs.squad.roster.minerals;
    enemy.receiveDamage(enemy.health.maxHp,gs.time.now);gs.handleEnemyKilled(enemy,gs.squad.drones[0].id);
    const afterKill=gs.squad.roster.minerals;gs.clearEncounter();gs.finishRoom(gs.gridManager.getCurrentRoom());
    return {kill:afterKill-before,room:gs.squad.roster.minerals-afterKill};})()`);
  const {killReward,roomClearReward}=load('src/systems/EncounterRules.ts');
  assert.equal(rewards.kill,killReward(spawned.archetype,5,undefined,'FIERCE'));assert.equal(rewards.room,roomClearReward('COMBAT',5,'FIERCE'));
  report.mutation={confirmed:confirmed.nextMutation,stage:next.stats.stageIndex+1,current:next.mutation,spawned,rewards};
  assert.deepEqual(browser.errors,[]);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:'passed',...report}));
}finally{browser.close();}
