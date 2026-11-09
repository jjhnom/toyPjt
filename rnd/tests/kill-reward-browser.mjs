import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession } from './helpers/browser-session.mjs';

const browser = await browserSession();
const { evaluate, waitFor, tap } = browser;
const rows = [];
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`(async () => {
    window.gs = smash.scene.getScene('GameScene'); gs.scene.pause();
    window.stageDefs = (await import('/src/config/stageData.ts')).STAGES;
    window.Grid = (await import('/src/systems/RoomGridManager.ts')).RoomGridManager;
  })()`);
  for (let index = 0; index < 5; index++) {
    const row = await evaluate(`(() => {
      gs.scene.pause(); gs.clearEncounter();
      gs.progression.index = ${index}; gs.progression.bossesDefeated = ${index};
      gs.stats.stageIndex = ${index}; gs.stats.bossesDefeated = ${index}; gs.squad.roster.stageIndex = ${index};
      gs.gridManager = new Grid(stageDefs[${index}]);
      const room = gs.gridManager.getCurrentRoom(); gs.enterRoom(room, null);
      gs.roomState = 'LOCKED_WAVES';
      const before = gs.squad.roster.minerals;
      for (const type of ['SWARMER', 'ELITE_BRUTE']) {
        const enemy = gs.enemies.spawnEnemy(type, 300, 400);
        enemy.receiveDamage(1000000, gs.time.now); gs.handleEnemyKilled(enemy);
      }
      const afterKills = gs.squad.roster.minerals;
      const live = gs.getEconomyReport();
      const rewards = live.entries.filter(e => e.stageIndex === ${index} && e.reason === 'kill').map(e => e.minerals);
      gs.finishRoom(room);
      return { stage: ${index} + 1, rewards, killsGained: afterKills - before,
        roomReward: gs.squad.roster.minerals - afterKills };
    })()`);
    assert.deepEqual(row.rewards, [[4,32], [5,36], [5,40], [6,44], [6,47]][index]);
    assert.equal(row.killsGained, row.rewards.reduce((a, b) => a + b, 0));
    assert.equal(row.roomReward, [25,33,40,48,55][index]);
    await waitFor("smash.scene.isActive('SquadScene')");
    const snapshot = await evaluate('gs.squad.roster.snapshot()');
    assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1')).roster"), snapshot);
    rows.push(row);
    await tap(360, 1210);
    await waitFor("smash.scene.isActive('GameScene') && !smash.scene.isActive('SquadScene')");
  }
  assert.deepEqual(browser.errors, []);
  await mkdir('artifacts/economy', { recursive: true });
  await writeFile('artifacts/economy/live-kill-rewards.json', JSON.stringify({ kind: 'controlled-Phaser-integration', rows }, null, 2) + '\n');
  console.log('PASS: actual GameScene kill credit, ledger, unchanged room rewards and checkpoint balances across all five stages');
} finally { browser.close(); }
