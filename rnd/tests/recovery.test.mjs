import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { UNIT_TYPES } = load('src/config/unitData.ts');
const { RevivalPause } = load('src/systems/RevivalPause.ts');
const { CombatMeasurements } = load('src/systems/CombatMeasurements.ts');

test('room transitions never leave a living unit worse off than a fallen copy, across all types and stars', () => {
  for (const type of Object.values(UNIT_TYPES)) for (const star of [1, 2, 3]) {
    const max = Math.round(type.maxHp * (1 + 0.5 * (star - 1))), floor = Math.round(max * 0.5);
    for (const before of [0, 1, floor - 1, floor, floor + 1, max]) {
      const { squad } = fixture([type.id]);
      const drone = squad.drones[0]; drone.star = star; drone.health.reset(max);
      if (before === 0) drone.health.takeDamage(max); else drone.health.currentHp = before;
      squad.health.currentHp = 17;
      const roster = squad.roster.snapshot();
      squad.recoverForRoomEntry();
      assert.equal(drone.health.currentHp, Math.max(before, floor), `${type.id} star ${star} HP ${before}`);
      assert.equal(drone.health.isDead, false); assert.equal(drone.active, true);
      assert.equal(squad.health.currentHp, 17, 'the leader does not receive room-entry healing');
      assert.deepEqual(squad.roster.snapshot(), roster);
      for (let revisit = 0; revisit < 5; revisit++) squad.recoverForRoomEntry();
      assert.equal(drone.health.currentHp, Math.max(before, floor), 'walking back and forth cannot heal above the floor');
    }
  }
});

test('spring healing caps at each maximum, reports actual gain, skips fallen units and preserves roster resources', () => {
  const { squad } = fixture(['BASIC_LASER', 'STONE_GUARD', 'BASIC_LASER']);
  squad.health.currentHp = 90;
  squad.drones[0].health.currentHp = 35;
  squad.drones[1].health.currentHp = 179;
  squad.drones[2].health.takeDamage(10000);
  const roster = squad.roster.snapshot();
  assert.deepEqual(squad.recoverAtSpring(), { leaderHealed: 10, unitHealed: 33, unitsRecovered: 2 });
  assert.equal(squad.health.currentHp, 100);
  assert.equal(squad.drones[0].health.currentHp, 67);
  assert.equal(squad.drones[1].health.currentHp, 180);
  assert.equal(squad.drones[2].health.currentHp, 0);
  assert.deepEqual(squad.roster.snapshot(), roster);
  squad.health.currentHp = 0; assert.equal(squad.recoverAtSpring().leaderHealed, 0);
});

test('entry followed by a spring gives equal treatment to fallen and one-HP allies without counting as support healing', () => {
  const { squad } = fixture(['BASIC_LASER', 'BASIC_LASER']);
  const metrics = new CombatMeasurements(); squad.setCombatMeasurements(metrics);
  squad.drones[0].health.takeDamage(10000);
  squad.drones[1].health.currentHp = 1;
  squad.recoverForRoomEntry(); squad.recoverAtSpring();
  assert.deepEqual(squad.drones.map(drone => drone.health.currentHp), [67, 67]);
  assert.equal(metrics.report().revivals.room, 1);
  assert.deepEqual(metrics.report().healing, [], 'environmental recovery is separate from ordinary support');
});

test('revival pause preserves remaining time across nested pauses, long clock jumps and saved snapshots', () => {
  const pause = new RevivalPause(), unit = { id: 'unit_1', reviveAt: 13000, health: { isDead: true } };
  pause.capture([unit], 1000);
  pause.queueResume(); pause.capture([unit], 90000); // Re-paused before the first resumed update.
  assert.equal(pause.remainingMs(unit, 90000), 12000);
  pause.queueResume(); pause.applyResume([unit], 100000);
  assert.equal(unit.reviveAt, 112000);
  pause.applyResume([unit], 110000); assert.equal(unit.reviveAt, 112000, 'apply once only');
  assert.equal(pause.remainingMs(unit, 110000), 2000);
});

test('paused revival ignores removed IDs and room/phoenix revival, and a new room clears old snapshots', () => {
  const pause = new RevivalPause();
  const unit = { id: 'unit_1', reviveAt: 12000, health: { isDead: true } };
  pause.capture([unit], 3000); unit.health.isDead = false; unit.reviveAt = 0;
  assert.equal(pause.remainingMs(unit, 100000), 0);
  pause.queueResume(); pause.applyResume([unit], 100000); assert.equal(unit.reviveAt, 0);
  unit.health.isDead = true; unit.reviveAt = 112000; pause.capture([unit], 101000);
  const newer = { id: 'unit_2', reviveAt: 120000, health: { isDead: true } };
  pause.queueResume(); pause.applyResume([newer], 110000); assert.equal(newer.reviveAt, 120000);
  pause.capture([newer], 110000); pause.clear(); pause.queueResume(); pause.applyResume([newer], 150000);
  assert.equal(newer.reviveAt, 120000, 'new rooms/runs cannot reuse the old pause');
});

test('fractional revival deadlines stay within checkpoint duration bounds across pause restoration', () => {
  const pause = new RevivalPause();
  for (const time of [6384.4, 13905.4, 65536.1, 100000.7]) {
    const unit = { id: 'fractional', reviveAt: time + 12000, health: { isDead: true } };
    assert.ok(pause.remainingMs(unit, time) <= 12000);
    pause.capture([unit], time); pause.queueResume(); pause.applyResume([unit], time + 60000);
    assert.ok(pause.remainingMs(unit, time + 60000) <= 12000);
  }
});
