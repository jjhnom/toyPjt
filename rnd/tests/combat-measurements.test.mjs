import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { CombatMeasurements } = load('src/systems/CombatMeasurements.ts');
const { HealthComponent } = load('src/components/HealthComponent.ts');

test('accepted damage separates real HP loss, shield absorption, overkill and single death', () => {
  const metrics = new CombatMeasurements(), health = new HealthComponent(10);
  health.damageObserver = metrics.enemyDamage; metrics.advance(2000);
  health.applyShield(5, 10000);
  assert.equal(health.takeDamage(8, 1000, 100), true);
  assert.equal(health.takeDamage(8, 1050, 100), false);
  assert.equal(health.takeDamage(20, 1200), true);
  assert.equal(health.takeDamage(20, 1300), false);
  const report = metrics.report();
  assert.deepEqual(report.enemies, { hits: 2, requested: 28, effective: 10, shield: 5, overkill: 13, deaths: 1 });
  assert.equal(report.enemyEffectiveDps, 5);
  health.reset(10); health.takeDamage(2, 1500);
  assert.equal(metrics.report().enemies.effective, 12, 'pool reset preserves observation but does not count HP restoration');
  report.enemies.effective = -1;
  assert.equal(metrics.report().enemies.effective, 12);
});

test('real support distinguishes effective healing, overheal and dead targets; revival is separate', () => {
  const { squad, update } = fixture(['HERBAL_PRIEST', 'BASIC_LASER', 'BASIC_LASER']);
  const metrics = new CombatMeasurements(); squad.setCombatMeasurements(metrics);
  squad.health.currentHp -= 1;
  squad.drones[1].health.currentHp -= 10;
  squad.drones[2].health.takeDamage(10000, 1);
  metrics.advance(3000); update(3000, false);
  const report = metrics.report();
  const leader = report.healing.find(row => row.target === 'leader');
  const units = report.healing.find(row => row.target === 'unit');
  assert.equal(leader.effective, 1); assert.equal(leader.overheal, leader.requested - 1);
  assert.equal(units.skippedDead, 1); assert.equal(units.effective, 3);
  assert.equal(report.revivals.automatic, 0);
  metrics.advance(12000); update(15000, false);
  assert.equal(metrics.report().revivals.automatic, 1);
});

test('measurement attaches to newly deployed units and detaches without altering gameplay state', () => {
  const { squad, update } = fixture(['HERBAL_PRIEST']);
  const metrics = new CombatMeasurements(); squad.setCombatMeasurements(metrics);
  squad.roster.units.push({ id: 'added_1', archetype: 'BASIC_LASER', star: 1, tier: 1, deployed: true });
  squad.syncRoster(); squad.drones[1].health.takeDamage(3);
  assert.equal(metrics.report().allies.effective, 3);
  squad.setCombatMeasurements(null);
  const before = metrics.report(); squad.drones[1].health.takeDamage(4); update(3000, false);
  assert.deepEqual(metrics.report(), before);
  assert.equal(squad.drones[1].health.currentHp, 66, 'detached support still heals normally');
});

test('reports separate combat duration, stop at the first leader death and do not share exported rows', () => {
  const metrics = new CombatMeasurements(); metrics.advance(1000, false); metrics.advance(2000);
  metrics.enemyDamage(10, 10, 0, false); metrics.leaderDamage(100, 100, 0, true);
  metrics.advance(1000); metrics.leaderDamage(50, 50, 0, true);
  metrics.recordShot(true); metrics.recordShot(false); metrics.recordContact();
  metrics.recordHealing('MOON_PRIEST', 'leader', 4, 2, false);
  const report = metrics.report();
  assert.equal(report.elapsedMs, 4000); assert.equal(report.combatMs, 3000);
  assert.equal(report.leaderDiedAtMs, 3000); assert.equal(report.enemyEffectiveDps, 10 / 3);
  assert.deepEqual(report.projectiles, { fired: 1, poolFailures: 1, contacts: 1 });
  report.healing[0].effective = 999; assert.equal(metrics.report().healing[0].effective, 2);
});
