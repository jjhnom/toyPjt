import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, load } from './helpers/skill-fixture.mjs';

const { HeroProgression, isHeroSnapshot } = load('src/systems/HeroProgression.ts');
const { resolveUpgradeEffects } = load('src/systems/UpgradeEffects.ts');
const { emptyUpgrades } = load('src/config/upgradeData.ts');
const { CombatMeasurements } = load('src/systems/CombatMeasurements.ts');
const { getStageScaling, getStageDefinition, isMutationAvailable, stageClearReward } = load('src/config/stageData.ts');
const { StageProgression } = load('src/systems/StageProgression.ts');
const { RoomGridManager } = load('src/systems/RoomGridManager.ts');
const { SquadRoster } = load('src/systems/SquadRoster.ts');
const { RunSaveManager, isRunCheckpoint } = load('src/systems/RunSaveManager.ts');
const { killReward, roomClearReward } = load('src/systems/EncounterRules.ts');

test('talent thresholds, repeat choices, stale expected counts, cap and snapshot copies', () => {
  const h = new HeroProgression();
  assert.equal(h.chooseTalent('COMMAND', 0), false);
  h.level = 3; assert.equal(h.pendingTalents(), 1);
  assert.equal(h.chooseTalent('COMMAND', 0), true);
  h.level = 6; assert.equal(h.chooseTalent('FOCUS', 0), false);
  assert.equal(h.chooseTalent('constructor', 1), false);
  assert.equal(h.chooseTalent('COMMAND', 1), true);
  h.level = 20;
  while (h.pendingTalents()) assert.equal(h.chooseTalent('FOCUS', h.talents.length), true);
  assert.equal(h.talents.length, 6); assert.equal(h.chooseTalent('VITALITY', 6), false);
  const snapshot = h.snapshot(); snapshot.talents[0] = 'VITALITY';
  assert.equal(h.talents[0], 'COMMAND');
  const old = h.snapshot(); delete old.talents; delete old.activeRemainingMs;
  const restored = new HeroProgression(); assert.equal(restored.restore(old), true);
  assert.equal(restored.pendingTalents(), 6);
});

test('talent HP applies once with wounds and hydration; damage sources stay additive and separate', () => {
  const f = fixture(['BASIC_LASER']); f.squad.recordHeroKill('unit', 87);
  f.squad.health.currentHp = 23;
  assert.equal(f.squad.hero.chooseTalent('VITALITY', 0), true);
  f.squad.syncRoster(); const max = f.squad.health.maxHp;
  assert.equal(max, 120); assert.equal(f.squad.health.currentHp, 23);
  for (let i = 0; i < 5; i++) f.squad.syncRoster();
  assert.equal(f.squad.health.maxHp, max); assert.equal(f.squad.health.currentHp, 23);
  const restored = fixture(['BASIC_LASER']); restored.squad.restoreHero(f.squad.heroSnapshot()); restored.squad.syncRoster();
  restored.squad.health.reset(max); restored.squad.health.currentHp = 23; restored.squad.syncRoster();
  assert.equal(restored.squad.health.maxHp, max); assert.equal(restored.squad.health.currentHp, 23);
  const upgrades = emptyUpgrades(); upgrades.squadAttack = 2;
  const effects = resolveUpgradeEffects(upgrades, ['COMMAND_BANNER'], ['COMMAND', 'COMMAND', 'VITALITY']);
  assert.ok(Math.abs(effects.squadAttack - 1.26) < 1e-12);
  assert.equal(effects.heroAttack, 0); assert.equal(effects.heroHealth, 10);
});

test('command heal caps living targets, never revives, spends cooldown only on effective healing and records its source', () => {
  const f = fixture(['BASIC_LASER', 'HERBAL_PRIEST']); const s = f.squad;
  const metrics = new CombatMeasurements(); s.setCombatMeasurements(metrics);
  assert.equal(s.castCommandHeal(true), false); assert.equal(s.activeRemaining(), 0);
  s.health.currentHp = 95; s.drones[0].health.currentHp = 5; s.drones[1].health.currentHp = 0;
  assert.equal(s.castCommandHeal(false), false); assert.equal(s.activeRemaining(), 0);
  assert.equal(s.castCommandHeal(true), true);
  assert.equal(s.health.currentHp, 100); assert.equal(s.drones[0].health.currentHp, 15);
  assert.equal(s.drones[1].health.currentHp, 0); assert.equal(s.activeRemaining(), 18000);
  assert.equal(s.castCommandHeal(true), false);
  const rows = metrics.report().healing.filter(r => r.source === 'COMMAND_HEAL');
  assert.equal(rows.reduce((total, row) => total + row.effective, 0), 15);
  s.restoreHero({ ...s.heroSnapshot(), activeRemainingMs: 0 }); s.health.currentHp = 0;
  assert.equal(s.castCommandHeal(true), false); assert.equal(s.drones[0].health.currentHp, 15);
});

test('active cooldown uses only combat delta and survives hydration; focus clamps without resetting ready skills', () => {
  const f = fixture([]), s = f.squad;
  s.health.currentHp = 1; s.castCommandHeal(true);
  s.update(900000, 1500, 0, 0, f.enemies, 1, 1, 0, true); assert.equal(s.activeRemaining(), 16500);
  s.update(999999, 50000, 0, 0, f.enemies, 1, 1, 0, false); assert.equal(s.activeRemaining(), 16500);
  const copy = fixture([]); copy.squad.restoreHero(s.heroSnapshot());
  assert.equal(copy.squad.activeRemaining(), 16500);
  s.hero.level = 20;
  while (s.hero.pendingTalents()) s.hero.chooseTalent('FOCUS', s.hero.talents.length);
  s.syncRoster(); assert.equal(s.activeDuration(), 12000); assert.equal(s.activeRemaining(), 12000);
  s.update(1000000, 12000, 0, 0, f.enemies, 1, 1, 0, true);
  assert.equal(s.activeRemaining(), 0); assert.equal(s.castCommandHeal(true), true);
  for (const change of [d => d.talents = ['BAD'], d => d.talents = Array(7).fill('FOCUS'),
    d => d.talents = null, d => d.activeRemainingMs = 12001, d => d.activeRemainingMs = NaN]) {
    const bad = s.heroSnapshot(); change(bad); assert.equal(isHeroSnapshot(bad), false, change.toString());
  }
});

