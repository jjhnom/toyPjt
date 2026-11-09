import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../scripts/lib/load-typescript.mjs';

const { SquadRoster } = load('src/systems/SquadRoster.ts');
const { STAGES } = load('src/config/stageData.ts');
const { ENEMY_SPECS } = load('src/config/gameData.ts');
const { killReward, roomClearReward, waveEnemyTypes } = load('src/systems/EncounterRules.ts');
const { simulateEconomy, recipeCostReport } = load('src/systems/EconomySimulation.ts');
const { RunSaveManager, RUN_SAVE_KEY } = load('src/systems/RunSaveManager.ts');
const { RoomGridManager } = load('src/systems/RoomGridManager.ts');
const { UNIT_TYPES } = load('src/config/unitData.ts');

test('approved live rewards use square-root scaling, preserve stage-one values and retain room awards', () => {
  for (let index = 0; index < 5; index++) {
    for (const enemy of Object.values(ENEMY_SPECS)) {
      const reward = killReward(enemy.archetype, index);
      assert.equal(reward, Math.round(enemy.mineralValue * Math.sqrt(1 + 0.3 * index)));
      assert.ok(reward >= enemy.mineralValue);
      assert.ok(reward <= killReward(enemy.archetype, index, 'linear'));
      if (index === 0) assert.equal(reward, enemy.mineralValue);
    }
    assert.equal(roomClearReward('COMBAT', index), Math.round(25 * (1 + 0.3 * index)));
    assert.equal(roomClearReward('ELITE', index), Math.round(45 * (1 + 0.3 * index)));
  }
});

test('required waves include elite guardians, four boss escorts, and exactly three circle guardians', () => {
  const stage = STAGES[4];
  for (let wave = 1; wave <= 4; wave++) {
    const list = waveEnemyTypes(stage, { type: 'ELITE' }, wave, 4);
    assert.equal(list.length, 6 + wave * 2 + Number(wave === 4));
    assert.equal(list.filter(id => id === 'ELITE_BRUTE').length, Number(wave === 4));
  }
  assert.equal(waveEnemyTypes(stage, { type: 'BOSS' }, 1, 1).length, 5);
  assert.deepEqual(waveEnemyTypes(stage, { type: 'EVENT' }, 1, 1), ['ELITE_BRUTE', 'SWARMER', 'SWARMER']);
});

test('successful paid, free, quick, recipe, promotion and refund transactions reconcile to the exact balance', () => {
  const roster = new SquadRoster(1000);
  roster.grantReward(25, 1, 'room');
  assert.equal(roster.summon('BASIC_LASER'), true);
  assert.equal(roster.summon('STONE_GUARD'), true);
  assert.equal(roster.combine('promote_BASIC_LASER_1'), true);
  assert.equal(roster.quickCraft('PHOENIX_LORD', 250), true);
  assert.equal(roster.sell(roster.units.find(u => u.archetype === 'STONE_GUARD').id), true);
  const report = roster.economy.report(), total = report.stages[0];
  assert.equal(report.baseline.minerals + total.income - total.spent, roster.minerals);
  assert.equal(report.baseline.vouchers + total.vouchersGranted - total.vouchersUsed, roster.freeSummons);
  assert.equal(report.entries.find(e => e.reason === 'summon').minerals, 0);
  const before = roster.economy.report();
  assert.equal(roster.quickCraft('PHOENIX_LORD', 0), false);
  assert.equal(roster.combine('not-a-recipe'), false);
  assert.deepEqual(roster.economy.report(), before);
});

test('history is bounded, exported data cannot mutate the ledger, and restore starts a new observation segment', () => {
  const roster = new SquadRoster();
  for (let i = 0; i < 600; i++) roster.grantReward(4, 0, 'kill');
  const report = roster.economy.report();
  assert.equal(report.entries.length, 512); assert.equal(report.historyTruncated, true);
  assert.equal(report.stages[0].income, 2400);
  report.entries[0].balance = -1; report.stages[0].byReason.kill = -1;
  assert.equal(roster.economy.report().stages[0].byReason.kill, 2400);
  roster.recordEconomy('stageEnd');
  const composition = roster.economy.report().entries.at(-1).composition;
  composition[0].star = 3;
  assert.equal(roster.economy.report().entries.at(-1).composition[0].star, 1);
  const snapshot = roster.snapshot(); roster.restore(snapshot, 2);
  assert.equal(roster.economy.report().eventsRecorded, 0);
  assert.equal(roster.economy.report().baseline.minerals, snapshot.minerals);
});

