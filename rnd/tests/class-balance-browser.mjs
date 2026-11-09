import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession } from './helpers/browser-session.mjs';

const browser = await browserSession();
try {
  for (let i=0; i<3; i++) {
    await browser.evaluate("window.previousDocumentMarker=true;undefined;");
    await browser.send('Page.reload',{ignoreCache:true});
    await browser.attach();
    assert.equal(await browser.evaluate('window.previousDocumentMarker===undefined'),true,'attach must use the new document');
    assert.equal(await browser.evaluate("document.querySelectorAll('canvas').length"),1);
  }
  await browser.tap(360, 910);
  await browser.waitFor("smash.scene.isActive('GameScene')");
  console.log('Class fixtures: game ready');
  const result = await browser.evaluate(`(() => {
    const gs = smash.scene.getScene('GameScene');
    gs.scene.pause();
    const Squad = gs.squad.constructor;
    const classes = ['APPRENTICE_SUMMONER', 'KNIGHT', 'ELEMENTALIST'];
    const layouts = {
      single: [[480,650]],
      cluster: [[480,650],[480,675],[505,650],[505,675]],
      spread: [[480,650],[360,530],[240,650],[360,770]],
      range200: [[560,650]]
    };
    const reset = (classId, rank, allies = false) => {
      gs.stopCombatMeasurement(); gs.clearEncounter();
      for (const drone of gs.squad.drones) drone.destroy();
      gs.squad.movement.destroy(); gs.squad.health.destroy(); gs.squad.leader.destroy();
      gs.squad = new Squad(gs,360,650,cfg => {
        const fired = gs.bullets.fireBullet(cfg);
        gs.combatMeasurements?.recordShot(!!fired);
      },() => {},() => {},undefined,{classId,permanent:{vitality:rank,power:rank}});
      if (!allies) { gs.squad.roster.units = []; gs.squad.syncRoster(); }
      gs.squad.leader.body.moves = false;
      gs.roomState = 'LOCKED_WAVES'; gs.progression.state = 'PLAYING';
      gs.time.now = 100000; gs.startCombatMeasurement();
    };
    const damage = [], recovery = [];
    for (const classId of classes) for (const rank of [0,5]) {
      for (const [layout, points] of Object.entries(layouts)) {
        reset(classId,rank);
        const targets = points.map(([x,y]) => {
          const enemy = gs.enemies.spawnEnemy('SWARMER',x,y,2500);
          enemy.body.moves = false; enemy.body.immovable = true;
          return enemy;
        });
        const initialHp = targets.reduce((sum,e) => sum + e.health.currentHp,0);
        gs.physics.world.resume(); gs.physics.world.fixedStep = false;
        const delta = 1000/60;
        for (let frame=1; frame<=1200; frame++) {
          const time = 100000 + frame*delta; gs.time.now = time;
          gs.combatMeasurements.advance(delta); gs.particles.beginFrame();
          gs.squad.update(time,delta,0,0,gs.enemies,1,1,0,true);
          for (const bullet of gs.bullets.getChildren()) if (bullet.active) bullet.update(time,delta);
          gs.physics.world.update(time,delta); gs.physics.world.postUpdate();
        }
        gs.physics.world.pause();
        damage.push({classId,rank,layout,targets:targets.length,maxHp:gs.squad.health.maxHp,
          hpLost:initialHp-targets.reduce((sum,e) => sum + e.health.currentHp,0),
          hero:gs.squad.heroSnapshot(),...gs.getCombatReport()});
      }
      reset(classId,rank,true);
      gs.squad.health.currentHp = 1;
      for (const ally of gs.squad.drones) ally.health.currentHp = 1;
      const cast = gs.squad.castCommandHeal(true);
      const leaderHeal = gs.squad.health.currentHp-1;
      const allyHeal = gs.squad.drones.reduce((sum,d) => sum+d.health.currentHp-1,0);
      const cooldown = gs.squad.activeRemaining();
      const repeated = gs.squad.castCommandHeal(true);
      gs.squad.restoreHero({...gs.squad.heroSnapshot(),activeRemainingMs:0});
      gs.squad.health.currentHp = gs.squad.health.maxHp;
      for (const ally of gs.squad.drones) ally.health.currentHp = ally.health.maxHp;
      gs.squad.movement.applySlow(0.65,1000,gs.time.now);
      const pureCleanse = gs.squad.castCommandHeal(true);
      recovery.push({classId,rank,cast,leaderHeal,allyHeal,cooldown,repeated,pureCleanse,
        slowFactor:gs.squad.movement.slowFactor});
    }
    gs.stopCombatMeasurement();
    return {damage,recovery};
  })()`);
  for (const row of result.damage) {
    assert.equal(row.enemies.effective,row.hpLost,'measurement reconciles with actual target HP');
    assert.equal(row.enemies.requested,row.enemies.effective+row.enemies.shield+row.enemies.overkill);
    assert.equal(row.projectiles.poolFailures,0);
    assert.equal(row.hero.level,1,'targets must remain alive so leveling cannot contaminate comparisons');
    assert.equal(row.enemies.deaths,0);
    if (row.classId==='KNIGHT' && row.layout==='range200') {
      assert.equal(row.projectiles.fired,0); assert.equal(row.hpLost,0);
    } else {
      assert.ok(row.projectiles.fired>0); assert.ok(row.hpLost>0);
    }
    const single=result.damage.find(r=>r.classId===row.classId && r.rank===row.rank && r.layout==='single');
    if (row.layout==='cluster') {
      if (row.classId==='ELEMENTALIST') assert.ok(row.hpLost>single.hpLost*2,'actual AoE must hit neighboring targets');
      else assert.equal(row.hpLost,single.hpLost,'single-target classes gain no free splash damage');
    }
  }
  for (const row of result.recovery) {
    assert.equal(row.cast,true); assert.equal(row.repeated,false); assert.equal(row.cooldown,18000);
    assert.equal(row.leaderHeal,row.classId==='KNIGHT'?25:row.classId==='ELEMENTALIST'?6:10);
    assert.equal(row.allyHeal,row.classId==='KNIGHT'?0:row.classId==='ELEMENTALIST'?12:20);
    assert.equal(row.pureCleanse,row.classId==='ELEMENTALIST');
    assert.equal(row.slowFactor,row.classId==='ELEMENTALIST'?1:0.65);
  }
  assert.deepEqual(browser.errors,[]);
  result.kind='controlled-class-comparison';
  result.reloads=3;
  result.browser=(await browser.send('Browser.getVersion')).product;
  result.limitations=[
    '20 simulated seconds at 60Hz, stationary level-one hero and high-HP targets, no enemy attacks or allied weapons.',
    'Identical coordinates, ranks 0 and 5 in both permanent upgrades; range200 intentionally excludes the knight.',
    'Recovery is one valid cast on a wounded leader and two wounded starting archers, then an isolated full-HP cleanse.',
    'Not human gameplay, full-run survival/economy, boss difficulty, Android performance, or grounds for automatic balance changes.'
  ];
  await mkdir('artifacts/class-balance',{recursive:true});
  await writeFile('artifacts/class-balance/report.json',JSON.stringify(result,null,2)+'\n');
  console.table(result.damage.map(r=>({class:r.classId,rank:r.rank,layout:r.layout,
    dps:Number(r.enemyEffectiveDps.toFixed(2)),shots:r.projectiles.fired,hp:r.maxHp})));
  console.log('PASS: actual class projectile collisions, AoE, range, HP and active recovery/cleanse; artifacts/class-balance/report.json');
} finally { browser.close(); }
