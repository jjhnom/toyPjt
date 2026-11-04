import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const require = name => name.startsWith('.') ? load(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  new Function('require', 'module', 'exports', source)(require, module, module.exports);
  return module.exports;
}
const { STAGES, getStageScaling, stageClearReward, ENEMY_POOL_SIZE } = load(resolve('src/config/stageData.ts'));
const { RoomGridManager } = load(resolve('src/systems/RoomGridManager.ts'));
const { StageProgression } = load(resolve('src/systems/StageProgression.ts'));

test('all five stage grids have exact counts, symmetric doors, and reachable unique special rooms', () => {
  for (const stage of STAGES) for (let trial = 0; trial < 100; trial++) {
    const manager = new RoomGridManager(stage);
    assert.equal(manager.grid.length, stage.gridHeight);
    assert.ok(manager.grid.every(row => row.length === stage.gridWidth));
    const rooms = manager.grid.flat().filter(Boolean);
    assert.equal(rooms.length, stage.roomCount);
    for (const type of ['SHOP', 'RECOVERY', 'BOSS']) assert.equal(rooms.filter(room => room.type === type).length, 1);
    assert.equal(rooms.filter(room => room.type === 'ELITE').length, stage.eliteCount);
    assert.equal(manager.getDepth(manager.getCurrentRoom()), 0);
    const visited = new Set();
    const queue = [manager.getCurrentRoom()];
    for (const room of queue) {
      if (visited.has(room.id)) continue;
      visited.add(room.id);
      assert.ok(manager.getDepth(room) >= 0 && manager.getDepth(room) <= 1);
      for (const [direction, dx, dy, opposite] of [['top', 0, -1, 'bottom'], ['bottom', 0, 1, 'top'], ['left', -1, 0, 'right'], ['right', 1, 0, 'left']]) {
        const neighbor = manager.grid[room.gridY + dy]?.[room.gridX + dx];
        assert.equal(room.doors[direction], !!neighbor);
        if (neighbor) { assert.equal(neighbor.doors[opposite], true); if (!visited.has(neighbor.id)) queue.push(neighbor); }
      }
    }
    assert.equal(visited.size, stage.roomCount);
    assert.equal(manager.getDepth(rooms.find(room => room.type === 'BOSS')), 1);
  }
});

test('stage 1, 3, and 5 scaling uses the designed curve and enforces caps', () => {
  for (const n of [0, 2, 4]) {
    const scaling = getStageScaling(n);
    assert.equal(scaling.enemyHpMult, 1 + 0.45 * n ** 1.15);
    assert.equal(scaling.enemyDamageMult, 1 + 0.25 * n);
    assert.equal(scaling.enemySpeedMult, 1 + 0.06 * n);
    assert.equal(scaling.spawnIntervalMult, 1 - 0.07 * n);
    assert.equal(scaling.waveCountBonus, Math.floor(n / 2));
    assert.ok(scaling.bossHpMult >= scaling.enemyHpMult);
    assert.ok(stageClearReward(STAGES[n]) > 0);
  }
  const far = getStageScaling(100);
  assert.equal(far.enemySpeedMult, 1.3);
  assert.equal(far.spawnIntervalMult, 0.6);
  assert.equal(far.maxActiveEnemies, Math.floor(ENEMY_POOL_SIZE * 0.8));
});

test('intermediate bosses grant one reward and one transition; only the final boss wins', () => {
  const run = new StageProgression();
  for (let i = 0; i < STAGES.length; i++) {
    assert.equal(run.index, i);
    assert.equal(run.beginTransition(), false);
    const reward = run.clearBoss();
    assert.equal(reward.victory, i === STAGES.length - 1);
    assert.equal(reward.minerals, stageClearReward(STAGES[i]));
    assert.equal(reward.freeSummons, i === STAGES.length - 1 ? 0 : 1);
    assert.equal(run.clearBoss(), null);
    if (!reward.victory) {
      assert.equal(run.beginTransition(), true);
      assert.equal(run.beginTransition(), false);
      assert.equal(run.clearBoss(), null);
      run.finishTransition();
    } else assert.equal(run.beginTransition(), false);
  }
  assert.equal(run.bossesDefeated, 5);
  const fresh = new StageProgression();
  assert.equal(fresh.index, 0);
  assert.equal(fresh.bossesDefeated, 0);
});
