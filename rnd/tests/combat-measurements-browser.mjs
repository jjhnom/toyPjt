import assert from 'node:assert/strict';
import { browserSession, sleep } from './helpers/browser-session.mjs';

const browser = await browserSession();
const { evaluate, waitFor, tap } = browser;
try {
  await tap(360, 910); await waitFor("smash.scene.isActive('GameScene')");
  assert.equal(await evaluate("smash.scene.getScene('GameScene').getCombatReport()"), null, 'measurement is off by default');
  await evaluate(`window.gs = smash.scene.getScene('GameScene');
    gs.startCombatMeasurement(); gs.roomState = 'LOCKED_WAVES';
    gs.currentWave = 0; gs.totalWavesInRoom = 1; gs.nextWaveTimerMs = 1000000;
    gs.clearEncounter(); gs.roomState = 'LOCKED_WAVES'; gs.totalWavesInRoom = 1; gs.nextWaveTimerMs = 1000000;
    gs.squad.health.invulnerableUntil = gs.time.now + 1000000; undefined;`);
  await sleep(180);
  assert.ok((await evaluate('gs.getCombatReport()')).elapsedMs > 0);
  const pool = await evaluate(`(() => {
    const first = gs.enemies.spawnEnemy('SWARMER', 300, 300); const life = first.lifeId;
    first.receiveDamage(3, gs.time.now); first.deactivate();
    const reused = gs.enemies.spawnEnemy('SWARMER', 300, 300);
    reused.receiveDamage(4, gs.time.now); reused.deactivate();
    return { freshLife: reused.lifeId !== life, damage: gs.getCombatReport().enemies.effective };
  })()`);
  assert.deepEqual(pool, { freshLife: true, damage: 7 });
  await evaluate("gs.openSquadModal('계측 일시정지 검사'); undefined;");
  await waitFor("smash.scene.isActive('SquadScene') && smash.scene.isPaused('GameScene')");
  const frozen = await evaluate('JSON.stringify(gs.getCombatReport())');
  await sleep(250); assert.equal(await evaluate('JSON.stringify(gs.getCombatReport())'), frozen);
  await tap(360, 1210); await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("smash.events.emit('hidden'); undefined;");
  const background = await evaluate('JSON.stringify(gs.getCombatReport())');
  await sleep(200); assert.equal(await evaluate('JSON.stringify(gs.getCombatReport())'), background);
  await evaluate("smash.events.emit('visible'); undefined;");
  await waitFor("smash.scene.isActive('GameScene')");
  await sleep(100);
  await evaluate('gs.stopCombatMeasurement(); undefined;');
  const stopped = await evaluate('JSON.stringify(gs.getCombatReport())');
  await evaluate('gs.getCombatReport().enemies.effective = -1; undefined;');
  await sleep(150); assert.equal(await evaluate('JSON.stringify(gs.getCombatReport())'), stopped);
  await evaluate(`gs.scene.restart(); undefined;`);
  await waitFor("smash.scene.isActive('GameScene')");
  await sleep(150);
  assert.equal(await evaluate("smash.scene.getScene('GameScene').getCombatReport()"), null);
  assert.deepEqual(browser.errors, []);
  console.log('PASS: opt-in measurement, enemy pool reuse, management/background pause, stop, restart');
} finally { browser.close(); }
