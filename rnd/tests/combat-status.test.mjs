import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { createCombatHudStatus, readCombatHudStatus } = load('src/ui/combatStatus.ts');

test('revival uses ceiling seconds and clears immediately after the actual automatic revival', () => {
  const f = fixture(['BASIC_LASER']);
  const unit = f.squad.drones[0], state = createCombatHudStatus();
  unit.health.takeDamage(unit.health.maxHp, 1);
  const deadline = unit.reviveAt;
  for (const [time, seconds] of [[0, 12], [deadline - 1001, 2], [deadline - 1, 1], [deadline, 0]]) {
    readCombatHudStatus(unit, time, true, state);
    assert.equal(state.kind, 'revive'); assert.equal(state.seconds, seconds);
  }
  f.update(deadline);
  readCombatHudStatus(unit, deadline, true, state);
  assert.equal(unit.health.isDead, false);
  assert.equal(state.kind, 'none'); assert.equal(state.seconds, 0);
});

test('phoenix becomes ready at its real deadline and waits for a fallen ally without claiming an activation', () => {
  const f = fixture(['PHOENIX_LORD']);
  const unit = f.squad.drones[0], state = createCombatHudStatus();
  readCombatHudStatus(unit, 0, true, state);
  assert.equal(state.kind, 'cooldown'); assert.equal(state.seconds, 10); assert.equal(state.progress, 0);
  readCombatHudStatus(unit, 9999, true, state);
  assert.equal(state.seconds, 1);
  f.update(10000);
  readCombatHudStatus(unit, 10000, true, state);
  assert.equal(state.kind, 'ready'); assert.equal(state.progress, 1);
  assert.equal(unit.lastSkillAt, 0);
});

test('a real phoenix revival removes the ally countdown and restarts the phoenix cooldown', () => {
  const f = fixture(['PHOENIX_LORD', 'BASIC_LASER']);
  f.scene.time.now = 9000;
  const [phoenix, ally] = f.squad.drones, state = createCombatHudStatus();
  ally.health.takeDamage(ally.health.maxHp, 9000);
  f.update(10000);
  readCombatHudStatus(ally, 10000, true, state);
  assert.equal(state.kind, 'none'); assert.equal(ally.health.isDead, false);
  readCombatHudStatus(phoenix, 10000, true, state);
  assert.equal(state.kind, 'cooldown'); assert.equal(state.seconds, 10);
});

test('deity status tracks real shield absorption and expiry without changing combat state', () => {
  const f = fixture(['EARTH_DEITY']);
  const unit = f.squad.drones[0], state = createCombatHudStatus();
  f.update(8000);
  readCombatHudStatus(unit, 8000, true, state);
  assert.equal(state.seconds, 8); assert.equal(state.progress, 0);
  assert.equal(state.shieldHp, 30); assert.equal(state.shieldSeconds, 4);
  unit.health.takeDamage(12, 8001);
  readCombatHudStatus(unit, 11001, true, state);
  assert.equal(state.shieldHp, 18); assert.equal(state.shieldSeconds, 1);
  readCombatHudStatus(unit, 12000, true, state);
  assert.equal(state.shieldHp, 0); assert.equal(state.shieldSeconds, 0);
  assert.equal(unit.health.shieldHp, 18, 'presentation must not expire gameplay state on its own');
});

test('death takes priority over skill readiness and next-room revival follows actual cooldown reset', () => {
  const f = fixture(['PHOENIX_LORD']);
  const unit = f.squad.drones[0], state = createCombatHudStatus();
  f.scene.time.now = 15000;
  unit.health.takeDamage(unit.health.maxHp, 15000);
  readCombatHudStatus(unit, 15000, true, state);
  assert.equal(state.kind, 'revive'); assert.equal(state.seconds, 12); assert.equal(state.progress, 0);
  f.squad.clearCombatEffects(); f.squad.reviveFallen();
  readCombatHudStatus(unit, 15000, false, state);
  assert.equal(state.kind, 'waiting'); assert.equal(state.seconds, 10);
  assert.equal(state.shieldHp, 0);
});

test('reused HUD slots clear skill, countdown and shield data for other or passive units', () => {
  const f = fixture(['EARTH_DEITY', 'WORLD_DRUID']);
  const state = createCombatHudStatus();
  f.update(8000);
  readCombatHudStatus(f.squad.drones[0], 8000, true, state);
  assert.equal(state.skillName, '대지 방벽');
  // The druid receives a real shield but must never acquire a deity cooldown indicator.
  readCombatHudStatus(f.squad.drones[1], 8000, true, state);
  assert.equal(state.kind, 'none'); assert.equal(state.skillName, '');
  assert.equal(state.seconds, 0); assert.equal(state.progress, 0); assert.equal(state.shieldHp, 30);
  f.squad.clearCombatEffects();
  readCombatHudStatus(f.squad.drones[1], 8000, false, state);
  assert.equal(state.shieldHp, 0); assert.equal(state.shieldSeconds, 0);
});
