import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { UNIQUE_SKILLS, UNIT_COMBAT_STYLES } = load('src/config/skillData.ts');
const { BurnComponent } = load('src/components/BurnComponent.ts');
const { EffectParticleGroup } = load('src/entities/EffectParticlePool.ts');
const { Enemy } = load('src/entities/Enemy.ts');

test('lava aura applies only in range during combat; refresh keeps the next burn tick', () => {
  const f = fixture(['LAVA_GOLEM']);
  const near = { active: true, x: 460, y: 650, burn: new BurnComponent() };
  const far = { active: true, x: 461, y: 650, burn: new BurnComponent() };
  const dead = { active: false, x: 360, y: 650, burn: new BurnComponent() };
  f.enemies.getChildren = () => [near, far, dead];
  // The aura test does not need weapon targets.
  f.squad.drones[0].weapon.tryFire = () => null;
  f.update(1000, false);
  assert.equal(near.burn.damage, 0);
  f.update(1000);
  assert.equal(near.burn.damage, 6);
  assert.equal(near.burn.sourceUnitId, 'skill_0');
  assert.equal(far.burn.damage, 0);
  assert.equal(dead.burn.damage, 0);
  assert.equal(near.burn.consumeTick(1799), false);
  f.update(2000);
  assert.equal(near.burn.consumeTick(2000), true);
  assert.equal(near.burn.consumeTick(2000), false);
});

test('burn deals attributed damage and pooled enemy reuse clears the previous life', () => {
  const f = fixture(['LAVA_GOLEM']);
  const enemy = new Enemy(f.scene, 300, 500);
  enemy.spawn('TANK', 300, 500);
  const life = enemy.lifeId;
  const hits = [];
  enemy.onBurnTick = (target, damage, source) => {
    hits.push([damage, source]); target.receiveDamage(damage, f.scene.time.now);
  };
  enemy.burn.apply(6, 1000, 'skill_0');
  enemy.update(1799, 0);
  assert.equal(enemy.health.currentHp, 175);
  f.scene.time.now = 1800; enemy.update(1800, 0);
  assert.equal(enemy.health.currentHp, 169);
  assert.deepEqual(hits, [[6, 'skill_0']]);
  enemy.deactivate(); enemy.spawn('TANK', 300, 500);
  assert.notEqual(enemy.lifeId, life);
  enemy.update(5000, 0);
  assert.equal(enemy.health.currentHp, 175);
  assert.equal(enemy.burn.damage, 0);
});

test('assassin reduces only the credited living owner cooldown', () => {
  const f = fixture(['SHADOW_ASSASSIN', 'BASIC_LASER']);
  const assassin = f.squad.drones[0];
  assassin.weapon.lastFiredAt = 1000;
  f.squad.onKill('skill_1'); f.squad.onKill('removed_unit');
  assert.equal(assassin.weapon.lastFiredAt, 1000);
  f.squad.onKill(assassin.id);
  assert.equal(assassin.weapon.lastFiredAt, 880);
  assert.equal(f.events.filter(e => e[0] === 'buff').length, 1);
  assassin.health.currentHp = 0;
  f.squad.onKill(assassin.id);
  assert.equal(assassin.weapon.lastFiredAt, 880);
});

test('druid attack aura does not stack and ends when allies leave range or sources die', () => {
  const f = fixture(['WORLD_DRUID', 'WORLD_DRUID', 'BASIC_LASER']);
  const ally = f.squad.drones[2];
  f.update(1000);
  assert.equal(ally.attackBuffMultiplier, 1.15);
  ally.x += UNIQUE_SKILLS.druid.radius + 1;
  f.update(1100);
  assert.equal(ally.attackBuffMultiplier, 1);
  ally.x = 360;
  for (const druid of f.squad.drones.slice(0, 2)) druid.health.takeDamage(druid.health.maxHp, 1100);
  f.update(1200);
  assert.equal(ally.attackBuffMultiplier, 1);
});

test('phoenix revives one fallen ally at 50% HP with invulnerability and respects cooldown', () => {
  const f = fixture(['PHOENIX_LORD', 'BASIC_LASER', 'GATLING_BOT']);
  const [, first, second] = f.squad.drones;
  f.scene.time.now = 9000;
  for (const ally of [first, second]) ally.health.takeDamage(ally.health.maxHp, 9000);
  f.update(9999);
  assert.equal(first.health.isDead, true);
  f.update(10000);
  assert.equal(first.health.currentHp, Math.round(first.health.maxHp * 0.5));
  assert.equal(first.active && first.visible, true);
  assert.equal(first.health.invulnerableUntil, 10650);
  assert.equal(second.health.isDead, true);
  f.update(10001);
  assert.equal(second.health.isDead, true);
  f.update(20000);
  assert.equal(second.health.isDead, false);
});

