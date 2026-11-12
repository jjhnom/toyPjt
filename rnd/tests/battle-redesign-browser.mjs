import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'final',out='artifacts/battle-redesign-20261111',b=await browserSession();
const {evaluate,click,send,waitFor}=b;
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
 gs.squad.roster.minerals=1250;for(const id of ['STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT'])gs.squad.roster.summon(id);
 gs.squad.syncRoster();gs.squad.setPositionImmediate(360,680);
 gs.squad.drones.forEach((d,i)=>{d.setPosition(210+(i%3)*150,550+Math.floor(i/3)*210);});
 gs.roomState='LOCKED_WAVES';gs.currentWave=2;gs.totalWavesInRoom=3;
 gs.squad.drones[0].health.currentHp=0;gs.squad.drones[0].reviveAt=gs.time.now+8000;
 gs.enemies.spawnEnemy('SWARMER',240,340);gs.enemies.spawnEnemy('SWARMER',500,400);
 gs.bannerContainer.setVisible(false);gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.drawUnitOverlays();gs.refreshHud();
 gs.activeSkillButton.update(true,0,18000);undefined;`);
 const shots=[];
 const shot=async label=>{const data=await send('Page.captureScreenshot',{format:'png'});const name=phase+'-'+label+'.png';
  await writeFile(out+'/'+name,Buffer.from(data.data,'base64'));shots.push(name);};
 for(const width of [720,360,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(150);await shot('battle-'+width);}
 await evaluate(`gs.gridManager.getCurrentRoom().type='BOSS';gs.enemies.spawnEnemy('BOSS_CORE',360,360);
 gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.hazards.add('METEOR',480,550,0,0,{radius:72});gs.hazards.update(300);gs.refreshHud();undefined;`);
 await shot('boss-320');
 if(phase!=='before'){
  const layout=await evaluate(`(()=>{const names=['hudHeroName','hudHeroLevel','hudHpText','hudHeroXpText','hudMineralText','hudStageIndex','hudRoomText','hudRoomBadge','hudWaveText','saveStatusText'];
   return names.map(n=>({name:n,text:gs[n].text,bounds:gs[n].getBounds()}));})()`);
  for(const r of layout){const stage=['hudStageIndex','hudRoomText','hudRoomBadge','hudWaveText'].includes(r.name);
   assert.ok(r.bounds.x>=28&&r.bounds.x+r.bounds.width<=(stage?688:536),JSON.stringify(r));
   assert.ok(r.bounds.y>=(stage?108:12)&&r.bounds.y+r.bounds.height<=(stage?154:98),JSON.stringify(r));}
  assert.equal(await evaluate('gs.particles.maxSize'),120);
 }
 if(phase==='final'){
  const visual=await evaluate(`({allyWidths:gs.squad.drones.map(d=>d.displayWidth),leaderBody:gs.squad.leader.body.width,
   arenaWidth:gs.children.getByName('provided-floor').width,arenaHeight:gs.children.getByName('provided-floor').height,
   pixelArt:smash.config.pixelArt})`);
  assert.ok(visual.allyWidths.every(w=>w===60));assert.equal(visual.leaderBody,36);
  assert.equal(visual.arenaWidth,576);assert.equal(visual.arenaHeight,904);assert.equal(visual.pixelArt,true);
  const environment=await evaluate(`(()=>{const target=gs.arenaDecoration,count=gs.children.list.length;
   for(let i=0;i<5;i++)gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());
   return{reused:target===gs.arenaDecoration,before:count,after:gs.children.list.length,interactive:!!target.input,physics:!!target.body};})()`);
  assert.equal(environment.reused,true);assert.equal(environment.before,environment.after);
  assert.equal(environment.interactive,false);assert.equal(environment.physics,false);
  const map=await evaluate(`(()=>{for(const e of gs.enemies.getChildren())e.deactivate();gs.updateHudVitals();
   const draw=gs.drawMinimap;let draws=0;gs.drawMinimap=function(){draws++;return draw.call(this);};
   try{gs.enemies.spawnEnemy('SWARMER',240,340);gs.updateHudVitals();const appeared=draws;
    for(const e of gs.enemies.getChildren())e.deactivate();gs.updateHudVitals();return{appeared,cleared:draws};
   }finally{gs.drawMinimap=draw;}})()`);
  assert.equal(map.appeared,1);assert.equal(map.cleared,2);
  const dock=await evaluate(`(()=>{const problems=[],overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
   for(let i=0;i<gs.hudUnitPortraits.length;i++){
    const image=gs.hudUnitPortraits[i].getBounds(),grade=gs.hudUnitGrades[i].getBounds(),state=gs.hudUnitStatusTexts[i].getBounds();
    if(overlap(image,grade)||overlap(image,state)||overlap(grade,state))problems.push(i);
    if(state.bottom>1148||grade.top<1104)problems.push('dock padding');
   }return problems;})()`);
  assert.deepEqual(dock,[]);
  await evaluate(`gs.particles.clear(true,true);gs.particles.beginFrame();
   ['ROCKET_BOT','STUN_BOT','CHAIN_LIGHTNING','SHADOW_ASSASSIN','BLACKHOLE_MISSILE'].forEach((u,i)=>{
    const x=150+i%3*200,y=360+Math.floor(i/3)*200;gs.particles.emitCast(u,x,y,0);gs.particles.emitExplosion(u,x,y,48);});
   gs.particles.emitSkill('heal',550,570,'WORLD_DRUID');gs.particles.emitSkill('shield',250,800,'EARTH_DEITY');gs.particles.emitSkill('poison',450,800,'THORN_GUARD');
   for(const p of gs.particles.getChildren())p.update(gs.time.now,80);undefined;`);
  await shot('effects-320');
  const cap=await evaluate(`(()=>{for(let i=0;i<200;i++)gs.particles.emitExplosion('ROCKET_BOT',360,650,32);
   const count=gs.particles.getLength(),active=gs.particles.countActive(true);for(const p of gs.particles.getChildren())p.update(0,2000);
   const expired=gs.particles.countActive(true);gs.particles.emitCast('STUN_BOT',360,650,0);
   return{count,active,expired,reused:gs.particles.getLength()===count};})()`);
  assert.ok(cap.count<=120&&cap.active<=120);assert.equal(cap.expired,0);assert.equal(cap.reused,true);
  await evaluate(`gs.sys.sceneUpdate=function(){this.updateHudVitals();};gs.physics.world.pause();gs.scene.resume();undefined;`);
  await click('GameScene','squad-status-open');assert.equal(await evaluate('gs.hudStatusDetail.visible'),true);
  await click('GameScene','squad-status-close');assert.equal(await evaluate('gs.hudStatusDetail.visible'),false);
 }
 assert.deepEqual(b.errors,[]);await writeFile(out+'/'+phase+'-result.json',JSON.stringify({status:'passed',phase,shots},null,2));
 console.log(JSON.stringify({status:'passed',phase,shots}));
}finally{b.close();}
