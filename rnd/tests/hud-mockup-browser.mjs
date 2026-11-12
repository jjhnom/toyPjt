import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const phase=process.argv[2]??'final',out='artifacts/hud-mockup-20261111';
const b=await browserSession(),{evaluate,send,click,waitFor}=b;
const report={phase,status:'running',shots:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  gs.progression.stages=gs.progression.stages.map(s=>({...s,gridWidth:3,gridHeight:3}));gs.progression.index=1;
  gs.squad.hero.level=4;gs.squad.hero.xp=54;gs.squad.health.maxHp=115;gs.squad.health.currentHp=71;
  gs.squad.roster.minerals=50000;for(const id of ['STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT'])gs.squad.roster.summon(id);
  gs.squad.roster.minerals=1250;gs.squad.syncRoster();gs.squad.setPositionImmediate(360,680);
  gs.roomState='LOCKED_WAVES';gs.currentWave=2;gs.totalWavesInRoom=3;
  gs.bannerContainer.setVisible(false);gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.drawUnitOverlays();gs.refreshHud();undefined;`);
 const shot=async(name,width)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(160);
  const file=`${phase}-${name}-${width}.png`,png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${out}/${file}`,Buffer.from(png.data,'base64'));report.shots.push(file);
 };
 for(const width of [360,390])await shot('battle',width);
 if(phase==='final'){
  const geometry=await evaluate(`(()=>{
   const stage=gs.children.getByName('stage-banner').getBounds(),door=gs.doors.top.sprite.getBounds();
   const fields=['hudHeroName','hudHeroLevel','hudHpText','hudHeroXpText','hudMineralText','hudStageIndex','hudRoomText','hudRoomBadge','hudWaveText'];
   const rects=fields.map(key=>({key,r:gs[key].getBounds()})),problems=[];
   for(const {key,r}of rects)if(r.x<20||r.right>690||r.y<12||r.bottom>154)problems.push(key+' outside HUD');
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const a=rects[i].r,c=rects[j].r;if(a.x<c.right&&a.right>c.x&&a.y<c.bottom&&a.bottom>c.y)problems.push(rects[i].key+' / '+rects[j].key);
   }
   for(let i=0;i<6;i++){
    const p=gs.hudUnitPortraits[i].getBounds(),grade=gs.hudUnitGrades[i].getBounds(),status=gs.hudUnitStatusTexts[i].getBounds();
    if(p.right>grade.left||p.right>status.left||p.bottom>=1166||status.bottom>=1166)problems.push('slot '+i);
   }
   return{problems,stageBottom:stage.bottom,doorTop:door.top,doorY:gs.doors.top.sprite.y,
    arenaWidth:gs.children.getByName('provided-floor').width,arenaHeight:gs.children.getByName('provided-floor').height,
    leaderBody:gs.squad.leader.body.width,slots:gs.hudUnitPortraits.length};})()`);
  assert.deepEqual(geometry.problems,[],JSON.stringify(geometry));assert.ok(geometry.stageBottom<geometry.doorTop);
  assert.equal(geometry.doorY,170);assert.equal(geometry.arenaWidth,576);assert.equal(geometry.arenaHeight,904);
  assert.equal(geometry.leaderBody,36);assert.equal(geometry.slots,6);report.geometry=geometry;
  const values=await evaluate(`(()=>{gs.squad.health.currentHp=1;gs.squad.hero.level=5;gs.squad.hero.xp=7;
   gs.squad.roster.minerals=999999;gs.refreshHud();return{hp:gs.hudHpText.text,xp:gs.hudHeroXpText.text,
    level:gs.hudHeroLevel.text,currency:gs.hudMineralText.text,raw:gs.hudMineralText.getData('amount')};})()`);
  assert.deepEqual(values,{hp:'HP 1 / 115',xp:'7 / 77',level:'Lv.5',currency:'999,999',raw:999999});report.values=values;
  await evaluate(`gs.progression.current.name='끝없이 이어지는 독안개 습지와 잊혀진 고대 소환사의 회랑';gs.refreshHud();undefined;`);
  const pages=await evaluate(`(()=>{const t=gs.hudRoomText,pages=t.getData('pages'),shown=[];
   for(let i=0;i<pages.length;i++){shown.push(t.text);gs.stageBanner.advancePages();}
   return{pages,shown,full:t.getData('fullText'),size:t.style.fontSize};})()`);
  assert.ok(pages.pages.length>1);assert.equal(pages.shown.join('').replaceAll(' ',''),pages.full.replaceAll(' ',''));
  assert.equal(pages.size,'18px');report.pages=pages;
  const pageUpdate=await evaluate(`(()=>{const t=gs.hudRoomText;gs.stageBanner.advancePages();
   const expected=t.getData('pages')[(t.getData('page')+1)%t.getData('pages').length];
   gs.stageBanner.setStatus('적 수와 전투 상태가 갱신되었습니다');gs.stageBanner.advancePages();return{expected,actual:t.text};})()`);
  assert.equal(pageUpdate.actual,pageUpdate.expected);report.titleSurvivesStatusUpdates=true;
  for(const width of [360,390])await shot('long-title',width);
  await evaluate(`gs.progression.current.name='독안개 습지';gs.squad.health.currentHp=71;gs.squad.roster.minerals=1250;
   gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().cleared=true;gs.updateDoorsVisual(gs.gridManager.getCurrentRoom(),false);
   gs.squad.setPositionImmediate(360,240);gs.refreshHud();gs.bannerContainer.setVisible(false);gs.scene.resume();undefined;`);
  await click('GameScene','squad-slot-2');
  assert.equal(await evaluate('gs.selectedHudUnitId===gs.squad.drones[2].id&&gs.hudStatusDetail.visible'),true);
  assert.equal(await evaluate('gs.joystick.activePointerId===null'),true);
  for(const width of [360,390])await shot('selected',width);
  await click('GameScene','squad-status-close');
  await evaluate(`for(const u of gs.squad.roster.units.slice(2))if(u.deployed)gs.squad.roster.toggleDeployment(u.id);
   gs.squad.syncRoster();gs.refreshHud();undefined;`);
  assert.equal(await evaluate('gs.squadHud.empty.filter(t=>t.visible&&t.text==="+").length'),4);
  await click('GameScene','squad-slot-5');assert.equal(await evaluate('gs.joystick.activePointerId===null'),true);
  for(const width of [360,390])await shot('empty',width);
  await evaluate('gs.squad.setPositionImmediate(360,680);gs.squad.health.maxHp=100000;gs.squad.health.currentHp=100000;undefined;');
  const rect=await evaluate('smash.canvas.getBoundingClientRect().toJSON()');
  const point=(id,x,y)=>({id,x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
  const touch=(type,points=[])=>send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await touch('touchStart',[point(1,190,850)]);await touch('touchMove',[point(1,250,850)]);await sleep(250);
  const moving=await evaluate('({x:gs.squad.leader.x,dir:gs.joystick.dirX})');
  assert.ok(moving.dir>.5&&moving.x>360,JSON.stringify(moving));report.moving=moving;
  await shot('joystick',390);
  await touch('touchStart',[point(1,250,850),point(2,642,1130)]);await sleep(80);
  assert.equal(await evaluate('gs.hudStatusDetail.visible'),true);assert.ok(await evaluate('gs.joystick.dirX>.5'));
  await touch('touchCancel');await sleep(100);
  assert.equal(await evaluate('gs.joystick.activePointerId===null&&gs.joystick.dirX===0&&gs.squad.leader.body.velocity.x===0'),true);
  await shot('cancelled',390);
  await click('GameScene','squad-status-close');
  await touch('touchStart',[point(1,200,850)]);await touch('touchMove',[point(1,250,850)]);
  await evaluate("smash.events.emit('blur');undefined;");await touch('touchCancel');await sleep(100);
  assert.equal(await evaluate('gs.joystick.activePointerId===null&&gs.joystick.dirX===0'),true);
  await click('GameScene','squad-status-open');await click('GameScene','squad-status-close');
  const controls=await evaluate(`(()=>{const names=['squad-open','active-skill','return-title'];
   return names.map(n=>{const c=gs.children.getByName(n),h=c.list.find(o=>o.input);return{name:n,r:h.getBounds()};});})()`);
  for(let i=1;i<controls.length;i++)assert.ok(controls[i].r.x-(controls[i-1].r.x+controls[i-1].r.width)>=20);
  for(const c of controls)assert.ok(c.r.width>=88&&c.r.height>=88&&c.r.y+c.r.height<=1280);
  report.controls=controls;report.input='movement, slot/detail isolation, multitouch, touchcancel, blur passed';
  await evaluate('gs.scene.pause();undefined;');
 }
 assert.deepEqual(b.errors,[]);report.status='passed';
 await writeFile(`${out}/${phase}-result.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{b.close();}
