import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const output='artifacts/provided-art-20261111',b=await browserSession(),{evaluate,click,send,waitFor}=b;
const report={status:'running',floors:[],screenshots:[]};
const shot=async name=>{const png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${output}/${name}.png`,Buffer.from(png.data,'base64'));report.screenshots.push(name+'.png');};
try{
  await mkdir(output,{recursive:true});
  report.frames=await evaluate("smash.textures.get('provided_ui').getFrameNames()");
  assert.equal(report.frames.length,35);
  const menu=await evaluate(`(()=>{const s=smash.scene.getScene('MenuScene'),skin=s.children.getByName('new-run').getByName('provided-skin');
    return{frame:skin.frame.name,width:skin.width,height:skin.height};})()`);
  assert.deepEqual(menu,{frame:'button_primary',width:584,height:112});await shot('lobby-720');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});await sleep(160);
  await shot('lobby-360');await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
  await evaluate("window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();undefined;");
  for(const [theme,frame]of[['forest','floor_grass'],['swamp','floor_grass'],['volcano','floor_lava'],['glacier','floor_ice'],['citadel','floor_dungeon']]){
    const state=await evaluate(`(()=>{
      const original=gs.progression.current.themeId;gs.progression.current.themeId=${JSON.stringify(theme)};
      gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.progression.current.themeId=original;
      const f=gs.children.getByName('provided-floor'),p=gs.children.getByName('provided-room-props');
      return{theme:${JSON.stringify(theme)},frame:f.displayFrame.name,width:f.width,height:f.height,bounds:f.getBounds(),
        props:p.list.map(o=>({frame:o.frame.name,interactive:!!o.input,physics:!!o.body,bounds:o.getBounds()}))};
    })()`);
    assert.equal(state.frame,frame);assert.equal(state.width,576);assert.equal(state.height,904);
    assert.ok(state.bounds.x>=64&&state.bounds.y>=170&&state.bounds.x+state.bounds.width<=656&&state.bounds.y+state.bounds.height<=1090);
    assert.equal(state.props.length,5);assert.ok(state.props.every(p=>!p.interactive&&!p.physics));
    assert.ok(state.props.every(p=>p.bounds.x+p.bounds.width<64||p.bounds.x>656),'Props stay outside the walkable arena');
    report.floors.push(state);await shot('battle-'+theme+'-360');
  }
  report.skillStates=[];
  for(const [enabled,remaining]of[[true,0],[true,4000],[false,0]]){
    const skin=await evaluate(`(()=>{gs.activeSkillButton.update(${enabled},${remaining},18000);
      const o=gs.children.getByName('active-skill').getByName('bottom-skin');
      return{width:o.width,height:o.height,frame:o.frame.name};})()`);
    assert.deepEqual(skin,{width:128,height:84,frame:'skill'});report.skillStates.push(skin);
  }
  // The real skill control is verified through GameScene's existing field, not a replacement control.
  const ability=await evaluate(`(()=>{const c=gs.children.getByName('active-skill');
    return c.list.filter(o=>o.texture?.key==='bottom_hud').map(o=>({width:o.width,height:o.height,frame:o.frame.name}));})()`);
  assert.equal(ability.length,1);assert.equal(ability[0].width,128);assert.equal(ability[0].height,84);report.ability=ability;
  await evaluate(`gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.roomState='CLEARED';
    gs.gridManager.getCurrentRoom().cleared=true;gs.squad.roster.minerals=200;gs.openSquadModal('새 자산 정비 화면');undefined;`);
  await waitFor("smash.scene.isActive('SquadScene')");await shot('summon-360');
  assert.equal(await evaluate("smash.scene.getScene('SquadScene').children.getByName('squad-tab-summon').getByName('provided-skin').frame.name"),'tab_selected');
  await click('SquadScene','squad-tab-combine');await shot('combine-360');
  await click('SquadScene','squad-tab-roster');await shot('roster-360');
  await click('SquadScene','squad-close');await waitFor("!smash.scene.isActive('SquadScene')");
  assert.deepEqual(b.errors,[],JSON.stringify(b.errors));report.status='passed';
  await writeFile(output+'/result.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,frames:report.frames.length,themes:report.floors.map(f=>f.frame),ability:report.ability}));
}finally{b.close();}
