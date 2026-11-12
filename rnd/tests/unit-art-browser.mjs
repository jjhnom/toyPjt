import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const output='artifacts/cute-units-20261111',baseline=process.env.SMASH_UNIT_ART_BASELINE==='1';
const b=await browserSession(),{evaluate,click,send,waitFor}=b;
const report={status:'running',mode:baseline?'before':'after',screenshots:[]};
const capture=async label=>{const png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${output}/${label}.png`,Buffer.from(png.data,'base64'));report.screenshots.push(label+'.png');};
const size=async width=>{await send('Emulation.setDeviceMetricsOverride',{
  width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(180);};
try{
  await mkdir(output,{recursive:true});
  await evaluate(`(async()=>{window.unitDefs=Object.values((await import('/src/config/unitData.ts')).UNIT_TYPES);})()`);
  const coverage=await evaluate(`(()=>{
    const hash=p=>{let h=2166136261;for(const n of p)h=Math.imul(h^n,16777619);return h>>>0;};
    return unitDefs.map(def=>{
      const battle=smash.textures.get('unit_'+def.id),portrait=smash.textures.get('portrait_'+def.id);
      const data=battle.getContext().getImageData(0,0,48,48).data;
      const face=portrait.getContext().getImageData(0,0,96,96).data;
      let ink=0;for(let i=3;i<data.length;i+=4)if(data[i]>127)ink++;
      return{id:def.id,name:def.name,frames:battle.frameTotal-1,width:battle.get(0).width,height:battle.get(0).height,
        portrait:[portrait.get().width,portrait.get().height],hash:hash(data),portraitHash:hash(face),ink,
        cornerAlpha:[data[3],data[47*4+3],data[47*48*4+3],data[data.length-1]]};
    });})()`);
  assert.equal(coverage.length,22);
  assert.equal(new Set(coverage.map(r=>r.hash)).size,22);
  assert.equal(new Set(coverage.map(r=>r.portraitHash)).size,22);
  for(const row of coverage){
    assert.equal(row.frames,4,row.id);assert.equal(row.width,48);assert.equal(row.height,48);
    assert.deepEqual(row.portrait,[96,96]);assert.ok(row.ink>200&&row.ink<1900,JSON.stringify(row));
    assert.deepEqual(row.cornerAlpha,[0,0,0,0],row.id+' transparent battle corners');
  }
  assert.equal(await evaluate("smash.textures.exists('art_units_source')"),false);
  report.coverage=coverage;
  if(!baseline){
    try{
      const old=JSON.parse(await readFile(`${output}/before.json`,'utf8'));
      for(const row of coverage){const previous=old.coverage.find(r=>r.id===row.id);
        assert.notEqual(row.hash,previous.hash,row.id+' battle art changed');
        assert.notEqual(row.portraitHash,previous.portraitHash,row.id+' portrait art changed');}
      report.changedFromBefore=22;
    }catch(error){if(error.code!=='ENOENT')throw error;}
    await size(360);await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
    await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
      gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().cleared=true;
      gs.squad.roster.minerals=200;gs.stats.mineralsCollected=200;
      gs.openSquadModal('치비 아트 소환/조합 검사');undefined;`);
    await waitFor("smash.scene.isActive('SquadScene')");await capture('summon-360');
    const count=await evaluate('gs.squad.roster.units.length');
    await click('SquadScene','summon-BASIC_LASER');
    assert.equal(await evaluate('gs.squad.roster.units.length'),count+1);
    await click('SquadScene','squad-tab-combine');await click('SquadScene','combine-gatling');
    assert.ok(await evaluate("gs.squad.roster.units.some(u=>u.archetype==='GATLING_BOT')"));
    await capture('combine-360');await click('SquadScene','squad-tab-roster');await capture('roster-360');
    await click('SquadScene','codex-open');await waitFor("smash.scene.isActive('CodexScene')");
    const codexKeys=await evaluate(`smash.scene.getScene('CodexScene').children.list
      .filter(o=>o.texture?.key.startsWith('portrait_')).map(o=>o.texture.key)`);
    assert.ok(codexKeys.includes('portrait_BASIC_LASER'));await capture('codex-360');
    await click('CodexScene','codex-close');await click('SquadScene','squad-close');
    await waitFor("smash.scene.isActive('GameScene')");
    await evaluate('gs.scene.pause();gs.clearEncounter();undefined;');
    report.liveUnits=[];
    for(let start=0;start<22;start+=6){
      const rows=await evaluate(`(()=>{
        const defs=unitDefs.slice(${start},${start+6});
        gs.squad.roster.units=defs.map((def,i)=>({id:'art_'+(${start}+i),archetype:def.id,star:1,deployed:true}));
        gs.squad.syncRoster();
        gs.squad.drones.forEach((d,i)=>{d.setPosition(120+(i%3)*240,490+Math.floor(i/3)*220);d.setFrame(0);});
        gs.refreshHud();
        return gs.squad.drones.map(d=>({id:d.archetype,texture:d.texture.key,width:d.width,height:d.height,active:d.active}));
      })()`);
      assert.equal(rows.length,Math.min(6,22-start));
      for(const row of rows){assert.equal(row.texture,'unit_'+row.id);assert.equal(row.width,48);assert.equal(row.height,48);assert.equal(row.active,true);}
      report.liveUnits.push(...rows);
      await capture(`battle-${start/6+1}-360`);
    }
    await evaluate("gs.scene.stop();smash.scene.getScene('MenuScene').scene.start();undefined;");
    await waitFor("smash.scene.isActive('MenuScene')");
  }
  // Contact sheet uses the real prepared textures in an isolated QA display.
  await evaluate(`(()=>{
    const s=smash.scene.getScene('MenuScene');s.tweens.killAll();s.children.removeAll(true);s.input.enabled=false;
    s.add.rectangle(360,640,720,1280,0x161126);
    s.add.text(360,22,'소환 유닛 22종 · ${baseline?'변경 전':'치비 픽셀'}',{fontFamily:'Malgun Gothic',fontSize:'26px',color:'#ffe1a2',fontStyle:'bold'}).setOrigin(.5,0);
    s.add.text(360,62,'목록 초상화 96px / 전투 스프라이트 48px',{fontFamily:'Malgun Gothic',fontSize:'16px',color:'#ccbde1'}).setOrigin(.5,0);
    unitDefs.forEach((u,i)=>{const x=6+i%4*178,y=100+Math.floor(i/4)*190;
      s.add.rectangle(x+87,y+88,170,178,0x251c39).setStrokeStyle(1,0x8e6ca8);
      s.add.text(x+87,y+10,'T'+u.tier+' '+u.name,{fontFamily:'Malgun Gothic',fontSize:'15px',color:'#ffe9c1'}).setOrigin(.5,0);
      s.add.image(x+57,y+88,'portrait_'+u.id).setDisplaySize(100,100);
      s.add.sprite(x+138,y+94,'unit_'+u.id,0).play('walk_'+u.id);
      s.add.text(x+87,y+152,u.id,{fontFamily:'monospace',fontSize:'10px',color:'#c3b4d5'}).setOrigin(.5,0);
    });})()`);
  for(const width of[720,360]){await size(width);await capture(`${baseline?'before':'after'}-all-units-${width}`);}
  assert.deepEqual(b.errors,[],JSON.stringify(b.errors));report.status='passed';
  await writeFile(`${output}/${baseline?'before':'result'}.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,mode:report.mode,distinct:coverage.length,live:report.liveUnits?.length,
    changed:report.changedFromBefore,screenshots:report.screenshots}));
}finally{b.close();}
