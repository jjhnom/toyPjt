import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchChrome, sleep } from './lib/chrome-cdp.mjs';

const destination = new URL('../artifacts/unit-art-validation/', import.meta.url);
await mkdir(destination, { recursive: true });
const chrome = await launchChrome();
try {
  const { send, evaluate, waitFor } = chrome;
  const resize = async (width, height) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
  };
  const capture = async name => {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(new URL(`${name}.png`, destination), Buffer.from(result.data, 'base64'));
  };
  const tap = async (x, y) => {
    const b = await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + x * b.width / 720, y: b.y + y * b.height / 1280 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(200);
  };
  await resize(720, 1280);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await send('Page.navigate', { url: process.env.SMASH_TEST_URL ?? 'http://127.0.0.1:5174/' });
  await waitFor("document.querySelector('canvas') !== null");
  await evaluate(`(async () => {
    const entry = document.querySelector('script[type="module"][src*="/src/main.ts"]');
    window.smash = (await import(entry.src)).game;
    window.unitDefs = Object.values((await import('/src/config/unitData.ts')).UNIT_TYPES);
  })()`);
  await waitFor("smash.scene.isActive('MenuScene')");
  await sleep(500);
  const coverage = await evaluate(`(() => {
    const hash = pixels => { let result = 2166136261; for (const p of pixels) result = Math.imul(result ^ p, 16777619); return result >>> 0; };
    return unitDefs.map(unit => {
      const battle = smash.textures.get('unit_' + unit.id), portrait = smash.textures.get('portrait_' + unit.id);
      const pixels = battle.getContext().getImageData(0, 0, 48, 48).data;
      const face = portrait.getContext().getImageData(0, 0, 96, 96).data;
      let ink = 0; for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 127) ink++;
      return { id: unit.id, name: unit.name, frames: battle.frameTotal - 1, width: battle.get(0).width,
        height: battle.get(0).height, portrait: [portrait.get().width, portrait.get().height],
        hash: hash(pixels), portraitHash: hash(face), ink };
    });
  })()`);
  assert.equal(coverage.length, 22);
  assert.equal(new Set(coverage.map(unit => unit.hash)).size, 22, 'Each unit needs distinct battle art');
  assert.equal(new Set(coverage.map(unit => unit.portraitHash)).size, 22, 'Each unit needs distinct portrait art');
  for (const unit of coverage) {
    assert.equal(unit.frames, 4, unit.id); assert.equal(unit.width, 48); assert.equal(unit.height, 48);
    assert.deepEqual(unit.portrait, [96, 96]); assert.ok(unit.ink > 200 && unit.ink < 1900, unit.id);
  }
  await tap(360, 910);
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs = smash.scene.getScene('GameScene'); gs.squad.health.maxHp = 100000; gs.squad.health.heal(100000);");
  await sleep(1500); await capture('battle');
  await evaluate(`gs.enemies.getChildren().forEach(enemy => enemy.deactivate()); gs.pendingSpawns.length = 0; gs.hazards.clear();
    gs.roomState = 'LOCKED_WAVES'; gs.currentWave = gs.totalWavesInRoom = 1;`);
  await waitFor("smash.scene.isActive('SquadScene')");
  await capture('summon-page1');
  const portraits = await evaluate("smash.scene.getScene('SquadScene').children.list.filter(o => o.texture?.key.startsWith('portrait_')).map(o => o.texture.key)");
  assert.equal(portraits.length, 4);
  await tap(570, 1030); await capture('summon-page2');
  await resize(360, 640); await capture('summon-page2-mobile360');
  await resize(720, 1280); await tap(360, 228); await capture('recipes');
  // Contact sheet of real runtime textures; a QA scene, not an added game screen.
  await evaluate(`(() => {
    const scene = smash.scene.getScene('SquadScene'); scene.children.removeAll(true); scene.input.enabled = false;
    scene.add.rectangle(360, 640, 720, 1280, 0x101720);
    scene.add.text(360, 22, '소환 유닛 22종 · 실제 런타임 아트', { fontFamily: 'Malgun Gothic', fontSize: '26px', fontStyle: 'bold', color: '#efd49b' }).setOrigin(.5, 0);
    scene.add.text(360, 60, '왼쪽: 목록 초상화 96px / 오른쪽: 전투 스프라이트 48px', { fontFamily: 'Malgun Gothic', fontSize: '15px', color: '#b6c0c8' }).setOrigin(.5, 0);
    unitDefs.forEach((unit, i) => {
      const x = 8 + i % 4 * 178, y = 92 + Math.floor(i / 4) * 190;
      scene.add.rectangle(x + 86, y + 88, 170, 178, 0x1b2633).setStrokeStyle(1, 0xb79a62);
      scene.add.text(x + 86, y + 8, 'T' + unit.tier + ' ' + unit.name, { fontFamily: 'Malgun Gothic', fontSize: '15px', color: '#f5f1dd', fontStyle: 'bold' }).setOrigin(.5, 0);
      scene.add.image(x + 59, y + 86, 'portrait_' + unit.id).setDisplaySize(100, 100);
      scene.add.sprite(x + 139, y + 94, 'unit_' + unit.id, 0).play('walk_' + unit.id);
      scene.add.text(x + 86, y + 151, unit.id, { fontFamily: 'monospace', fontSize: '11px', color: '#b6c0c8' }).setOrigin(.5, 0);
    });
  })()`);
  await sleep(300); await capture('all-units');
  assert.deepEqual(chrome.errors, []);
  const result = { status: 'passed', distinctBattleArt: 22, distinctPortraitArt: 22, exceptions: 0, coverage };
  await writeFile(new URL('result.json', destination), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { chrome.close(); }
