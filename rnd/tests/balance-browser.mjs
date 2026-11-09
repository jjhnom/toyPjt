import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession } from './helpers/browser-session.mjs';
import { load } from '../scripts/lib/load-typescript.mjs';

const { recipeCostReport } = load('src/systems/EconomySimulation.ts');
const browser = await browserSession();
const { evaluate, waitFor, tap } = browser;
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
  const result = await evaluate(`(async () => {
    const gs = smash.scene.getScene('GameScene'); gs.scene.pause();
    // Reuse the URL loaded by the game: Vite may append an HMR timestamp.
    const unitModuleUrl = performance.getEntriesByType('resource')
      .find(entry => new URL(entry.name).pathname === '/src/config/unitData.ts')?.name;
    if (!unitModuleUrl) throw new Error('Loaded unit configuration URL is missing');
    const { UNIT_TYPES } = await import(unitModuleUrl);
    const originalDeath = gs.handlePlayerDeath;
    // Keep death/HP rules; suppress only scene switching inside controlled fixtures.
    gs.handlePlayerDeath = () => { gs.runEnded = true; };
    const healerIds = ['HERBAL_PRIEST', 'MOON_PRIEST', 'WORLD_DRUID'];
    const originalHeals = healerIds.map(id => UNIT_TYPES[id].healAmount);
    const baselineHeals = [2, 4, 6]; // Historical pre-stage-three comparison, not a test oracle for live settings.
    const support = [], damage = [];
    const reset = types => {
      gs.stopCombatMeasurement(); gs.clearEncounter();
      gs.runEnded = false; gs.rewardModalOpen = false; gs.backgroundPaused = false;
      gs.roomState = 'LOCKED_WAVES'; gs.progression.state = 'PLAYING';
      for (const drone of gs.squad.drones) drone.destroy();
      gs.squad.drones = [];
      gs.squad.roster.units = types.map((archetype, i) => ({ id: 'unit_' + (i + 1), archetype,
        tier: UNIT_TYPES[archetype].tier, star: 1, deployed: true }));
      gs.squad.health.reset(100); gs.squad.syncRoster();
      gs.time.now = 100000;
      gs.squad.setPositionImmediate(360, 870);
      for (const drone of gs.squad.drones) drone.lastHealAt = drone.lastSkillAt = gs.time.now;
      gs.startCombatMeasurement();
    };
    try {
      for (const profile of ['steady', 'gentle', 'burst']) {
        for (const healer of [null, ...healerIds]) for (const variant of healer ? ['baseline', 'plus-one'] : ['none']) {
          if (healer) UNIT_TYPES[healer].healAmount = baselineHeals[healerIds.indexOf(healer)] + Number(variant === 'plus-one');
          reset(['STONE_GUARD', 'BASIC_LASER', 'BASIC_LASER', 'BASIC_LASER', 'BASIC_LASER', healer ?? 'BASIC_LASER']);
          const interval = profile === 'burst' ? 6000 : 1500;
          const hit = profile === 'burst' ? 24 : profile === 'gentle' ? 1 : 6;
          let elapsed = 0;
          for (elapsed = 100; elapsed <= 60000; elapsed += 100) {
            gs.time.now = 100000 + elapsed; gs.combatMeasurements.advance(100);
            if (elapsed % interval === 0) gs.squad.receiveContactDamage(hit, gs.time.now);
            if (gs.squad.health.isDead) break;
            if (elapsed % 3000 === 0) for (let i = 0; i < gs.squad.drones.length; i++) {
              gs.squad.drones[i].health.takeDamage(i === 1 ? 18 : i === 0 ? 20 : 3, gs.time.now);
            }
            gs.squad.update(gs.time.now, 100, 0, 0, gs.enemies, 1, 1, 0, true);
          }
          support.push({ profile, healer, variant, healPerTarget: healer ? UNIT_TYPES[healer].healAmount : 0,
            leaderHp: gs.squad.health.currentHp, cappedAtMs: 60000, ...gs.getCombatReport() });
          if (healer) UNIT_TYPES[healer].healAmount = originalHeals[healerIds.indexOf(healer)];
        }
      }
      const layouts = { single: [[360,430]], line: [[360,500],[360,440],[360,380],[360,320]],
        cluster: [[360,470],[325,420],[395,420],[360,380]],
        dense9: [[318,472],[360,472],[402,472],[318,430],[360,430],[402,430],[318,388],[360,388],[402,388]],
        spread: [[180,450],[540,450],[270,300],[450,300]] };
      for (const unit of ['PIERCE_BEAM','BLACKHOLE_MISSILE','STUN_BOT']) for (const [layout, points] of Object.entries(layouts)) {
        reset([unit]);
        for (const [x,y] of points) {
          const enemy = gs.enemies.spawnEnemy('SWARMER', x, y, 2500);
          enemy.body.moves = false; enemy.body.immovable = true;
        }
        gs.physics.world.resume();
        gs.physics.world.fixedStep = false;
        const frameMs = 1000 / 60;
        for (let frame = 1; frame <= 1200; frame++) {
          const time = 100000 + frame * frameMs; gs.time.now = time;
          gs.combatMeasurements.advance(frameMs); gs.particles.beginFrame();
          // Fixed shooter/targets isolate projectile collision, pierce, AoE and slowdown.
          const drone = gs.squad.drones[0]; drone.setPosition(360,650);
          gs.squad.update(time, frameMs, 0, 0, gs.enemies, 1, 1, 0, true);
          for (const bullet of gs.bullets.getChildren()) if (bullet.active) bullet.update(time, frameMs);
          gs.physics.world.update(time, frameMs); gs.physics.world.postUpdate();
        }
        damage.push({ unit, layout, targets: points.length, ...gs.getCombatReport() });
      }
      // Exported counters are independent and stop/reset are checked on actual scene hooks.
      const previous = gs.getCombatReport(); gs.stopCombatMeasurement();
      gs.squad.drones[0].health.takeDamage(1, 0);
      const stopped = gs.getCombatReport();
      const stopWorks = JSON.stringify(previous) === JSON.stringify(stopped);
      gs.startCombatMeasurement();
      const resetWorks = gs.getCombatReport().enemies.effective === 0;
      gs.stopCombatMeasurement();
      return { kind: 'controlled-Phaser-benchmarks', support, damage, stopWorks, resetWorks,
        liveHealAmounts: Object.fromEntries(healerIds.map((id, i) => [id, originalHeals[i]])) };
    } finally {
      healerIds.forEach((id, i) => { UNIT_TYPES[id].healAmount = originalHeals[i]; });
      gs.handlePlayerDeath = originalDeath;
    }
  })()`);
  await mkdir('artifacts/balance', { recursive: true });
  await writeFile('artifacts/balance/last-run.json', JSON.stringify(result, null, 2) + '\n');
  assert.equal(result.stopWorks, true); assert.equal(result.resetWorks, true);
  for (const row of result.support) for (const heal of row.healing) {
    assert.equal(heal.requested, heal.effective + heal.overheal);
    assert.equal(heal.requested, heal.attempts * row.healPerTarget, 'fixture must change the actual game configuration instance');
    assert.ok(heal.effective >= 0);
  }
  for (const row of result.damage) {
    assert.ok(row.enemies.effective > 0, `${row.unit} ${row.layout}: real physics must produce hits`);
    assert.equal(row.enemies.requested, row.enemies.effective + row.enemies.shield + row.enemies.overkill);
    assert.ok(row.projectiles.fired > 0 && row.projectiles.contacts > 0);
  }
  assert.deepEqual(browser.errors, []);
  result.recipeCosts = [0, 2].map(stageIndex => ({ stageIndex, units: recipeCostReport(stageIndex) }));
  result.limitations = ['Controlled fixtures, not human gameplay, full AI survival, or an equal-budget comparison.',
    'Damage: fixed shooter and immovable high-HP targets, 20 simulated seconds at 60Hz, no enemy attacks.',
    'Support: sixth slot replaced, deterministic leader/unit incoming damage for at most 60 simulated seconds.',
    'Baseline uses pre-stage-three 2/4/6. Plus-one is an isolated candidate, restored after measurement.',
    'Live settings are included separately. No production settings are changed by this script.',
    'No frame-rate or Android performance claim. Damage attribution is aggregate per fixture.'];
  await mkdir('artifacts/balance', { recursive: true });
  await writeFile('artifacts/balance/report.json', JSON.stringify(result, null, 2) + '\n');
  console.table(result.support.map(row => ({ profile: row.profile, healer: row.healer ?? 'NONE', variant: row.variant,
    survivalMs: row.leaderDiedAtMs ?? row.cappedAtMs, leaderHp: row.leaderHp,
    healed: row.healing.reduce((sum, h) => sum + h.effective, 0),
    overheal: row.healing.reduce((sum, h) => sum + h.overheal, 0), deaths: row.allies.deaths, revives: row.revivals.automatic })));
  console.table(result.damage.map(row => ({ unit: row.unit, layout: row.layout, targets: row.targets,
    dps: Math.round(row.enemyEffectiveDps * 10) / 10, shots: row.projectiles.fired, contacts: row.projectiles.contacts })));
  console.log('PASS: healing reconciliation, actual projectile damage, measurement stop/reset; artifacts/balance/report.json');
} finally { browser.close(); }
