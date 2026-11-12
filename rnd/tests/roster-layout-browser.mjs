import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const before=process.argv.includes('--before'),output='artifacts/roster-layout-20261111';
const b=await browserSession(),{evaluate,click,waitFor,send}=b;
try{
 await mkdir(output,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`(async()=>{window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
 const {UNIT_TYPES}=await import('/src/config/unitData.ts');
 const ids=['WORLD_DRUID','STORM_GENERAL','EARTH_DEITY','EARTH_DEITY','PHOENIX_LORD','STORM_GENERAL','PHOENIX_LORD','STORM_GENERAL'];
 gs.squad.roster.units=ids.map((id,i)=>({id:'qa_'+(i+1),archetype:id,tier:UNIT_TYPES[id].tier,star:i===0?2:i===4?1:3,deployed:i<5}));
 gs.squad.syncRoster();gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().cleared=true;
 gs.openSquadModal('동료를 선택해 원정대를 준비하세요');})()`);
 await waitFor("smash.scene.isActive('SquadScene')");await click('SquadScene','squad-tab-roster');
 const screens=[];
 for(const width of [720,360,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(160);
  const file=`${before?'before':'after'}-${width}.png`,png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(output+'/'+file,Buffer.from(png.data,'base64'));screens.push(file);
 }
 if(!before){
  const geometry=await evaluate(`(()=>{const s=smash.scene.getScene('SquadScene'),errors=[];
   const overlap=(a,b)=>a.x<b.right-.1&&a.right>b.x+.1&&a.y<b.bottom-.1&&a.bottom>b.y+.1;
   for(const u of gs.squad.roster.units){
    const get=n=>s.children.getByName(n+'-'+u.id),card=get('roster-card').getBounds();
    const parts=['roster-name','roster-portrait','roster-stars','roster-badge'].map(get);
    for(const p of parts){const r=p.getBounds();if(r.x<card.x+6||r.right>card.right-6||r.y<card.y+6||r.bottom>card.bottom-6)errors.push({id:u.id,part:p.name,r,card});}
    if(get('roster-name').text.split('\\n').length>2)errors.push('more than two lines');
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(overlap(parts[i].getBounds(),parts[j].getBounds()))errors.push([parts[i].name,parts[j].name]);
   }
   const heading=s.children.getByName('roster-heading'),guide=s.children.getByName('roster-guide');
   if(overlap(heading.getBounds(),guide.getBounds()))errors.push('heading/guide overlap');
   for(const name of ['squad-prev','squad-next']){
    const button=s.children.getByName(name),visual=button.getByName('provided-skin').getBounds();
    for(const u of gs.squad.roster.units.filter(u=>u.deployed)){
     const image=s.children.getByName('deployed-portrait-'+u.id),star=s.children.getByName('deployed-stars-'+u.id);
     if(overlap(visual,image.getBounds())||overlap(image.getBounds(),star.getBounds()))errors.push('deployed overlap');
     if(star.getBounds().bottom>484)errors.push('deployed star crosses panel padding');
    }
    if(overlap(button.getByName('hit').getBounds(),guide.getBounds()))errors.push('navigation covers guide');
   }
   return{errors};})()`);
  assert.deepEqual(geometry.errors,[]);
  const saved=await evaluate('JSON.stringify(gs.squad.roster.snapshot())');await click('SquadScene','roster-select-qa_8');
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').selectedUnitId"),'qa_8');
  assert.equal(await evaluate('JSON.stringify(gs.squad.roster.snapshot())'),saved);
  await click('SquadScene','roster-deploy-qa_8');assert.equal(await evaluate("gs.squad.roster.units[7].deployed"),true);
  await click('SquadScene','roster-deploy-qa_8');assert.equal(await evaluate("gs.squad.roster.units[7].deployed"),false);
  const overflow=await evaluate(`(async()=>{const {DRONE_SPECS}=await import('/src/config/gameData.ts');
   const original=DRONE_SPECS.WORLD_DRUID.name,s=smash.scene.getScene('SquadScene');
   try{DRONE_SPECS.WORLD_DRUID.name='아주긴이름의동료이름이프레임을넘지않도록확인';s.render();
    const t=s.children.getByName('roster-name-qa_1');return{lines:t.text.split('\\n').length,width:t.width,size:t.style.fontSize,ellipsis:t.text.endsWith('…')};
   }finally{DRONE_SPECS.WORLD_DRUID.name=original;s.render();}})()`);
  assert.deepEqual(overflow,{lines:2,width:overflow.width,size:'20px',ellipsis:true});assert.ok(overflow.width<=116);
  assert.deepEqual(b.errors,[]);
 }
 await writeFile(output+`/${before?'before':'after'}-result.json`,JSON.stringify({status:'passed',screens},null,2));
 console.log(JSON.stringify({status:'passed',before,screens}));
}finally{b.close();}
