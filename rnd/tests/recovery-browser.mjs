import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession, sleep } from './helpers/browser-session.mjs';

const browser = await browserSession();
const { evaluate, waitFor, tap, send } = browser;
const output = 'artifacts/recovery';
const save = () => evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const remaining = () => evaluate('gs.revivalPause.remainingMs(gs.squad.drones[0], gs.time.now)');
const vitals = () => evaluate('({ leader: gs.squad.health.currentHp, units: gs.squad.drones.map(d => d.health.currentHp) })');
const closeManagement = async () => {
  await tap(360, 1210);
  await waitFor("!smash.scene.isActive('SquadScene') && smash.scene.isActive('GameScene')");
};
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
  const initial = await save();
  // Old stage-start saves may contain allies below the new floor. Loading must preserve them.
  for (const version of [1, 2]) {
    const data = structuredClone(initial); data.version = version;
    data.leaderHealth.currentHp = 23; data.unitHealth[0].currentHp = 1; data.unitHealth[1].currentHp = 4;
    if (version === 1) {
      delete data.runId; delete data.phase; delete data.currentRoomId;
      data.unitHealth = data.unitHealth.map(({ id, currentHp }) => ({ id, currentHp }));
    }
    await evaluate(`window.gs = smash.scene.getScene('GameScene');
      gs.returnToTitle(); localStorage.setItem('smash.run-checkpoint.v1', ${JSON.stringify(JSON.stringify(data))}); undefined;`);
    await waitFor("smash.scene.isActive('MenuScene')");
    await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
    await evaluate("window.gs = smash.scene.getScene('GameScene'); gs.scene.pause(); undefined;");
    assert.deepEqual(await vitals(), { leader: 23, units: [1, 4] }, `v${version} must not gain transition recovery`);
  }
  await evaluate(`gs.scene.resume(); undefined;`);
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES';
    gs.squad.drones[0].health.takeDamage(10000, gs.time.now);
    gs.squad.drones[1].health.currentHp = 1;
    gs.finishRoom(gs.gridManager.getCurrentRoom()); undefined;`);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  const beforePause = await remaining();
  await sleep(250); await evaluate("smash.events.emit('hidden'); undefined;"); await sleep(250);
  await tap(360, 1210); // Closing management cannot resume while hidden.
  await waitFor("!smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate("smash.scene.isPaused('GameScene')"), true);
  assert.equal(await remaining(), beforePause);
  assert.equal((await save()).unitHealth[0].reviveRemainingMs, beforePause);
  await evaluate("smash.events.emit('visible'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')"); await sleep(100);
  const afterPause = await remaining();
  assert.ok(afterPause > beforePause - 300 && afterPause <= beforePause, 'paused wall time must not consume revival');

  await evaluate("gs.openSquadModal('부활 대기 검사'); undefined;");
  await waitFor("smash.scene.isActive('SquadScene')");
  const secondPause = await remaining();
  await evaluate("smash.events.emit('hidden'); smash.events.emit('visible'); undefined;");
  await sleep(150);
  assert.equal(await evaluate("smash.scene.isPaused('GameScene')"), true, 'visible cannot dismiss management');
  assert.equal(await remaining(), secondPause);
  await closeManagement();
  const secondResume = await remaining();
  assert.ok(secondResume > secondPause - 300 && secondResume <= secondPause);

  // The actual door handler must equalize a dead ally and a one-HP survivor.
  const entered = await evaluate(`(() => {
    gs.scene.pause();
    const direction = ['top','bottom','left','right'].find(dir => gs.gridManager.getAdjacentRoom(dir)?.type !== 'BOSS'
      && gs.gridManager.getAdjacentRoom(dir));
    const zone = gs.doors[direction].triggerZone;
    gs.squad.setPositionImmediate(zone.centerX, zone.centerY); gs.checkDoorTransition();
    return { ...{ leader: gs.squad.health.currentHp, units: gs.squad.drones.map(d => d.health.currentHp) },
      roomId: gs.gridManager.getCurrentRoom().id };
  })()`);
  assert.equal(entered.leader, 23); assert.deepEqual(entered.units, [35, 35]);

  const completeCurrent = async () => {
    await evaluate(`(() => {
      const room = gs.gridManager.getCurrentRoom();
      if (room.cleared || room.type === 'EVENT') gs.startRoomLogic(room); else gs.finishRoom(room);
      if (!gs.rewardModalOpen) gs.scene.resume();
    })()`);
    if (await evaluate("gs.rewardModalOpen && gs.gridManager.getCurrentRoom().type === 'EVENT' && !gs.gridManager.getCurrentRoom().cleared")) {
      await waitFor("smash.scene.isActive('SummoningCircleScene')");
      await tap(360, 1010); await waitFor("!smash.scene.isActive('SummoningCircleScene')");
    }
    if (await evaluate('gs.rewardModalOpen')) {
      await waitFor("smash.scene.isActive('SquadScene')"); await closeManagement();
    } else await waitFor("smash.scene.isActive('GameScene')");
  };
  const springPath = await evaluate(`(() => {
    const start = gs.gridManager.getCurrentRoom(), queue = [start], previous = new Map([[start.id, null]]);
    let target;
    for (const room of queue) {
      if (room.type === 'RECOVERY') { target = room; break; }
      for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const next = gs.gridManager.grid[room.gridY+dy]?.[room.gridX+dx];
        if (next && next.type !== 'BOSS' && !previous.has(next.id)) { previous.set(next.id,room); queue.push(next); }
      }
    }
    const path = [];
    for (let room = target; room && room !== start; room = previous.get(room.id)) path.unshift(room.id);
    return { path, alreadySpring: start.type === 'RECOVERY' };
  })()`);
  if (!springPath.alreadySpring) await completeCurrent();
  for (const id of springPath.path) {
    await evaluate(`(() => {
      gs.scene.pause();
      const current = gs.gridManager.getCurrentRoom();
      const next = gs.gridManager.grid.flat().find(room => room?.id === ${JSON.stringify(id)});
      const dir = next.gridX > current.gridX ? 'right' : next.gridX < current.gridX ? 'left' : next.gridY > current.gridY ? 'bottom' : 'top';
      gs.gridManager.moveTo(dir); gs.enterRoom(next,dir);
    })()`);
    if (id !== springPath.path.at(-1)) await completeCurrent();
  }
  const spring = await evaluate(`(() => {
    const room = gs.gridManager.getCurrentRoom();
    const before = gs.stats.roomsCleared, minerals = gs.squad.roster.minerals;
    gs.startRoomLogic(room); gs.startRoomLogic(room);
    return { type: room.type, leader: gs.squad.health.currentHp, units: gs.squad.drones.map(d => d.health.currentHp),
      clears: gs.stats.roomsCleared - before, currencyChanged: minerals !== gs.squad.roster.minerals,
      subtitle: gs.bannerSubtitle.text };
  })()`);
  assert.equal(spring.type, 'RECOVERY'); assert.equal(spring.leader, 68); assert.deepEqual(spring.units, [67, 67]);
  assert.equal(spring.clears, 1); assert.equal(spring.currencyChanged, false); assert.ok(spring.subtitle.includes('동료 2기 회복'));
  const savedSpring = await save();
  assert.deepEqual(savedSpring.unitHealth.map(d => d.currentHp), [67, 67]);
  await mkdir(output, { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await evaluate('gs.scene.resume(); undefined;'); await waitFor("smash.scene.isActive('GameScene')");
  await sleep(200); await evaluate('gs.scene.pause(); undefined;');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${output}/spring-360.png`, Buffer.from(screenshot.data, 'base64'));

  await evaluate('gs.returnToTitle(); undefined;'); await waitFor("smash.scene.isActive('MenuScene')");
  await tap(360, 910); await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await evaluate("window.gs = smash.scene.getScene('GameScene'); undefined;");
  assert.deepEqual(await vitals(), { leader: 68, units: [67, 67] }, 'resume cannot replay entry or spring recovery');
  await closeManagement();
  const revisit = await evaluate(`(() => {
    gs.scene.pause();
    const original = gs.gridManager.getCurrentRoom(); const clears = gs.stats.roomsCleared;
    const dir = ['top','bottom','left','right'].find(d => gs.gridManager.getAdjacentRoom(d)?.cleared);
    const reverse = { top:'bottom', bottom:'top', left:'right', right:'left' };
    for (let i=0;i<4;i++) for (const direction of [dir, reverse[dir]]) {
      const room = gs.gridManager.moveTo(direction); gs.enterRoom(room,direction); gs.startRoomLogic(room);
    }
    return { room: gs.gridManager.getCurrentRoom().id === original.id, sameClears: gs.stats.roomsCleared === clears,
      leader: gs.squad.health.currentHp, units: gs.squad.drones.map(d=>d.health.currentHp) };
  })()`);
  assert.deepEqual(revisit, { room: true, sameClears: true, leader: 68, units: [67, 67] });
  assert.deepEqual(browser.errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ beforePause, afterPause, secondPause, secondResume, entered, spring, revisit }, null, 2)+'\n');
  console.log('PASS: v1/v2 low-HP resume, nested revival pause, actual door floor, once-only party spring, stored HP, round-trip revisits, 360 touch');
} finally { browser.close(); }
