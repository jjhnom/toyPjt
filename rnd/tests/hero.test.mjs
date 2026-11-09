import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { HeroProgression, isHeroSnapshot } = load('src/systems/HeroProgression.ts');
const { HERO, heroBaseStats, heroWeaponSpec, heroXpToNext, heroXpForEnemy } = load('src/config/heroData.ts');
const { Bullet } = load('src/entities/Bullet.ts');
const { Enemy } = load('src/entities/Enemy.ts');
const { DRONE_SPECS } = load('src/config/gameData.ts');
const { SquadRoster } = load('src/systems/SquadRoster.ts');
const { RunSaveManager, isRunCheckpoint } = load('src/systems/RunSaveManager.ts');
const { RoomGridManager } = load('src/systems/RoomGridManager.ts');
const { STAGES } = load('src/config/stageData.ts');

test('XP handles exact thresholds, several levels per kill, cap and invalid input without loops or partial mutation', () => {
  const hero = new HeroProgression();
  assert.equal(hero.gainExperience(39), 0);
  assert.equal(hero.gainExperience(1), 1);
  assert.equal(hero.level, 2); assert.equal(hero.xp, 0);
  const required = heroXpToNext(2) + heroXpToNext(3);
  assert.equal(hero.recordKill('unit', required + 3), 2);
  assert.equal(hero.level, 4); assert.equal(hero.xp, 3);
  assert.deepEqual(hero.snapshot().kills, { hero: 0, unit: 1, environment: 0 });
  for (const invalid of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const before = hero.snapshot();
    assert.equal(hero.recordKill('hero', invalid), 0); assert.deepEqual(hero.snapshot(), before);
  }
  const before = hero.snapshot(); hero.recordKill('invalid', 1); assert.deepEqual(hero.snapshot(), before);
  assert.equal(hero.gainExperience(Number.MAX_SAFE_INTEGER), HERO.maxLevel - 4);
  assert.equal(hero.level, HERO.maxLevel); assert.equal(hero.xp, 0);
  assert.equal(hero.recordKill('hero', 999), 0);
  assert.equal(hero.snapshot().kills.hero, 1); assert.equal(hero.xp, 0);
});

test('snapshots copy counters and validate class, level, XP, cooldown and complete source counters', () => {
  const hero = new HeroProgression(); hero.recordKill('environment', 13);
  const data = hero.snapshot(750.25), other = new HeroProgression();
  assert.equal(other.restore(data), true); assert.deepEqual(other.snapshot(750.25), data);
  data.kills.environment = 99; assert.equal(other.snapshot().kills.environment, 1);
  const valid = other.snapshot();
  for (const change of [d => d.classId = 'UNKNOWN_CLASS', d => d.level = 0, d => d.level = 21,
    d => d.level = 1.5, d => d.xp = heroXpToNext(d.level), d => d.xp = -1,
    d => d.attackRemainingMs = 1100.01, d => d.attackRemainingMs = -1,
    d => d.kills.hero = Infinity, d => delete d.kills.unit,
    d => { d.level = 20; d.xp = 1; }]) {
    const bad = structuredClone(valid); change(bad);
    assert.equal(isHeroSnapshot(bad), false, change.toString());
    assert.equal(other.restore(bad), false); assert.deepEqual(other.snapshot(), valid);
  }
});

test('level HP additions preserve wounds, legacy bonuses and resources, and never heal a dead leader', () => {
  const { squad } = fixture(['BASIC_LASER']);
  squad.health.reset(120); squad.health.currentHp = 23;
  const roster = squad.roster.snapshot();
  assert.equal(squad.recordHeroKill('unit', 40 + 47), 2);
  assert.equal(squad.health.maxHp, 130); assert.equal(squad.health.currentHp, 23);
  assert.deepEqual(squad.roster.snapshot(), roster);
  squad.health.takeDamage(10000);
  squad.recordHeroKill('environment', 55);
  assert.equal(squad.health.maxHp, 135); assert.equal(squad.health.currentHp, 0);
  assert.equal(squad.health.isDead, true);
});

test('automatic hero attack aims while moving, uses only its stats, and respects range, death and noncombat', () => {
  const f = fixture([]), { squad } = f;
  const far = { active: true, x: 700, y: 650, lifeId: 1 };
  const target = { active: true, x: 430, y: 650, lifeId: 2 };
  f.enemies.getChildren = () => [far, target];
  const update = (delta, combat = true) => squad.update(100000, delta, 1, 0, f.enemies, 9, 9, 0, combat);
  update(16);
  assert.equal(f.heroShots.length, 1); assert.equal(f.heroShots[0].target, target);
  assert.equal(f.heroShots[0].sourceKind, 'hero'); assert.equal(f.heroShots[0].damage, 8);
  assert.ok(squad.leader.body.velocity.x > 0, 'auto aim must not cancel player movement');
  update(1099); assert.equal(f.heroShots.length, 1, 'squad attack-speed bonuses must not shorten hero cooldown');
  update(1); assert.equal(f.heroShots.length, 2);
  update(1100, false); assert.equal(f.heroShots.length, 2);
  target.active = false; update(1100); assert.equal(f.heroShots.length, 2, 'far target outside range');
  target.active = true; squad.health.takeDamage(10000); update(1100);
  assert.equal(f.heroShots.length, 2, 'dead leader cannot fire');
});