test('mutations alter only their risk and rewards, preserve workload, respect final caps and disable meaningless choices', () => {
  const base = getStageScaling(5);
  for (const [id, field, factor] of [['ARMORED','enemyHpMult',1.15], ['FIERCE','enemyDamageMult',1.1], ['SWIFT','enemySpeedMult',1.05]]) {
    const s = getStageScaling(5, id); assert.ok(Math.abs(s[field] - base[field] * factor) < 1e-12);
    assert.equal(s.rewardMult, base.rewardMult * 1.1); assert.equal(s.maxActiveEnemies, base.maxActiveEnemies);
    assert.equal(s.waveCountBonus, base.waveCountBonus); assert.equal(s.spawnIntervalMult, base.spawnIntervalMult);
    assert.ok(roomClearReward('COMBAT', 5, id) > roomClearReward('COMBAT', 5));
    assert.ok(stageClearReward(getStageDefinition(5), id) > stageClearReward(getStageDefinition(5)));
    assert.ok(killReward('BOSS_CORE', 5, undefined, id) >= killReward('BOSS_CORE', 5));
    for (let index = 5; index <= 999; index++) {
      const result = getStageScaling(index, id); assert.ok(Object.values(result).every(Number.isFinite));
      assert.ok(result.enemyHpMult <= 1000 && result.bossHpMult <= 1000 && result.enemyDamageMult <= 20 &&
        result.bossDamageMult <= 20 && result.enemySpeedMult <= 1.45 && result.rewardMult <= 22);
    }
    assert.equal(isMutationAvailable(999, id), false);
  }
  assert.equal(isMutationAvailable(4, 'ARMORED'), false); assert.equal(isMutationAvailable(5, '__proto__'), false);
  assert.throws(() => getStageScaling(4, 'FIERCE'), RangeError);
});

test('next mutation commits once, transfers only on transition, and never stacks into later stages', () => {
  const p = new StageProgression(); p.index = 4; p.clearBoss();
  assert.equal(p.selectEndless('continue', 'BAD'), false); assert.equal(p.endlessChoice, 'pending');
  assert.equal(p.selectEndless('continue', 'ARMORED'), true); assert.equal(p.mutation, 'NONE');
  assert.equal(p.nextMutation, 'ARMORED'); assert.equal(p.selectEndless('continue', 'FIERCE'), false);
  p.beginTransition(); p.finishTransition(); assert.equal(p.mutation, 'ARMORED'); assert.equal(p.nextMutation, 'NONE');
  assert.equal(p.clearBoss().minerals, stageClearReward(getStageDefinition(5), 'ARMORED'));
  p.selectEndless('continue'); p.beginTransition(); p.finishTransition(); assert.equal(p.mutation, 'NONE');
});

function checkpoint(index = 5) {
  const roster = new SquadRoster(30), grid = new RoomGridManager(getStageDefinition(index)), hero = new HeroProgression();
  return { version: 2, runId: 'abilities_fixture', phase: 'stage-start', currentRoomId: grid.getCurrentRoom().id,
    mode: index >= 5 ? 'endless' : 'campaign', endlessChoice: 'none', mutation: 'NONE', nextMutation: 'NONE',
    savedAt: 0, stats: { stageIndex: index, bossesDefeated: index, roomsCleared: index, enemiesDefeated: 0,
      mineralsCollected: 30, bossDefeated: index >= 5, damageMultiplier: 1, attackSpeedMultiplier: 1, moveSpeedBonus: 0 },
    roster: roster.snapshot(), hero: hero.snapshot(), leaderHealth: { currentHp: 23, maxHp: 100 },
    unitHealth: roster.units.map(u => ({ id: u.id, currentHp: 30, reviveRemainingMs: 0, healRemainingMs: 0, skillRemainingMs: 0 })), grid: grid.grid };
}
test('save validation rejects invalid mutation context and talent state, preserves last good data and accepts legacy defaults', () => {
  const data = checkpoint(); data.mutation = 'FIERCE'; data.hero.level = 3; data.hero.talents = ['VITALITY'];
  data.hero.activeRemainingMs = 17000;
  const values = new Map(), manager = new RunSaveManager({ getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) });
  assert.equal(isRunCheckpoint(data), true); assert.equal(manager.save(data), true);
  for (const change of [d => d.nextMutation = 'FIERCE', d => d.mutation = null, d => d.mutation = 'BAD',
    d => d.hero.talents.push('COMMAND'), d => d.hero.activeRemainingMs = 18001]) {
    const bad = structuredClone(data); change(bad); assert.equal(manager.save(bad), false, change.toString());
    assert.deepEqual(manager.load().checkpoint, data);
  }
  const old = checkpoint(0); delete old.mutation; delete old.nextMutation; delete old.hero.talents; delete old.hero.activeRemainingMs;
  assert.equal(isRunCheckpoint(old), true); assert.equal(manager.save(old), true);
  old.mutation = 'ARMORED'; assert.equal(isRunCheckpoint(old), false);
});
