import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../scripts/lib/load-typescript.mjs';

const { RunSaveManager, isRunCheckpoint, RUN_SAVE_KEY, RUN_SAVE_BACKUP_KEY } = load('src/systems/RunSaveManager.ts');
const { SquadRoster } = load('src/systems/SquadRoster.ts');
const { RoomGridManager } = load('src/systems/RoomGridManager.ts');
const { STAGES } = load('src/config/stageData.ts');
const { UNIT_TYPES } = load('src/config/unitData.ts');
const { seededRandom } = load('src/systems/EconomySimulation.ts');
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
function checkpoint(index = 0, phase = 'room-cleared', type = 'COMBAT') {
  const roster = new SquadRoster(500);
  const manager = new RoomGridManager(STAGES[index], undefined, seededRandom(42 + index));
  const start = manager.getCurrentRoom();
  const target = phase === 'stage-start' ? start : manager.grid.flat().find(room => room?.type === type);
  const queue = [start], previous = new Map([[start.id, null]]);
  for (const room of queue) for (const [dx, dy] of [[0,-1], [0,1], [-1,0], [1,0]]) {
    const next = manager.grid[room.gridY + dy]?.[room.gridX + dx];
    if (next && !previous.has(next.id)) { previous.set(next.id, room); queue.push(next); }
  }
  let cleared = 0;
  if (phase !== 'stage-start') for (let room = target; room; room = previous.get(room.id)) {
    room.visited = room.cleared = true; cleared++;
    if (room.type === 'EVENT') room.circleChoice = 'SAFE';
  }
  return { version: 2, runId: 'test_run_42', phase, currentRoomId: target.id, savedAt: 1000,
    stats: { stageIndex: index, bossesDefeated: index + Number(phase === 'stage-cleared'),
      roomsCleared: index * 10 + cleared, enemiesDefeated: 50, mineralsCollected: 500,
      bossDefeated: false, damageMultiplier: 1, attackSpeedMultiplier: 1, moveSpeedBonus: 0 },
    roster: roster.snapshot(), leaderHealth: { currentHp: 43, maxHp: 100 },
    unitHealth: roster.units.map(unit => ({ id: unit.id, currentHp: UNIT_TYPES[unit.archetype].maxHp / 2,
      reviveRemainingMs: 0, healRemainingMs: 1500, skillRemainingMs: 0 })), grid: manager.grid };
}

test('v2 round-trips every stage and resume phase, preserving positions and entrance-relative depths', () => {
  for (let index = 0; index < 5; index++) for (const phase of ['stage-start', 'room-cleared', 'stage-cleared']) {
    if (index === 4 && phase === 'stage-cleared') continue;
    const data = checkpoint(index, phase, phase === 'stage-cleared' ? 'BOSS' : 'RECOVERY');
    const storage = new MemoryStorage(), manager = new RunSaveManager(storage);
    assert.equal(isRunCheckpoint(data), true, `${index} ${phase}`);
    assert.equal(manager.save(data), true);
    assert.deepEqual(manager.load().checkpoint, data);
    const grid = new RoomGridManager(STAGES[index], data.grid);
    const before = grid.grid.flat().filter(Boolean).map(room => grid.getDepth(room));
    grid.restoreCurrentRoom(data.currentRoomId);
    assert.equal(grid.getCurrentRoom().id, data.currentRoomId);
    assert.deepEqual(grid.grid.flat().filter(Boolean).map(room => grid.getDepth(room)), before);
  }
});

test('fallen allies and fractional remaining timers survive; live allies cannot carry revival deadlines', () => {
  const data = checkpoint(); data.unitHealth[0].currentHp = 0; data.unitHealth[0].reviveRemainingMs = 8423.5;
  const storage = new MemoryStorage(), manager = new RunSaveManager(storage);
  assert.equal(manager.save(data), true);
  assert.deepEqual(manager.load().checkpoint.unitHealth[0], data.unitHealth[0]);
  for (const [field, value] of [['reviveRemainingMs', -1], ['reviveRemainingMs', 12001],
    ['healRemainingMs', 3001], ['skillRemainingMs', 1]]) {
    const bad = structuredClone(data); bad.unitHealth[0][field] = value;
    assert.equal(isRunCheckpoint(bad), false, field);
  }
  data.unitHealth[0].currentHp = 1; assert.equal(isRunCheckpoint(data), false);
});