test('deity shields living allies in range, absorbs damage, expires and clears on room exit', () => {
  const f = fixture(['EARTH_DEITY', 'BASIC_LASER', 'GATLING_BOT']);
  const [deity, ally, far] = f.squad.drones;
  far.x += UNIQUE_SKILLS.deity.radius + 1;
  f.update(7999);
  assert.equal(ally.health.shieldHp, 0);
  f.update(8000);
  assert.equal(f.squad.health.shieldHp, 30);
  assert.equal(ally.health.shieldHp, 30);
  assert.equal(far.health.shieldHp, 0);
  const hp = ally.health.currentHp;
  ally.health.takeDamage(40, 8001);
  assert.equal(ally.health.currentHp, hp - 10);
  f.update(12000);
  assert.equal(deity.health.shieldHp, 0);
  f.update(16000);
  assert.equal(deity.health.shieldHp, 30);
  f.squad.clearCombatEffects();
  assert.equal(deity.health.shieldHp, 0);
  assert.equal(f.squad.health.shieldHp, 0);
});

test('support shows healing only when HP actually increases and never heals fallen allies', () => {
  const f = fixture(['HERBAL_PRIEST', 'BASIC_LASER', 'GATLING_BOT']);
  f.squad.health.currentHp -= 10;
  f.squad.drones[1].health.currentHp -= 10;
  f.squad.drones[2].health.takeDamage(140, 1);
  f.update(3000);
  assert.equal(f.squad.health.currentHp, 93);
  assert.equal(f.squad.drones[1].health.currentHp, 63);
  assert.equal(f.squad.drones[2].health.currentHp, 0);
  assert.equal(f.events.filter(e => e[0] === 'heal').length, 2);
});

test('combat disabled suppresses attack and skill casts even when targets remain', () => {
  const f = fixture(['BASIC_LASER', 'LAVA_GOLEM', 'EARTH_DEITY']);
  f.enemies.getChildren = () => [{ active: true, x: 360, y: 650, burn: new BurnComponent() }];
  f.update(8000, false);
  assert.equal(f.shots.length, 0);
  assert.equal(f.events.length, 0);
});

test('effect pool reuse resets line, ring, rotation, opacity, flip and depth state', () => {
  const f = fixture(['BASIC_LASER']);
  const pool = new EffectParticleGroup(f.scene);
  pool.emitLightning(0, 0, 100, 0, 0xffffff, 5);
  const particle = pool.getChildren()[0];
  particle.update(0, 120);
  particle.setFlip(true, true).setDepth(18).fadeFrom(0.1);
  particle.launchShockwave(0, 0, 85, 0xffaa00, 'skill_wave_fire', 3);
  particle.update(0, 300);
  particle.launchGlyph('skill_heal', 10, 20, 0x79d878, 32, 400);
  assert.equal(particle.depth, 35);
  assert.equal(particle.rotation, 0);
  assert.equal(particle.alpha, 1);
  assert.equal(particle.flipX || particle.flipY, false);
  particle.update(0, 200);
  assert.equal(particle.alpha, 0.5);
  assert.equal(particle.x, 10);
  assert.equal(particle.y, 20);
  assert.equal(particle.scaleX, 0.65);
});

test('all configured attacks tolerate pool exhaustion and reuse the fixed visual budget', () => {
  const f = fixture(['BASIC_LASER']);
  const pool = new EffectParticleGroup(f.scene);
  for (const unit of Object.keys(UNIT_COMBAT_STYLES)) {
    pool.emitCast(unit, 360, 600, 0);
    pool.emitExplosion(unit, 360, 600, 100);
    pool.emitHit(unit, 360, 600);
    pool.emitSkill('summon', 360, 600, unit);
  }
  assert.equal(pool.getChildren().length, 120);
  for (const p of pool.getChildren()) p.update(0, 1000);
  assert.equal(pool.countActive(), 0);
  pool.beginFrame();
  for (let i = 0; i < 100; i++) pool.emitTrail('BASIC_LASER', 360, 600, 0);
  assert.equal(pool.countActive(), 12);
  pool.emitSkill('heal', 360, 600, 'HERBAL_PRIEST');
  const heal = pool.getChildren().find(p => p.active && p.texture === 'skill_heal');
  heal.update(0, 100);
  assert.ok(heal.y < 576);
});
