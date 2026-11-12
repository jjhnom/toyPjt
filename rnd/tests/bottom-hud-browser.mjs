import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const phase=process.argv[2]??'after',out='artifacts/bottom-hud-20261112';
const b=await browserSession(),{evaluate,send,click,waitFor}=b;
const report={phase,shots:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  gs.squad.setPositionImmediate(360,680);gs.roomState='LOCKED_WAVES';gs.bannerContainer.setVisible(false);gs.refreshHud();undefined;`);
 const shot=async(name,width)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(200);
  for(const crop of [false,true]){
   const file=phase+'-'+name+'-'+width+(crop?'-bottom':'')+'.png';
   const png=await send('Page.captureScreenshot',{format:'png',...(crop?{clip:{x:0,y:1080*width/720,width,height:200*width/720,scale:1}}:{})});
   await writeFile(out+'/'+file,Buffer.from(png.data,'base64'));report.shots.push(file);
  }
 };
 for(const w of [360,390,720])await shot('two-units',w);
 await evaluate(`gs.squad.roster.minerals=50000;for(const id of ['STONE_GUARD','HERBAL_PRIEST','ROCKET_BOT','SPARK_SPIRIT'])gs.squad.roster.summon(id);
  gs.squad.syncRoster();gs.refreshHud();undefined;`);
 for(const w of [360,390])await shot('six-units',w);
 if(phase==='after'){
  const geometry=()=>evaluate(`(()=>{
   const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,problems=[],buttons=[];
   const counts=['squad-deployed','squad-owned','squad-synergy','squad-living'].map(n=>gs.children.getByName(n));
   for(let i=0;i<counts.length;i++){
    const a=counts[i].getBounds();if(a.left<20||a.right>700||a.top<1080||a.bottom>1106)problems.push(counts[i].name+' outside header');
    for(let j=i+1;j<counts.length;j++)if(overlap(a,counts[j].getBounds()))problems.push('counts overlap');
   }
   for(let i=0;i<6;i++){
    const card=gs.squadHud.frames[i].getBounds(),p=gs.hudUnitPortraits[i].getBounds();
    const texts=[gs.hudUnitGrades[i],gs.hudUnitStatusTexts[i]].filter(t=>t.visible);
    if(p.bottom>=1166)problems.push('portrait covers HP bar '+i);
    for(const t of texts){const r=t.getBounds();if(r.left<card.left+1||r.right>card.right-1||r.top<card.top+1||r.bottom>1165)
      problems.push('slot text outside card '+i);if(overlap(r,p))problems.push('slot portrait/text '+i);}
   }
   for(const name of ['squad-status-open','squad-open','active-skill','return-title']){
    const c=gs.children.getByName(name),skin=c.getByName('bottom-skin').getBounds(),hit=c.getByName('hit').getBounds();
    const texts=c.list.filter(t=>t.type==='Text'&&t.text);
    for(let i=0;i<texts.length;i++){
     const a=texts[i].getBounds();if(a.left<skin.left+7||a.right>skin.right-7||a.top<skin.top+5||a.bottom>skin.bottom-5)
      problems.push(name+' clipped '+texts[i].name);
     for(let j=i+1;j<texts.length;j++)if(overlap(a,texts[j].getBounds()))problems.push(name+' text overlaps');
    }
    buttons.push({name,skin,hit,texts:texts.map(t=>({text:t.text,r:t.getBounds()}))});
   }
   return{problems,buttons,counts:counts.map(t=>t.text),board:gs.children.getByName('battle-bottom-board').getBounds(),
    arena:[gs.children.getByName('provided-floor').width,gs.children.getByName('provided-floor').height],
    body:gs.squad.leader.body.width,doorY:gs.doors.top.sprite.y};})()`);
  report.geometry=await geometry();assert.deepEqual(report.geometry.problems,[],JSON.stringify(report.geometry));
  assert.deepEqual(report.geometry.arena,[576,904]);assert.equal(report.geometry.body,36);assert.equal(report.geometry.doorY,170);
  assert.equal(report.geometry.board.y,1080);assert.equal(report.geometry.board.y+report.geometry.board.height,1280);
  const controls=report.geometry.buttons.slice(1);
  for(let i=0;i<controls.length;i++){
   assert.ok(controls[i].hit.width>=88&&controls[i].hit.height>=88);
   if(i>0)assert.ok(controls[i].hit.x-controls[i-1].hit.x-controls[i-1].hit.width>=20,'controls leave a safe gap');
  }
  await evaluate(`gs.squad.drones[0].health.currentHp=0;gs.squad.drones[0].reviveAt=gs.time.now+12000;gs.updateHudVitals();undefined;`);
  assert.equal(await evaluate('gs.hudUnitStatusTexts[0].visible&&gs.hudUnitStatusTexts[0].text==="12초"'),true);
  assert.equal(await evaluate('gs.hudUnitPortraits[0].alpha'),.3);assert.equal(await evaluate('gs.hudTeamCount.text'),'생존 5/6');
  await evaluate(`gs.squad.drones[1].upgradeTo('PHOENIX_LORD');gs.squad.drones[1].lastSkillAt=gs.time.now;gs.updateHudVitals();undefined;`);
  report.special=await geometry();assert.deepEqual(report.special.problems,[],JSON.stringify(report.special));
  assert.equal(await evaluate('gs.hudUnitSkillIcons[1].visible&&gs.hudUnitStatusTexts[1].visible'),true);
  for(const w of [360,390])await shot('revival-cooldown',w);
  await evaluate(`gs.squad.drones[0].health.currentHp=35;gs.updateHudVitals();gs.sys.sceneUpdate=()=>{};gs.physics.world.pause();gs.scene.resume();undefined;`);
  await click('GameScene','squad-slot-1');assert.equal(await evaluate('gs.hudStatusDetail.visible&&gs.selectedHudUnitId===gs.squad.drones[1].id'),true);
  assert.equal(await evaluate('gs.joystick.activePointerId'),null);
  for(const w of [360,390])await shot('detail',w);
  await click('GameScene','squad-status-close');await click('GameScene','squad-status-open');
  assert.equal(await evaluate('gs.hudStatusDetail.visible'),true);await click('GameScene','squad-status-close');
  const rect=await evaluate('smash.canvas.getBoundingClientRect().toJSON()');
  const point=(id,x,y)=>({id,x:rect.x+x*rect.width/720,y:rect.y+y*rect.height/1280});
  const touch=(type,touchPoints=[])=>send('Input.dispatchTouchEvent',{type,touchPoints});
  const ready=()=>evaluate(`gs.activeSkillButton.cancel();gs.squad.restoreHero({...gs.squad.heroSnapshot(),activeRemainingMs:0});
   gs.squad.health.currentHp=23;gs.squad.drones[0].health.currentHp=20;gs.activeSkillButton.update(true,0,gs.squad.activeDuration());undefined;`);
  await ready();for(const w of [360,390])await shot('skill-ready',w);
  await touch('touchStart',[point(1,484,1230)]);assert.equal(await evaluate('gs.squad.health.currentHp'),23);
  assert.equal(await evaluate('gs.joystick.activePointerId'),null);await touch('touchEnd');await sleep(100);
  assert.equal(await evaluate('gs.squad.health.currentHp'),33);assert.equal(await evaluate('gs.squad.activeRemaining()'),18000);
  await evaluate('gs.activeSkillButton.update(true,gs.squad.activeRemaining(),gs.squad.activeDuration());undefined;');
  assert.equal(await evaluate('gs.children.getByName("active-skill").getByName("active-skill-status").text'),'18초');
  for(const w of [360,390])await shot('skill-cooldown',w);
  for(const cancel of ['drag','touchcancel','pointercancel','blur','pause','hidden']){
   await ready();await touch('touchStart',[point(1,484,1230)]);
   if(cancel==='drag')await touch('touchMove',[point(1,484,1030)]);
   if(cancel==='touchcancel')await touch('touchCancel');
   if(cancel==='pointercancel')await evaluate('gs.game.canvas.dispatchEvent(new Event("pointercancel"));undefined;');
   if(cancel==='blur')await evaluate('gs.game.events.emit("blur");undefined;');
   if(cancel==='pause')await evaluate('gs.scene.pause();gs.scene.resume();undefined;');
   if(cancel==='hidden')await evaluate('gs.game.events.emit("hidden");gs.game.events.emit("visible");undefined;');
   if(cancel!=='touchcancel')await touch('touchEnd');await sleep(100);
   assert.equal(await evaluate('gs.squad.health.currentHp'),23,cancel);assert.equal(await evaluate('gs.squad.activeRemaining()'),0,cancel);
  }
  await ready();await touch('touchStart',[point(1,90,1230)]);await touch('touchMove',[point(1,145,1230)]);
  const moving=await evaluate('gs.joystick.activePointerId');assert.ok(moving!==null);
  await touch('touchStart',[point(1,145,1230),point(2,484,1230)]);assert.ok(await evaluate('gs.activeSkillButton.pointerId!==null'));
  await touch('touchEnd',[point(2,484,1230)]);await sleep(100);
  assert.equal(await evaluate('gs.squad.health.currentHp'),33);assert.equal(await evaluate('gs.joystick.activePointerId'),moving);
  assert.ok(await evaluate('gs.joystick.dirX>.5'));await touch('touchCancel');
  assert.equal(await evaluate('gs.joystick.dirX===0&&gs.joystick.activePointerId===null'),true);
  await evaluate(`gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().cleared=true;gs.refreshHud();undefined;`);
  assert.equal(await evaluate('gs.controlHud.maintenance.getByName("status").text'),'준비 완료');
  for(const w of [360,390])await shot('maintenance-ready',w);
  await click('GameScene','squad-open');await waitFor('smash.scene.isActive("SquadScene")');
  assert.equal(await evaluate('gs.joystick.activePointerId'),null);await click('SquadScene','squad-close');
  await waitFor('smash.scene.isActive("GameScene")');await click('GameScene','return-title');await waitFor('smash.scene.isActive("MenuScene")');
  report.input={detail:true,releaseToCast:true,cooldown:true,cancel:['drag','touchcancel','pointercancel','blur','pause','hidden'],multitouch:true,maintenance:true,title:true};
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(out+'/'+phase+'-result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{b.close();}