test('seeded five-stage comparisons keep identical paths and kills; spending and balances are reproducible', () => {
  for (const route of ['all', 'boss']) {
    const current = simulateEconomy(42, 'linear', route);
    assert.deepEqual(simulateEconomy(42, 'linear', route), current);
    for (const policy of ['unscaled', 'sqrt']) {
      const other = simulateEconomy(42, policy, route);
      current.stages.forEach((stage, i) => {
        assert.deepEqual(other.stages[i].roomIds, stage.roomIds);
        assert.equal(other.stages[i].kills, stage.kills);
        assert.ok(other.stages[i].income <= stage.income);
        assert.equal(stage.endBalance, stage.startBalance + stage.income - stage.spent);
        assert.ok(other.stages[i].endBalance >= 0);
      });
    }
  }
  const all = simulateEconomy(42), shortest = simulateEconomy(42, 'sqrt', 'boss');
  assert.equal(all.policy, 'sqrt');
  assert.ok(all.stages[4].income > shortest.stages[4].income);
  for (const row of recipeCostReport(0)) assert.equal(row.cost, row.summonCost + row.combinationCost);
});

test('reduced rewards keep fixed crafting targets affordable across reproducible routes and seeds', () => {
  const targets = ['PIERCE_BEAM', 'WORLD_DRUID', 'PHOENIX_LORD', 'EARTH_DEITY', 'STORM_GENERAL'];
  for (const seed of [0, 1, 42, 100, 0xffffffff]) for (const route of ['all', 'boss']) {
    const report = simulateEconomy(seed, undefined, route);
    assert.equal(report.policy, 'sqrt');
    report.stages.forEach((stage, index) => {
      assert.equal(stage.purchase, targets[index], `${seed} ${route} S${index + 1}`);
      assert.equal(stage.endBalance, stage.startBalance + stage.income - stage.spent);
      assert.ok(stage.endBalance >= 0);
      assert.ok(stage.owned <= 16 && stage.deployed <= 6);
    });
  }
});

test('old checkpoint balances and vouchers are unchanged; only future kills use the approved reward', () => {
  const roster = new SquadRoster(819);
  roster.stageIndex = 4; roster.freeSummons = 3;
  const data = { version: 1, savedAt: 1000, stats: { stageIndex: 4, bossesDefeated: 4, roomsCleared: 16,
    enemiesDefeated: 200, mineralsCollected: 819, bossDefeated: false,
    damageMultiplier: 1, attackSpeedMultiplier: 1, moveSpeedBonus: 0 },
    roster: roster.snapshot(), leaderHealth: { currentHp: 65, maxHp: 100 },
    unitHealth: roster.units.map(unit => ({ id: unit.id, currentHp: UNIT_TYPES[unit.archetype].maxHp })),
    grid: new RoomGridManager(STAGES[4]).grid };
  const text = JSON.stringify(data), values = new Map([[RUN_SAVE_KEY, text]]);
  const saves = new RunSaveManager({ getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  const loaded = saves.load(); assert.equal(loaded.status, 'ready');
  assert.deepEqual(loaded.checkpoint, data); assert.equal(values.get(RUN_SAVE_KEY), text);
  const restored = new SquadRoster(); restored.restore(loaded.checkpoint.roster, 4);
  assert.equal(restored.minerals, 819); assert.equal(restored.freeSummons, 3);
  restored.grantReward(killReward('TANK', 4), 0, 'kill', 'TANK');
  assert.equal(restored.minerals, 840); assert.equal(restored.freeSummons, 3);
  assert.equal(restored.quickCraft('PHOENIX_LORD', 250), true);
  assert.equal(restored.minerals, 590); assert.equal(restored.freeSummons, 3);
});