test('cleared circles retain all three decisions and never accept a pending challenge as a safe checkpoint', () => {
  for (const choice of ['SAFE', 'CHALLENGE', 'SKIP']) {
    const data = checkpoint(2, 'room-cleared', 'EVENT');
    const room = data.grid.flat().find(room => room?.id === data.currentRoomId);
    room.circleChoice = choice;
    assert.equal(isRunCheckpoint(data), true);
    room.cleared = false; assert.equal(isRunCheckpoint(data), false);
  }
});

test('unknown phases, wrong boss counts, disconnected visits and uncleared current rooms are rejected', () => {
  for (const mutate of [
    d => { d.phase = 'combat'; }, d => { d.currentRoomId = 'missing'; }, d => { d.runId = ''; },
    d => { d.stats.bossesDefeated++; }, d => { d.stats.roomsCleared = 0; },
    d => { d.grid.flat().find(r => r?.id === d.currentRoomId).cleared = false; },
    d => { d.grid.flat().find(r => r?.type === 'EVENT').circleChoice = 'SAFE'; },
    d => { const room = d.grid.flat().find(r => r?.type === 'BOSS'); room.cleared = room.visited = true; }
  ]) {
    const data = checkpoint(2); mutate(data); assert.equal(isRunCheckpoint(data), false, mutate.toString());
  }
  assert.equal(isRunCheckpoint(checkpoint(4, 'stage-cleared', 'BOSS')), false);
  const disconnected = checkpoint(2, 'stage-cleared', 'BOSS');
  const stage = STAGES[2];
  for (const room of disconnected.grid.flat().filter(Boolean)) {
    if (room.type === 'BOSS' || (room.gridX === Math.floor(stage.gridWidth / 2) && room.gridY === Math.floor(stage.gridHeight / 2))) continue;
    room.visited = room.cleared = false; delete room.circleChoice;
  }
  assert.equal(isRunCheckpoint(disconnected), false, 'visited boss separated by uncleared rooms');
});

test('corrupt primary falls back with notice, two corrupt snapshots fail safely, and reads never rewrite storage', () => {
  const storage = new MemoryStorage(), manager = new RunSaveManager(storage);
  const first = checkpoint(), second = checkpoint(1);
  assert.equal(manager.save(first), true); assert.equal(manager.save(second), true);
  storage.setItem(RUN_SAVE_KEY, '{broken');
  const before = [...storage.values];
  assert.deepEqual(manager.load(), { status: 'ready', checkpoint: first, recovered: true });
  assert.deepEqual([...storage.values], before);
  storage.setItem(RUN_SAVE_BACKUP_KEY, '{}'); assert.equal(manager.load().status, 'invalid');
});

test('quota failure preserves a complete primary; backup quota failure still allows a new primary', () => {
  const storage = new MemoryStorage(), manager = new RunSaveManager(storage);
  const first = checkpoint(), second = checkpoint(1);
  manager.save(first);
  const set = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(manager.save(second), false); assert.deepEqual(manager.load().checkpoint, first);
  storage.setItem = (key, value) => { if (key === RUN_SAVE_BACKUP_KEY) throw new Error('backup quota'); set(key, value); };
  assert.equal(manager.save(second), true); assert.deepEqual(manager.load().checkpoint, second);
});

test('end/new run deletes both snapshots; partial deletion cannot resurrect a previous run after reload', () => {
  const storage = new MemoryStorage(), manager = new RunSaveManager(storage);
  manager.save(checkpoint()); manager.save(checkpoint(1));
  assert.equal(manager.clear(), true); assert.equal(manager.load().status, 'empty'); assert.equal(storage.values.size, 0);
  manager.save(checkpoint()); manager.save(checkpoint(1));
  storage.removeItem = () => { throw new Error('blocked'); };
  assert.equal(manager.clear(), false); assert.equal(manager.load().status, 'unavailable');
  assert.equal(new RunSaveManager(storage).load().status, 'empty', 'tombstone blocks the leftover backup');
  assert.equal(manager.save(checkpoint(2)), false, 'a new run cannot reuse an undeletable old backup');
});
