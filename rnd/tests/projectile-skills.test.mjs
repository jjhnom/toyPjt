import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { PoisonComponent } = load('src/components/PoisonComponent.ts');
const { Bullet } = load('src/entities/Bullet.ts');
const { Enemy } = load('src/entities/Enemy.ts');
const { UNIT_PROJECTILE_SKILLS } = load('src/config/skillData.ts');
const config = (unitTypeId, extra = {}) => ({ unitTypeId, sourceUnitId: 'skill_0', x: 360, y: 600,
  angle: 0, speed: 900, damage: 25, color: 0xffffff, aoeRadius: 0, slowFactor: 1,
  slowDurationMs: 0, pierceCount: 2, chainCount: 0, ...extra });

test('poison has exactly three ticks including the expiry boundary, with no instant damage', () => {
  const poison = new PoisonComponent();
  poison.apply(3, 0, 3000, 1000, 'owner');
  assert.equal(poison.consumeTick(999), false);
  for (const time of [1000, 2000, 3000]) {
    assert.equal(poison.consumeTick(time), true);
    assert.equal(poison.damage, 3);
    assert.equal(poison.sourceUnitId, 'owner');
  }
  assert.equal(poison.consumeTick(3001), false);
  assert.equal(poison.damage, 0);
});

test('poison refresh preserves cadence, does not stack and cannot extend a stronger owner with weak hits', () => {
  const poison = new PoisonComponent();
  poison.apply(3, 0, 3000, 1000, 'weak');
  poison.apply(5, 500, 3000, 1000, 'strong');
  poison.apply(3, 900, 3000, 1000, 'weak');
  assert.equal(poison.until, 3500);
  assert.equal(poison.damage, 5);
  assert.equal(poison.sourceUnitId, 'strong');
  assert.equal(poison.consumeTick(1000), true);
  poison.apply(5, 1100, 3000, 1000, 'strong');
  assert.equal(poison.until, 4100);
  assert.equal(poison.consumeTick(1999), false);
  assert.equal(poison.consumeTick(2000), true);
});

test('poison and burn coexist, credit kills once and are cleared when the enemy is recycled', () => {
  const f = fixture(['THORN_GUARD']);
  const enemy = new Enemy(f.scene, 400, 600);
  enemy.spawn('TANK', 400, 600);
  let kills = 0, owner;
  enemy.onPoisonTick = (target, damage, source) => {
    if (target.receiveDamage(damage, f.scene.time.now)) { kills++; owner = source; }
  };
  enemy.onBurnTick = (target, damage) => target.receiveDamage(damage, f.scene.time.now);
  enemy.health.currentHp = 5;
  enemy.burn.apply(1, 0, 'fire');
  enemy.poison.apply(4, 0, 3000, 1000, 'thorn');
  f.scene.time.now = 1000; enemy.update(1000, 0);
  assert.equal(kills, 1); assert.equal(owner, 'thorn');
  enemy.update(2000, 0);
  assert.equal(kills, 1);
  enemy.spawn('TANK', 400, 600);
  assert.equal(enemy.poison.damage, 0); assert.equal(enemy.burn.damage, 0);
  enemy.update(4000, 0);
  assert.equal(enemy.health.currentHp, 175);
});

test('homing turns toward the original target at 3 rad/s and preserves projectile speed', () => {
  const f = fixture(['SPARK_SPIRIT']);
  const bullet = new Bullet(f.scene, 360, 600);
  const target = { active: true, x: 360, y: 900, lifeId: 10 };
  bullet.fire(config('SPARK_SPIRIT', { target }));
  bullet.update(100, 100);
  assert.ok(Math.abs(bullet.rotation - 0.3) < 1e-10);
  assert.ok(Math.abs(Math.hypot(bullet.body.velocity.x, bullet.body.velocity.y) - 900) < 1e-10);
  target.x = 100; target.y = 600;
  const prior = bullet.rotation;
  bullet.update(200, 100);
  assert.ok(Math.abs(bullet.rotation - prior) <= 0.30000001);
});

test('homing stops on death or recycled life and pooled normal shots clear tracking state', () => {
  const f = fixture(['SPARK_SPIRIT']);
  const bullet = new Bullet(f.scene, 360, 600);
  const target = { active: true, x: 360, y: 900, lifeId: 10 };
  bullet.fire(config('SPARK_SPIRIT', { target }));
  bullet.update(100, 100);
  target.lifeId = 11;
  bullet.update(200, 100);
  assert.equal(bullet.rotation, 0.3);
  bullet.fire(config('SPARK_SPIRIT', { target }));
  target.active = false;
  bullet.update(300, 100);
  assert.equal(bullet.rotation, 0);
  bullet.deactivate(); target.active = true;
  bullet.fire(config('BASIC_LASER', { target }));
  bullet.update(400, 100);
  assert.equal(bullet.rotation, 0);
  assert.equal(bullet.isFragment, false);
  assert.equal(bullet.splitPending, false);
});

test('weapon passes the actual selected life to homing shots', () => {
  const f = fixture(['SPARK_SPIRIT']);
  const target = { active: true, x: 400, y: 650, lifeId: 5 };
  f.enemies.getChildren = () => [target];
  f.update(1000);
  assert.equal(f.shots.length, 1);
  assert.equal(f.shots[0].target, target);
  assert.equal(f.shots[0].unitTypeId, 'SPARK_SPIRIT');
});

test('split children suppress recursion and inherited effects, ignore the initial victim and expire at 400ms', () => {
  const f = fixture(['STORM_ARCHER']);
  const bullet = new Bullet(f.scene, 360, 600);
  bullet.fire(config('STORM_ARCHER'));
  assert.equal(bullet.splitPending, true);
  bullet.fire(config('STORM_ARCHER', { isFragment: true, ignoredEnemyLifeId: 42,
    aoeRadius: 100, chainCount: 9, slowFactor: 0.3, slowDurationMs: 2000, pierceCount: 9 }));
  assert.equal(bullet.splitPending, false);
  assert.equal(bullet.remainingPierces, 0); assert.equal(bullet.remainingChains, 0);
  assert.equal(bullet.aoeRadius, 0); assert.equal(bullet.slowFactor, 1);
  assert.equal(bullet.hitEnemyLives.has(42), true);
  bullet.update(399, 399); assert.equal(bullet.active, true);
  bullet.update(400, 1); assert.equal(bullet.active, false);
  bullet.fire(config('STORM_ARCHER'));
  assert.equal(bullet.hitEnemyLives.size, 0);
  assert.equal(bullet.isFragment, false);
  assert.equal(bullet.splitPending, true);
});

test('new projectile mechanics opt in only the three chosen units', () => {
  assert.deepEqual(Object.keys(UNIT_PROJECTILE_SKILLS).sort(), ['SPARK_SPIRIT', 'STORM_ARCHER', 'THORN_GUARD']);
});
