import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const output='artifacts/squad-redesign-20261111',b=await browserSession(),{evaluate,click,send,waitFor}=b;
const report={status:'running',screenshots:[],layouts:[]};
const shot=async name=>{const png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${output}/${name}.png`,Buffer.from(png.data,'base64'));report.screenshots.push(name+'.png');};
const size=async(width,height=Math.round(width*1280/720))=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(160);};
const choose=name=>click('SquadScene',name);
const checkTargets=async label=>{
  const result=await evaluate(`(()=>{const s=smash.scene.getScene('SquadScene'),scale=smash.canvas.getBoundingClientRect().width/720;
    const rows=s.children.list.filter(c=>c.list&&c.getByName('hit')?.input?.enabled).map(c=>{
      const r=c.getByName('hit').getBounds();return{name:c.name,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width*scale,height:r.height*scale};});
    const overlap=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const a=rows[i],c=rows[j];if(a.x<c.right-.1&&a.right>c.x+.1&&a.y<c.bottom-.1&&a.bottom>c.y+.1)overlap.push([a.name,c.name]);}
    return{rows,overlap,inside:rows.every(r=>r.x>=0&&r.right<=720&&r.y>=0&&r.bottom<=1280)};})()`);
  assert.deepEqual(result.overlap,[],JSON.stringify(result));assert.equal(result.inside,true);
  assert.ok(result.rows.every(r=>r.width>=48&&r.height>=48),JSON.stringify(result));
  report.layouts.push({label,...result});
};
try{
  await mkdir(output,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
  await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
    gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().cleared=true;gs.squad.roster.minerals=1000;
    for(const id of['STONE_GUARD','HERBAL_PRIEST','SPARK_SPIRIT','SHADOW_DAGGER','ROCKET_BOT','BASIC_LASER'])gs.squad.roster.summon(id);
    gs.squad.syncRoster();gs.stats.mineralsCollected=gs.squad.roster.minerals;
    gs.openSquadModal('동료를 준비하고 다음 방으로 출발하세요');undefined;`);
  await waitFor("smash.scene.isActive('SquadScene')");
  const frozen=await evaluate('gs.time.now');
  for(const width of[720,360,320]){
    await size(width);await shot(`summon-${width}`);await checkTargets(`summon-${width}`);
  }
  await choose('summon-BASIC_LASER');assert.equal(await evaluate('gs.squad.roster.units.length'),9);
  await choose('squad-next');await shot('summon-fire-320');
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').children.getByName('summon-STUN_BOT').getByName('hit').input?.enabled??false"),false);
  await choose('squad-next');await shot('summon-extra-320');
  await choose('squad-tab-combine');await checkTargets('combine-320');await shot('combine-320');
  const recipes=await evaluate(`(async()=>{
    const {COMBINATION_RECIPES}=await import('/src/config/squadData.ts');
    const s=smash.scene.getScene('SquadScene'),failures=[];
    for(let page=0;page<COMBINATION_RECIPES.length;page++){
      s.page=page;s.render();
      const lines=s.children.list.filter(o=>o.name?.startsWith('recipe-')&&o.name.includes('-ingredient-'));
      for(let i=0;i<lines.length;i++){const r=lines[i].getBounds(),limit=i+1<lines.length?lines[i+1].getBounds().top:704;
        if(r.bottom>limit||r.right>660)failures.push({page,text:lines[i].text,bottom:r.bottom,limit,right:r.right});}
      for(const [name,limit]of[['recipe-result-skill',758],['recipe-consumed',806]]){
        const o=s.children.getByName(name);if(o.getBounds().bottom>limit)failures.push({page,name,bottom:o.getBounds().bottom,limit});}
    }
    s.page=0;s.render();return{count:COMBINATION_RECIPES.length,failures};})()`);
  assert.deepEqual(recipes.failures,[]);report.recipes=recipes;
  await choose('recipe-picker-gatling');await shot('materials-320');await checkTargets('materials-320');
  await choose('ingredient-next');await choose('ingredient-prev');await choose('ingredient-back');
  await choose('combine-gatling');assert.ok(await evaluate("gs.squad.roster.units.some(u=>u.archetype==='GATLING_BOT')"));
  await choose('squad-tab-roster');
  for(const width of[720,360,320]){await size(width);await shot(`roster-${width}`);await checkTargets(`roster-${width}`);}
  const selected=await evaluate('gs.squad.roster.units.at(-1).id');await choose(`roster-select-${selected}`);
  assert.ok(await evaluate(`smash.scene.getScene('SquadScene').children.getByName('roster-detail-title').text.includes('바람 순찰자')`));
  const oldState=await evaluate(`gs.squad.roster.units.find(u=>u.id==='${selected}').deployed`);
  if(!oldState&&await evaluate('gs.squad.roster.units.filter(u=>u.deployed).length===6')){
    await choose(`roster-deploy-${selected}`);
    assert.equal(await evaluate(`gs.squad.roster.units.find(u=>u.id==='${selected}').deployed`),false,'Full squad blocks deployment');
    const first=await evaluate('gs.squad.roster.units.find(u=>u.deployed).id');
    await choose(`roster-select-${first}`);await choose(`roster-deploy-${first}`);await choose(`roster-select-${selected}`);
  }
  await choose(`roster-deploy-${selected}`);assert.notEqual(await evaluate(`gs.squad.roster.units.find(u=>u.id==='${selected}').deployed`),oldState);
  await shot('roster-selected-320');
  await evaluate(`gs.squad.roster.units[0].star=3;gs.squad.roster.units[0].awakening=1;gs.squad.syncRoster();
    smash.scene.getScene('SquadScene').selectedUnitId=gs.squad.roster.units[0].id;smash.scene.getScene('SquadScene').render();undefined;`);
  const awake=await evaluate('gs.squad.roster.units[0].id'),before=await evaluate('JSON.stringify(gs.squad.roster.snapshot())');
  await choose(`roster-sell-${awake}`);await waitFor("smash.scene.getScene('SquadScene').confirmation!==null");
  await choose('loss-cancel');assert.equal(await evaluate('JSON.stringify(gs.squad.roster.snapshot())'),before);
  await choose('squad-tab-summon');await evaluate('gs.squad.roster.minerals=0;smash.scene.getScene("SquadScene").render();undefined;');
  await shot('summon-insufficient-320');await choose('summon-BASIC_LASER');assert.equal(await evaluate('gs.squad.roster.minerals'),0);
  await evaluate(`gs.squad.roster.minerals=10000;
    while(gs.squad.roster.units.length<16)gs.squad.roster.summon('BASIC_LASER');
    gs.squad.syncRoster();smash.scene.getScene('SquadScene').render();undefined;`);
  await choose('summon-BASIC_LASER');assert.equal(await evaluate('gs.squad.roster.units.length'),16);
  await shot('summon-full-320');await choose('squad-tab-roster');await choose('squad-next');
  const last=await evaluate('gs.squad.roster.units.at(-1).id');await choose(`roster-select-${last}`);
  assert.ok(await evaluate(`smash.scene.getScene('SquadScene').children.getByName('roster-detail-state').text.includes('#${last.split('_')[1]}')`));
  await checkTargets('roster-second-page-320');await shot('roster-second-page-320');
  await evaluate(`window.fullRoster=gs.squad.roster.snapshot();gs.squad.roster.units=gs.squad.roster.units.slice(-1);
    gs.squad.syncRoster();undefined;`);
  await choose('squad-tab-combine');await choose('recipe-filter');
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').children.list.some(o=>o.text==='지금 가능한 조합이 없습니다')"),true);
  await shot('combine-empty-320');
  await evaluate('gs.squad.roster.restore(window.fullRoster,0);gs.squad.syncRoster();undefined;');
  report.detailCoverage=await evaluate(`(async()=>{
    const defs=Object.values((await import('/src/config/unitData.ts')).UNIT_TYPES);
    const s=smash.scene.getScene('SquadScene'),saved=gs.squad.roster.snapshot(),problems=[];
    s.tab='roster';s.availableOnly=false;
    for(let start=0;start<defs.length;start+=16){
      gs.squad.roster.units=defs.slice(start,start+16).map((d,i)=>({id:'qa_'+(start+i+1),archetype:d.id,tier:d.tier,star:3,awakening:10,deployed:i<6}));
      gs.squad.syncRoster();
      for(const [index,unit]of gs.squad.roster.units.entries()){
        s.page=Math.floor(index/8);s.selectedUnitId=unit.id;s.render();
        for(const [name,limit]of[['roster-detail-title',910],['roster-detail-state',936],['roster-detail-skill',960]]){
          const o=s.children.getByName(name),r=o.getBounds();
          if(r.bottom>limit||r.right>666)problems.push({id:unit.archetype,name,text:o.text,bottom:r.bottom,limit,right:r.right});
        }
        const cardTitle=s.children.getByName('roster-name-'+unit.id);
        if(cardTitle.width>116||cardTitle.height>52||cardTitle.text.split('\\n').length>2||cardTitle.style.fontSize!=='20px')
          problems.push({id:unit.archetype,cardWidth:cardTitle.width,cardHeight:cardTitle.height});
      }
    }
    gs.squad.roster.restore(saved,0);gs.squad.syncRoster();s.page=0;s.selectedUnitId=null;s.render();
    return{count:defs.length,problems};})()`);
  assert.deepEqual(report.detailCoverage.problems,[]);
  await choose('squad-tab-summon');
  assert.equal(await evaluate('gs.time.now'),frozen,'Combat time stays paused throughout management');
  await size(960,540);await shot('summon-landscape');
  await size(360);await choose('squad-close');await waitFor("!smash.scene.isActive('SquadScene')&&smash.scene.isActive('GameScene')");
  assert.equal(await evaluate('gs.joystick.dirX===0&&gs.joystick.dirY===0'),true);
  assert.deepEqual(b.errors,[],JSON.stringify(b.errors));report.status='passed';
  await writeFile(`${output}/result.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,recipes:recipes.count,layouts:report.layouts.length,screenshots:report.screenshots}));
}finally{b.close();}
