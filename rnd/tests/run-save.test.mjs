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
const { RunSaveManager, isRunCheckpoint } = load(resolve('src/systems/RunSaveManager.ts'));
const { SquadRoster } = load(resolve('src/systems/SquadRoster.ts'));
const { RoomGridManager } = load(resolve('src/systems/RoomGridManager.ts'));
const { StageProgression } = load(resolve('src/systems/StageProgression.ts'));
const { STAGES } = load(resolve('src/config/stageData.ts'));
const { UNIT_TYPES } = load(resolve('src/config/unitData.ts'));

class MemoryStorage {
  values = new Map();
  get value() { return this.getItem('smash.run-checkpoint.v1'); }
  set value(value) { value === null ? this.removeItem('smash.run-checkpoint.v1') : this.setItem('smash.run-checkpoint.v1', value); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function checkpoint(index = 2) {
  const roster = new SquadRoster(500);
  for (let i = 0; i < 3; i++) roster.summon('BASIC_LASER');
  roster.combine('gatling');
  roster.combine('promote_BASIC_LASER_1');
  roster.summon('HERBAL_PRIEST');
  roster.toggleDeployment(roster.units.at(-1).id);
  roster.summon('SHADOW_DAGGER');
  roster.sell(roster.units.at(-1).id); // The highest allocated ID no longer exists.
  roster.stageIndex = index;
  roster.freeSummons = 2;
  return {
    version: 1, savedAt: Date.now(),
    stats: { stageIndex: index, bossesDefeated: index, roomsCleared: 12, enemiesDefeated: 45,
      mineralsCollected: roster.minerals, bossDefeated: false, damageMultiplier: 1.7, attackSpeedMultiplier: 1.2, moveSpeedBonus: 20 },
    roster: roster.snapshot(), leaderHealth: { currentHp: 63, maxHp: 120 },
    unitHealth: roster.units.filter(unit => unit.deployed).map(unit => ({ id: unit.id,
      currentHp: Math.round(UNIT_TYPES[unit.archetype].maxHp * (1 + 0.5 * (unit.star - 1)) * 0.5) })),
    grid: new RoomGridManager(STAGES[index]).grid
  };
}

test('every stage checkpoint round-trips with the same grid, depths, health, upgrades, and roster', () => {
  for (let index = 0; index < STAGES.length; index++) {
    const storage = new MemoryStorage();
    const manager = new RunSaveManager(storage);
    assert.equal(manager.load().status, 'empty');
    const expected = checkpoint(index);
    assert.equal(isRunCheckpoint(expected), true);
    assert.equal(manager.save(expected), true);
    const restored = manager.load();
    assert.equal(restored.status, 'ready');
    assert.deepEqual(restored.checkpoint, expected);
    const grid = new RoomGridManager(STAGES[index], restored.checkpoint.grid);
    assert.deepEqual(grid.grid, expected.grid);
    assert.equal(grid.getDepth(grid.getCurrentRoom()), 0);
    assert.equal(grid.getDepth(grid.grid.flat().find(room => room?.type === 'BOSS')), 1);
    grid.getCurrentRoom().cleared = true;
    restored.checkpoint.roster.units.pop();
    assert.deepEqual(manager.load().checkpoint, expected, 'runtime mutation must not change the saved snapshot');
  }
});

test('consumed and sold units stay gone; new IDs exceed the saved high-water mark', () => {
  const saved = checkpoint();
  const roster = new SquadRoster();
  roster.restore(saved.roster, saved.stats.stageIndex);
  assert.deepEqual(roster.snapshot(), saved.roster);
  assert.equal(roster.stageIndex, 2);
  assert.equal(roster.units.some(unit => unit.id === 'unit_1' || unit.id === 'unit_2'), false);
  assert.equal(roster.summon('STONE_GUARD'), true);
  assert.equal(roster.units.at(-1).id, `unit_${saved.roster.nextId + 1}`);
  assert.equal(roster.freeSummons, 1);
  assert.equal(roster.minerals, saved.roster.minerals);
});

test('legacy shop checkpoints resume as summoning circles without rewriting rewards, health or storage', () => {
  for (let index = 0; index < STAGES.length; index++) {
    const expected = checkpoint(index);
    const legacy = structuredClone(expected);
    legacy.grid.flat().find(room => room?.type === 'EVENT').type = 'SHOP';
    const storage = new MemoryStorage();
    storage.value = JSON.stringify(legacy);
    const original = storage.value;
    const manager = new RunSaveManager(storage);
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = manager.load();
      assert.equal(result.status, 'ready');
      assert.deepEqual(result.checkpoint, expected);
      assert.equal(storage.value, original);
    }
  }
});

test('migration still rejects malformed grids, duplicate circles and event decisions from mid-stage', () => {
  for (const mutate of [
    data => { data.grid.flat().find(room => room?.type === 'EVENT').circleChoice = 'SAFE'; },
    data => { data.grid.flat().find(room => room?.type === 'EVENT').circleChoice = 'CHALLENGE'; },
    data => { data.grid.flat().find(room => room?.type === 'EVENT').waveCount = 1; },
    data => { data.grid.flat().find(room => room?.type === 'ELITE').type = 'SHOP'; }
  ]) {
    const data = checkpoint(); mutate(data);
    const storage = new MemoryStorage(); storage.value = JSON.stringify(data);
    assert.equal(new RunSaveManager(storage).load().status, 'invalid');
  }
});

test('restoring a stage start never replays previous boss rewards or transition healing', () => {
  const storage = new MemoryStorage();
  const manager = new RunSaveManager(storage);
  const saved = checkpoint();
  manager.save(saved);
  for (let i = 0; i < 3; i++) {
    const data = manager.load().checkpoint;
    const run = new StageProgression();
    run.index = data.stats.stageIndex;
    run.bossesDefeated = data.stats.bossesDefeated;
    assert.equal(run.beginTransition(), false);
    assert.equal(data.leaderHealth.currentHp, 63);
    assert.equal(data.roster.freeSummons, 2);
    assert.equal(data.roster.minerals, saved.roster.minerals);
    const reward = run.clearBoss();
    assert.equal(reward.victory, false);
    assert.equal(run.bossesDefeated, 3);
    assert.equal(run.clearBoss(), null);
  }
});

test('malformed, unsupported, and mid-stage data is rejected without partially restoring it', () => {
  const original = checkpoint();
  const mutations = [
    data => { data.version = 2; },
    data => { delete data.roster; },
    data => { data.stats.stageIndex = 99; },
    data => { data.stats.stageIndex = -1; },
    data => { data.stats.bossesDefeated++; },
    data => { data.stats.bossDefeated = true; },
    data => { data.stats.mineralsCollected++; },
    data => { data.stats.damageMultiplier = null; },
    data => { data.stats.moveSpeedBonus = -1; },
    data => { data.leaderHealth.currentHp = 0; },
    data => { data.leaderHealth.currentHp = 10000; },
    data => { data.roster.minerals = -1; },
    data => { data.roster.freeSummons = 0.5; },
    data => { data.roster.nextId = 0; },
    data => { data.roster.units[1].id = data.roster.units[0].id; },
    data => { data.roster.units[0].archetype = '__proto__'; },
    data => { data.roster.units[0].star = 4; },
    data => { data.roster.units[0].tier = 4; },
    data => { data.roster.units.forEach(unit => { unit.deployed = false; }); },
    data => { data.unitHealth[0].currentHp = 0; },
    data => { data.unitHealth[0].currentHp = 999999; },
    data => { data.unitHealth[1].id = data.unitHealth[0].id; },
    data => { data.unitHealth.pop(); },
    data => { data.grid = []; },
    data => { data.grid[0].pop(); },
    data => { data.grid.flat().find(Boolean).id = 'wrong'; },
    data => { data.grid.flat().find(Boolean).cleared = true; },
    data => { data.grid.flat().find(Boolean).waveCount = 999; },
    data => { data.grid.flat().find(Boolean).doors.top = !data.grid.flat().find(Boolean).doors.top; },
    data => { data.grid.flat().find(room => room?.type === 'BOSS').type = 'COMBAT'; }
  ];
  for (const mutate of mutations) {
    const storage = new MemoryStorage();
    const data = structuredClone(original);
    mutate(data);
    storage.value = JSON.stringify(data);
    const manager = new RunSaveManager(storage);
    assert.equal(manager.load().status, 'invalid', mutate.toString());
    assert.equal(manager.save(data), false);
  }
  for (const value of ['{', 'null', '[]', '42']) {
    const storage = new MemoryStorage(); storage.value = value;
    assert.equal(new RunSaveManager(storage).load().status, 'invalid');
  }
});

test('blocked storage and quota failures preserve the last complete save; clear suppresses ended runs', () => {
  assert.equal(new RunSaveManager(null).load().status, 'unavailable');
  assert.equal(new RunSaveManager(null).save(checkpoint()), false);
  const storage = new MemoryStorage();
  const manager = new RunSaveManager(storage);
  manager.save(checkpoint());
  const invalid = checkpoint(3); invalid.version = 99;
  assert.equal(manager.save(invalid), false);
  assert.equal(manager.load().status, 'ready', 'invalid new data must not destroy the last complete checkpoint');
  manager.save(checkpoint());
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(manager.save(checkpoint(3)), false);
  assert.equal(manager.load().status, 'ready');
  storage.removeItem = () => { throw new Error('blocked'); };
  assert.equal(manager.clear(), false);
  assert.equal(manager.load().status, 'unavailable', 'do not resume a defeated run in this session if deletion fails');
  storage.getItem = () => { throw new Error('blocked'); };
  assert.equal(new RunSaveManager(storage).load().status, 'unavailable');
});
