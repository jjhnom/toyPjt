import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

// Actual Phaser scenes and native touch targets. Fixtures control combat; no mockup HTML is loaded.
const browser=await browserSession(),{send,evaluate,click,waitFor,errors}=browser;
const output='artifacts/pixel-fantasy-implementation';
const report={scope:'actual Phaser UI / controlled fixtures',screenshots:[],checks:[]};
const capture=async name=>{const result=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/${name}.png`,Buffer.from(result.data,'base64'));report.screenshots.push(`${name}.png`);};
const size=async width=>{await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(200);};
try{
  await mkdir(output,{recursive:true});
  await capture('title-720');await size(360);await capture('title-360');
  assert.ok(await evaluate("smash.scene.getScene('MenuScene').children.getByName('title-crest')!==null"));
  await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();gs.roomState='LOCKED_WAVES';
    gs.squad.roster.minerals=200;for(const id of ['STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT'])gs.squad.roster.summon(id);
    gs.squad.syncRoster();gs.stats.mineralsCollected=gs.squad.roster.minerals;
    const boss=gs.enemies.spawnEnemy('BOSS_CORE',360,370);boss.health.currentHp=Math.round(boss.health.maxHp*.62);
    gs.squad.drones[0].health.currentHp=0;gs.squad.drones[0].reviveAt=gs.time.now+8000;gs.refreshHud();
    gs.bannerContainer.setVisible(false);gs.physics.world.pause();
    window.pixelOriginalUpdate=gs.sys.sceneUpdate;gs.sys.sceneUpdate=function(){this.updateHudVitals();};
    gs.scene.resume();undefined;`);
  assert.equal(await evaluate('gs.hudUnitPortraits.filter(p=>p.visible).length'),6);
  assert.equal(await evaluate('gs.bossHud.visible'),true);
  assert.equal(await evaluate("gs.bossHudLabel.text.includes('HP 62%')"),true,'Boss HP label reads the controlled live enemy');
  assert.equal(await evaluate("gs.hudTeamCount.text==='생존 5/6'"),true);
  for(const width of [720,360,320]){
    await size(width);await capture(`combat-${width}`);
    const layout=await evaluate(`(()=>{const slot=gs.hudUnitPortraits.map(p=>p.getBounds()),c=gs.children.getByName('squad-status-open');
      const trigger=c.getByName('hit'),rect=trigger.getBounds(),canvas=smash.canvas.getBoundingClientRect(),s=canvas.width/720;
      return{inDock:slot.every(b=>b.top>=1100&&b.bottom<=1180),separate:slot[5].right<rect.left,touchWidth:rect.width*s,touchHeight:rect.height*s,inside:rect.right<=720&&rect.bottom<=1180};})()`);
    assert.equal(layout.inDock,true);assert.equal(layout.separate,true);assert.equal(layout.inside,true);
    assert.ok(layout.touchWidth>=44&&layout.touchHeight>=44,JSON.stringify(layout));
  }
  await click('GameScene','squad-status-open');
  assert.equal(await evaluate('gs.hudStatusDetail.visible'),true);
  assert.ok(await evaluate("gs.hudStatusRows[0].state.text.includes('자동 부활')"));
  await capture('squad-detail-320');await click('GameScene','squad-status-close');
  assert.equal(await evaluate('gs.hudStatusDetail.visible'),false);
  assert.equal(await evaluate('gs.joystick.dirX===0&&gs.joystick.dirY===0'),true,'Status control must not start movement');
  await evaluate(`gs.sys.sceneUpdate=window.pixelOriginalUpdate;gs.scene.start('GameScene');undefined;`);await sleep(300);await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`gs.scene.pause();gs.clearEncounter();gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().cleared=true;gs.stats.roomsCleared=1;
    gs.squad.roster.minerals=55;gs.stats.mineralsCollected=55;gs.openSquadModal('정비 UI 거래 검사');undefined;`);
  await waitFor("smash.scene.isActive('SquadScene')");await size(360);
  await capture('summon-360');
  await click('SquadScene','summon-BASIC_LASER');await click('SquadScene','summon-GATLING_BOT');
  assert.equal(await evaluate('gs.squad.roster.minerals'),0);
  await click('SquadScene','squad-tab-combine');await capture('recipe-360');
  const recipeLayout=await evaluate(`(async()=>{
    const {COMBINATION_RECIPES}=await import('/src/config/squadData.ts');
    const ss=smash.scene.getScene('SquadScene'),problems=[];
    for(let page=0;page<COMBINATION_RECIPES.length;page++){
      ss.page=page;ss.render();
      const lines=ss.children.list.filter(o=>o.name?.startsWith('recipe-')&&o.name.includes('-ingredient-'));
      for(let i=0;i<lines.length;i++){
        const rect=lines[i].getBounds(),limit=i+1<lines.length?lines[i+1].getBounds().top:698;
        if(rect.bottom>limit||rect.right>684)problems.push({page,text:lines[i].text,bottom:rect.bottom,limit,right:rect.right});
      }
    }
    ss.page=0;ss.render();return{count:COMBINATION_RECIPES.length,problems};
  })()`);
  assert.deepEqual(recipeLayout.problems,[],'All fixed, conditional and star recipes must fit their card');
  report.recipeLayout=recipeLayout;
  await click('SquadScene','combine-gatling');
  assert.equal(await evaluate("gs.squad.roster.units.filter(u=>u.archetype==='GATLING_BOT').length"),2);
  await click('SquadScene','squad-next');await click('SquadScene','squad-next');
  await click('SquadScene','combine-cryo');
  assert.equal(await evaluate("gs.squad.roster.units.filter(u=>u.archetype==='STUN_BOT').length"),1);
  await click('SquadScene','squad-tab-roster');await capture('roster-360');
  const first=await evaluate('gs.squad.roster.units[0].id');await click('SquadScene',`roster-deploy-${first}`);
  assert.equal(await evaluate('gs.squad.roster.units.filter(u=>u.deployed).length'),1);
  await evaluate("gs.squad.recordHeroKill('unit',87);gs.stats.enemiesDefeated++;undefined;");await click('SquadScene','talent-open');await capture('talent-360');
  await click('SquadScene','talent-select-COMMAND');assert.equal(await evaluate('gs.squad.hero.talents.length'),1);
  await click('SquadScene','quick-craft-open');await capture('quick-craft-360');
  await click('SquadScene','facility-open');await capture('facilities-360');
  await click('SquadScene','squad-close');await waitFor("smash.scene.isActive('GameScene')&&!smash.scene.isActive('SquadScene')");
  assert.equal(await evaluate('gs.squad.drones.length'),1);
  assert.deepEqual(await evaluate('({x:gs.joystick.baseSprite.x,y:gs.joystick.baseSprite.y})'),{x:130,y:1230},
    'Closing management restores the joystick inside the control band');
  const saved=await evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
  assert.equal(saved.roster.units.length,2);assert.equal(saved.hero.talents.length,1);
  await evaluate(`gs.scene.start('GameOverScene',{victory:false,stats:{...gs.stats},droneSummary:gs.getDroneSummaryList(),hero:gs.squad.heroSnapshot()});undefined;`);
  await waitFor("smash.scene.isActive('GameOverScene')");await capture('result-360');
  await click('GameOverScene','result-menu');await waitFor("smash.scene.isActive('MenuScene')");await capture('continue-360');
  assert.deepEqual(errors,[],JSON.stringify(errors));
  report.status='passed';report.checks=['native title and crest','720/360/320 actual HUD','six actual roster units / revival countdown',
    'boss HP from live enemy','44px status touch target / no movement propagation','native detail open/close',
    'paid summon / fixed recipes / deployment','talent selection / save persistence','quick craft and facilities access','result and return to title','no runtime errors'];
  await writeFile(`${output}/browser-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{browser.close();}
