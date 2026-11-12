import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession, sleep } from './helpers/browser-session.mjs';

const phase = process.argv[2] ?? 'after';
const output = 'artifacts/hud-readability-20261111';
const b = await browserSession();
const { evaluate, send, click, waitFor } = b;
const report = { phase, status: 'running', screenshots: [], cases: [] };
try {
  await mkdir(output, { recursive: true });
  await click('MenuScene', 'new-run');
  await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`window.gs=smash.scene.getScene('GameScene'); gs.scene.pause(); gs.clearEncounter();
    gs.progression.stages=gs.progression.stages.map(s=>({...s,gridWidth:3,gridHeight:3}));
    gs.progression.index=1; gs.stats.stageIndex=1; gs.squad.hero.level=4; gs.squad.hero.xp=54;
    gs.squad.health.maxHp=115; gs.squad.health.currentHp=71; gs.squad.roster.minerals=320;
    gs.roomState='CLEARED'; gs.currentWave=2; gs.totalWavesInRoom=3;
    gs.gridManager.getCurrentRoom().type='COMBAT'; gs.bannerContainer.setVisible(false);
    gs.drawArenaForRoom(gs.gridManager.getCurrentRoom()); gs.refreshHud();undefined;`);
  if(phase==='after')await evaluate(`(async()=>{const {setHudText}=await import('/src/ui/battleHudText.ts');
    setHudText(gs.saveStatusText,'자동 저장 · S2',120);})()`);
  const shot = async (name, width) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width, height: Math.round(width * 1280 / 720), deviceScaleFactor: 1, mobile: true
    });
    await sleep(160);
    assert.equal(await evaluate(`(()=>{const r=smash.canvas.getBoundingClientRect();
      return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})()`),true);
    const filename = `${phase}-${name}-${width}.png`;
    const png = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/${filename}`, Buffer.from(png.data, 'base64'));
    report.screenshots.push(filename);
  };
  const check = async name => {
    const result = await evaluate(`(()=>{
      const fields=['hudHeroName','hudHeroLevel','hudHpText','hudHeroXpText','hudMineralText',
        'hudStageIndex','hudRoomText','hudRoomBadge','hudWaveText','saveStatusText'];
      const rows=fields.map(key=>{const t=gs[key];return{key,text:t.text,full:t.getData('fullText'),
        size:t.style.fontSize,depth:t.depth,bounds:t.getBounds()};});
      for(const name of ['hud-mineral-label','hero-portrait','hud-mineral-icon']){
        const o=gs.children.getByName(name);rows.push({key:name,text:name,size:o.style?.fontSize,depth:o.depth,bounds:o.getBounds()});
      }
      const panels={hero:{x:20,y:12,right:540,bottom:98},stage:{x:140,y:108,right:586,bottom:154}};
      const problems=[];
      for(const r of rows){const p=r.key.match(/hudStageIndex|hudRoomText|hudRoomBadge|hudWaveText/)?panels.stage:panels.hero;
        const a=r.bounds;if(a.x<p.x||a.y<p.y||a.right>p.right||a.bottom>p.bottom)problems.push('outside: '+r.key);
        if(r.size&&r.depth<=52)problems.push('depth: '+r.key);
      }
      for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
        const a=rows[i].bounds,c=rows[j].bounds;
        if(rows[i].text&&rows[j].text&&a.x<c.right&&a.right>c.x&&a.y<c.bottom&&a.bottom>c.y)
          problems.push('overlap: '+rows[i].key+' / '+rows[j].key);
      }
      const xp=gs.hudHeroXpText.getBounds(),bar={x:174,y:78,right:338,bottom:98};
      if(xp.x<bar.x||xp.right>bar.right||xp.y<bar.y||xp.bottom>bar.bottom)problems.push('XP value outside bar');
      return{rows,problems,hp:gs.squad.health.currentHp,maxHp:gs.squad.health.maxHp,
        xp:gs.squad.hero.xp,level:gs.squad.hero.level,minerals:gs.squad.roster.minerals};
    })()`);
    assert.deepEqual(result.problems, [], `${name}: ${JSON.stringify(result)}`);
    assert.equal(result.rows.find(r => r.key === 'hudHpText').text, `HP ${result.hp} / ${result.maxHp}`);
    assert.equal(result.rows.find(r => r.key === 'hudHeroLevel').text, `Lv.${result.level}`);
    assert.equal(result.rows.find(r => r.key === 'hudRoomText').size,'18px');
    assert.equal(result.rows.find(r => r.key === 'hudMineralText').size,'20px');
    assert.equal(await evaluate('gs.hudMineralText.getData("amount")'),result.minerals);
    report.cases.push({ name, ...result });
  };
  for (const width of [360, 390]) await shot('standard', width);
  if (phase === 'after') {
    await check('standard');
    for (const [name, code] of [
      ['large', `gs.squad.health.maxHp=100000;gs.squad.health.currentHp=99999;
        gs.squad.roster.minerals=999999;gs.squad.hero.level=19;gs.squad.hero.xp=785;`],
      ['long', `gs.progression.current.name='끝없이 이어지는 독안개 습지와 잊혀진 고대 소환사의 회랑';
        gs.progression.mutation='FIERCE';gs.roomState='LOCKED_WAVES';gs.squad.roster.minerals=123456789;
        gs.currentWave=12;gs.totalWavesInRoom=12;`],
      ['max', `gs.squad.hero.classId='KNIGHT';gs.squad.hero.level=20;gs.squad.hero.xp=0;gs.squad.health.currentHp=0;
        gs.squad.roster.minerals=0;gs.roomState='ENTERING';gs.progression.mutation='NONE';`],
      ['cleared', `gs.roomState='CLEARED';gs.progression.current.name='독안개 습지';
        gs.squad.health.currentHp=71;gs.squad.roster.minerals=320;`]
    ]) {
      await evaluate(`${code}gs.refreshHud();undefined;`);
      await check(name);
      for (const width of [360, 390]) await shot(name, width);
    }
    const updates = await evaluate(`(()=>{
      gs.squad.hero.level=4;gs.squad.hero.xp=55;gs.squad.health.currentHp=70;
      gs.squad.roster.minerals=321;gs.roomState='LOCKED_WAVES';gs.refreshHud();
      gs.enemies.spawnEnemy('SWARMER',240,340);gs.updateHudVitals();
      return{hp:gs.hudHpText.text,xp:gs.hudHeroXpText.text,level:gs.hudHeroLevel.text,
        currency:gs.hudMineralText.text,wave:gs.hudWaveText.text};})()`);
    assert.deepEqual(updates,{hp:'HP 70 / 100000',xp:'55 / 65',level:'Lv.4',currency:'321',wave:'WAVE 12/12 · 적 1기 · 전투 중'});
    report.updates = updates;
    await check('values-updated');
    await evaluate(`(async()=>{const {setHudText}=await import('/src/ui/battleHudText.ts');
      setHudText(gs.saveStatusText,'저장 실패 · 이전 기록 유지',120);
      gs.stageBanner.setStatus('독안개가 짙게 드리운 회랑에 진입하고 있습니다 · 주변의 위협을 살피고 다음 전투를 준비하세요');
    })()`);
    await check('long-help-and-save-failure');
    for(const width of [360,390])await shot('long-help',width);
    await evaluate(`gs.progression.index=4;gs.progression.stages[4].name='황혼 성채';
      gs.progression.stages[4].bossName='잊혀진 황혼의 끝없는 성채를 수호하는 고대의 왕';
      gs.squad.hero.classId='ELEMENTALIST';gs.lastHeroLevel=-1;gs.refreshHud();
      gs.enemies.spawnEnemy('BOSS_CORE',360,370);gs.updateHudVitals();undefined;`);
    const boss=await evaluate(`(()=>{const a=gs.bossHudLabel.getBounds();return{
      text:gs.bossHudLabel.text,bounds:a,visible:gs.bossHud.visible,
      fits:a.x>=76&&a.right<=644&&a.y>=102&&a.bottom<=148,
      hero:gs.hudHeroName.text};})()`);
    assert.equal(boss.visible,true);assert.equal(boss.fits,true,JSON.stringify(boss));
    assert.match(boss.text,/PHASE 1\/3/);assert.match(boss.text,/HP 100%/);
    assert.equal(boss.hero,'원소 술사');report.boss=boss;
    for(const width of [360,390])await shot('boss',width);
    await evaluate(`gs.clearEncounter();gs.progression.stages[999]={...gs.progression.current,index:999};
      gs.progression.index=999;gs.squad.roster.minerals=Number.MAX_SAFE_INTEGER;gs.refreshHud();undefined;`);
    await check('endless-safe-limits');
    assert.equal(await evaluate('gs.hudStageIndex.text'),'STAGE 1000 ∞');
    const layout = await evaluate(`({width:smash.config.width,height:smash.config.height,
      mode:smash.scale.scaleMode,arenaWidth:gs.children.getByName('provided-floor').width,
      arenaHeight:gs.children.getByName('provided-floor').height})`);
    assert.equal(layout.width,720);assert.equal(layout.height,1280);
    assert.equal(layout.arenaWidth,576);assert.equal(layout.arenaHeight,904);
    report.layout=layout;
  }
  assert.deepEqual(b.errors, []);
  report.status='passed';
  await writeFile(`${output}/${phase}-result.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({phase,status:report.status,cases:report.cases.length,screenshots:report.screenshots}));
} finally { b.close(); }