test('hero cooldown saves remaining active time, survives world-clock jumps and restores without an instant extra shot', () => {
  const f = fixture([]), target = { active: true, x: 400, y: 650, lifeId: 1 };
  f.enemies.getChildren = () => [target];
  f.update(1); assert.equal(f.heroShots.length, 1);
  f.squad.update(251, 250, 0, 0, f.enemies, 1, 1, 0, true);
  const saved = f.squad.heroSnapshot(); assert.equal(saved.attackRemainingMs, 850);
  f.update(100000); assert.equal(f.heroShots.length, 1, 'paused wall time is not active time');
  const restored = fixture([]); restored.enemies.getChildren = () => [target];
  restored.squad.restoreHero(saved);
  restored.squad.update(200000, 849, 0, 0, restored.enemies, 1, 1, 0, true);
  assert.equal(restored.heroShots.length, 0);
  restored.squad.update(200001, 1, 0, 0, restored.enemies, 1, 1, 0, true);
  assert.equal(restored.heroShots.length, 1);
});

test('pooled hero bolts clear source state and cannot inherit Spark homing, while real Spark shots still home', () => {
  const f = fixture([]), bullet = new Bullet(f.scene, 360, 650);
  const target = { active: true, x: 360, y: 850, lifeId: 1 };
  const config = { ...heroWeaponSpec(1), x: 360, y: 650, angle: 0, speed: 640,
    sourceKind: 'hero', sourceUnitId: 'hero', unitTypeId: 'SPARK_SPIRIT', target };
  bullet.fire(config); bullet.update(100, 100);
  assert.equal(bullet.rotation, 0); assert.equal(bullet.sourceKind, 'hero');
  bullet.deactivate(); assert.equal(bullet.sourceKind, 'environment'); assert.equal(bullet.sourceUnitId, undefined);
  bullet.fire({ ...config, sourceKind: 'unit', sourceUnitId: 'spark' }); bullet.update(200, 100);
  assert.ok(Math.abs(bullet.rotation - 0.3) < 1e-9);
  bullet.deactivate(); bullet.fire({ ...config, sourceKind: undefined, sourceUnitId: undefined });
  assert.equal(bullet.sourceKind, 'environment');
  const enemy = new Enemy(f.scene, 400, 650);
  enemy.spawn('SWARMER', 400, 650); const life = enemy.lifeId; enemy.rewardsClaimed = true;
  enemy.spawn('SWARMER', 400, 650);
  assert.equal(enemy.rewardsClaimed, false); assert.notEqual(enemy.lifeId, life);
});

test('hero nominal DPS stays below the 30% squad guideline in starter and six-basic-unit reference formations', () => {
  const unitDps = DRONE_SPECS.BASIC_LASER.damage / DRONE_SPECS.BASIC_LASER.fireRateMs * 1000;
  for (const [level, count] of [[1, 2], [20, 6]]) {
    const heroDps = heroBaseStats(level).damage / HERO.fireRateMs * 1000;
    assert.ok(heroDps / (unitDps * count) <= 0.3);
  }
  assert.ok(heroXpForEnemy('SWARMER') > 0);
});

test('legacy v1/v2 health and currency remain untouched; new hero saves round-trip and reject invalid source totals', () => {
  const f = fixture([]), grid = new RoomGridManager(STAGES[0]), roster = new SquadRoster(500);
  const data = { version: 2, phase: 'stage-start', runId: 'hero_test', currentRoomId: grid.getCurrentRoom().id,
    savedAt: 1000, grid: grid.grid, roster: roster.snapshot(),
    leaderHealth: { currentHp: 23, maxHp: 120 },
    unitHealth: roster.units.map(d => ({ id: d.id, currentHp: 35, reviveRemainingMs: 0, healRemainingMs: 0, skillRemainingMs: 0 })),
    stats: { stageIndex: 0, bossesDefeated: 0, roomsCleared: 0, enemiesDefeated: 5, mineralsCollected: 500,
      bossDefeated: false, damageMultiplier: 1, attackSpeedMultiplier: 1, moveSpeedBonus: 0 } };
  const storage = { values: new Map(), getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); }, removeItem(key) { this.values.delete(key); } };
  const manager = new RunSaveManager(storage);
  for (const version of [1, 2]) {
    const old = structuredClone(data); old.version = version;
    assert.equal(manager.save(old), true); const raw = [...storage.values];
    const loaded = manager.load().checkpoint;
    assert.equal(loaded.hero, undefined); assert.deepEqual(loaded.leaderHealth, data.leaderHealth);
    assert.deepEqual(loaded.roster, data.roster); assert.deepEqual([...storage.values], raw);
  }
  f.squad.recordHeroKill('unit', 87); data.hero = f.squad.heroSnapshot();
  assert.equal(manager.save(data), true); assert.deepEqual(manager.load().checkpoint, data);
  for (const mutate of [d => d.hero.kills.hero = 6, d => d.hero.level = 21,
    d => d.hero.xp = Infinity, d => d.hero.attackRemainingMs = -1, d => d.hero = null]) {
    const bad = structuredClone(data); mutate(bad); assert.equal(isRunCheckpoint(bad), false);
  }
});
