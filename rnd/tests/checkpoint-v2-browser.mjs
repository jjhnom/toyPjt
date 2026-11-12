import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession, sleep } from './helpers/browser-session.mjs';

const browser = await browserSession();
const { send, evaluate, waitFor, tap, attach, click } = browser;
const output = 'artifacts/roadmap-foundations';
await mkdir(output, { recursive: true });
const save = () => evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const reload = async () => {
  await send('Page.reload'); await sleep(700); await attach();
  await tap(360, 910);
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  await evaluate("window.gs = smash.scene.getScene('GameScene'); undefined;");
};
const closeManagement = async () => {
  await tap(360, 1210);
  await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
};
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`window.gs = smash.scene.getScene('GameScene'); gs.scene.pause();
    gs.squad.drones[0].health.takeDamage(100000, gs.time.now);
    gs.squad.drones[0].reviveAt = gs.time.now + 9000;
    gs.finishRoom(gs.gridManager.getCurrentRoom()); undefined;`);
  await waitFor("smash.scene.isActive('SquadScene')");
  const first = await save();
  assert.equal(first.version, 2); assert.equal(first.phase, 'room-cleared');
  assert.equal(first.roster.minerals, 55); assert.equal(first.unitHealth[0].currentHp, 0);
  assert.equal(first.unitHealth[0].reviveRemainingMs, 9000);
  await click('SquadScene', 'summon-BASIC_LASER'); // Successful paid summon; leave management open.
  const purchased = await save();
  assert.equal(purchased.roster.minerals, 40); assert.equal(purchased.roster.units.length, 3);
  const live = await evaluate('gs.squad.roster.economy.report()');
  assert.equal(live.stages[0].income, 25); assert.equal(live.stages[0].spent, 15);
  await writeFile(`${output}/live-economy.json`, JSON.stringify(live, null, 2) + '\n');

  await reload(); // Simulate process interruption before closing management.
  assert.deepEqual(await evaluate('gs.squad.roster.snapshot()'), purchased.roster);
  assert.equal(await evaluate('gs.squad.drones[0].health.currentHp'), 0);
  assert.equal(await evaluate('gs.squad.drones[0].active'), false);
  assert.ok(Math.abs(await evaluate('gs.squad.drones[0].reviveAt - gs.time.now') - 9000) < 1);
  assert.equal((await save()).roster.minerals, 40, 'Continue does not replay room rewards');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(250);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${output}/resumed-management-360.png`, Buffer.from(screenshot.data, 'base64'));
  await closeManagement();

  // Move along connected rooms; controlled encounter completion tests persistence, not combat strength.
  const pathTo = type => evaluate(`(() => {
    const type = ${JSON.stringify(type)};
    const start = gs.gridManager.getCurrentRoom(), queue = [start], previous = new Map([[start.id, null]]);
    let target;
    for (const room of queue) {
      if (room.type === type) { target = room; break; }
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const next = gs.gridManager.grid[room.gridY + dy]?.[room.gridX + dx];
        // Visiting the circle/spring must not clear a boss and advance stages midway through this path.
        if (next && (type === 'BOSS' || next.type !== 'BOSS') && !previous.has(next.id)) { previous.set(next.id, room); queue.push(next); }
      }
    }
    const path = [];
    for (let room = target; room && room !== start; room = previous.get(room.id)) path.unshift(room.id);
    return path;
  })()`);
  const travel = async type => {
    const path = await pathTo(type);
    for (const id of path) {
      await evaluate(`(() => {
        gs.scene.pause();
        const room = gs.gridManager.grid.flat().find(r => r?.id === ${JSON.stringify(id)});
        const current = gs.gridManager.getCurrentRoom();
        const direction = room.gridX > current.gridX ? 'right' : room.gridX < current.gridX ? 'left'
          : room.gridY > current.gridY ? 'bottom' : 'top';
        gs.gridManager.moveTo(direction); gs.enterRoom(room, direction);
        if (room.type === 'EVENT' || room.type === 'RECOVERY' || room.cleared) gs.startRoomLogic(room);
        else gs.finishRoom(room);
        if (!gs.rewardModalOpen) gs.scene.resume();
      })()`);
      if (await evaluate("gs.rewardModalOpen && gs.gridManager.getCurrentRoom().type === 'EVENT' && !gs.gridManager.getCurrentRoom().cleared")) {
        await waitFor("smash.scene.isActive('SummoningCircleScene')");
        await tap(360, 566); await waitFor("smash.scene.isActive('SquadScene')");
      }
      if (await evaluate('gs.rewardModalOpen')) {
        await waitFor("smash.scene.isActive('SquadScene')"); await closeManagement();
      } else await waitFor("smash.scene.isActive('GameScene')");
    }
  };
  await travel('EVENT');
  const event = await save();
  assert.equal(event.grid.flat().find(r => r?.id === event.currentRoomId).circleChoice, 'SAFE', JSON.stringify({
    saved: event, live: await evaluate('({status: gs.saveStatusText.text, room: gs.gridManager.getCurrentRoom(), vitals: gs.squad.drones.map(d => ({id:d.id,hp:d.health.currentHp,reviveAt:d.reviveAt,lastHealAt:d.lastHealAt})), now:gs.time.now})') }));
  const vouchers = event.roster.freeSummons;
  await reload();
  assert.equal(await evaluate('gs.squad.roster.freeSummons'), vouchers);
  await closeManagement();
  await evaluate('gs.startRoomLogic(gs.gridManager.getCurrentRoom()); undefined;');
  assert.equal(await evaluate('gs.squad.roster.freeSummons'), vouchers);
  assert.equal(await evaluate("smash.scene.isActive('SummoningCircleScene')"), false);

  await travel('RECOVERY');
  const recovery = await save();
  assert.equal(recovery.grid.flat().find(r => r?.id === recovery.currentRoomId).type, 'RECOVERY');
  await reload();
  assert.equal(await evaluate('gs.squad.health.currentHp'), recovery.leaderHealth.currentHp);
  await closeManagement();

  // Leave the middle-boss management open, reload it, and transition once.
  const path = await pathTo('BOSS');
  const bossId = path.at(-1);
  // Reuse travel for preceding rooms by temporarily treating the boss as the final manual step.
  for (const id of path) {
    await evaluate(`(() => {
      gs.scene.pause();
      const room = gs.gridManager.grid.flat().find(r => r?.id === ${JSON.stringify(id)});
      gs.gridManager.currentX = room.gridX; gs.gridManager.currentY = room.gridY; room.visited = true;
      gs.enterRoom(room, null);
      if (room.cleared || room.type === 'RECOVERY') gs.startRoomLogic(room);
      else gs.finishRoom(room);
      if (!gs.rewardModalOpen) gs.scene.resume();
    })()`);
    await sleep(100);
    if (id !== bossId && await evaluate("smash.scene.isActive('SquadScene')")) await closeManagement();
  }
  await waitFor("smash.scene.isActive('SquadScene')");
  const boss = await save();
  assert.equal(boss.phase, 'stage-cleared'); assert.equal(boss.stats.bossesDefeated, 1);
  await reload();
  assert.equal(await evaluate('gs.progression.state'), 'STAGE_CLEARED');
  assert.deepEqual(await evaluate('gs.squad.roster.snapshot()'), boss.roster);
  assert.equal(await evaluate('gs.squad.health.currentHp'), boss.leaderHealth.currentHp);
  await closeManagement();
  const next = await save();
  assert.equal(next.phase, 'stage-start'); assert.equal(next.stats.stageIndex, 1);
  assert.equal(next.stats.bossesDefeated, 1);
  assert.equal(next.leaderHealth.currentHp,
    Math.min(next.leaderHealth.maxHp, boss.leaderHealth.currentHp + Math.round(boss.leaderHealth.maxHp * 0.4)));
  const backup = await evaluate("localStorage.getItem('smash.run-checkpoint.backup')");
  assert.ok(backup);
  await evaluate("localStorage.setItem('smash.run-checkpoint.v1', '{broken'); gs.returnToTitle(); undefined;");
  await waitFor("smash.scene.isActive('MenuScene')");
  assert.equal(await evaluate("smash.scene.getScene('MenuScene').children.list.some(c => c.text?.includes('이전 정상 저장'))"), true);
  await tap(360, 910); await waitFor("smash.scene.isActive('SquadScene')");
  await evaluate("window.gs = smash.scene.getScene('GameScene'); undefined;");
  assert.equal(await evaluate('gs.progression.state'), 'STAGE_CLEARED');
  await closeManagement();
  await evaluate('gs.handlePlayerDeath(); undefined;');
  await waitFor("smash.scene.isActive('GameOverScene')");
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"), null);
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.backup')"), null);
  assert.deepEqual(browser.errors, []);
  console.log('PASS: v2 transaction interruption, fallen timers, connected circle/recovery visits, middle-boss resume, fallback, death, 720/360 touch');
} finally { browser.close(); }
