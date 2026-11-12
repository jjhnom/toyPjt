import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';

const b=await browserSession(),{evaluate,click,send,waitFor}=b,root=process.env.SMASH_LOBBY_ARTIFACTS??'artifacts/lobby-20261111';
const report={status:'running',screenshots:[],layouts:[]};
const choose=name=>click('MenuScene',name);
const save=()=>evaluate("JSON.parse(localStorage.getItem('smash.run-checkpoint.v1'))");
const capture=async label=>{const png=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(`${root}/${label}.png`,Buffer.from(png.data,'base64'));report.screenshots.push(label+'.png');};
const size=async(width,height=Math.round(width*1280/720))=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(180);};
try{
  await mkdir(root,{recursive:true});
  assert.equal(await evaluate("smash.scene.getScene('MenuScene').textures.get('portrait_lobby_familiar').getContext().getImageData(0,0,1,1).data[3]"),0,
    'Familiar keeps transparent pixels after runtime preparation');
  assert.equal(await evaluate("smash.scene.getScene('MenuScene').textures.exists('art_lobby_familiar_source')"),false);
  const partyArt=await evaluate(`(()=>{
    const scene=smash.scene.getScene('MenuScene'),textures=scene.textures;
    const roles=['summoner','knight','archer','healer','fireMage'];
    const portraits=roles.map(role=>{
      const source=textures.get('portrait_lobby_'+role).getSourceImage();
      const p=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
      let opaque=0,hash=2166136261,left=source.width,top=source.height,right=-1,bottom=-1;
      for(let i=0;i<p.length;i++){hash=Math.imul(hash^p[i],16777619);}
      for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(p[(y*source.width+x)*4+3]>24){
        opaque++;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      return{role,width:source.width,height:source.height,coverage:opaque/(source.width*source.height),
        hash:hash>>>0,left,top,right,bottom};
    });
    const party=scene.children.getByName('lobby-party');
    return{portraits,sourceReleased:!textures.exists('art_lobby_party_source'),
      actors:party.list.filter(o=>o.name.startsWith('lobby-')).map(o=>({name:o.name,key:o.texture.key,bounds:o.getBounds()})),
      profile:scene.children.getByName('lobby-profile-portrait').texture.key};
  })()`);
  assert.equal(partyArt.sourceReleased,true,'Packing atlas is released after creating runtime portraits');
  assert.equal(new Set(partyArt.portraits.map(p=>p.hash)).size,5,'Each role has distinct artwork');
  for(const p of partyArt.portraits){
    assert.equal(p.width,256);assert.equal(p.height,256);
    assert.ok(p.coverage>.1&&p.coverage<.8,JSON.stringify(p));
    assert.ok(p.left>0&&p.top>0&&p.right<255&&p.bottom<255,'Transparent margins preserve whole equipment and feet');
  }
  assert.equal(partyArt.profile,'portrait_lobby_summoner');
  assert.equal(partyArt.actors.length,5);
  for(const actor of partyArt.actors){
    assert.ok(actor.key.startsWith('portrait_lobby_'));
    assert.ok(actor.bounds.x>=0&&actor.bounds.x+actor.bounds.width<=720&&actor.bounds.y>=430
      &&actor.bounds.y+actor.bounds.height<=750,JSON.stringify(actor));
  }
  report.partyArt=partyArt;
  for(const [width,height]of[[720,1280],[360,640],[320,569],[412,915],[960,540]]){
    await size(width,height);await capture(`lobby-${width}x${height}`);
    const layout=await evaluate(`(()=>{const s=smash.scene.getScene('MenuScene'),scale=smash.canvas.getBoundingClientRect().width/720;
      const controls=['new-run','continue-run','legacy-open','legacy-growth-open','codex-open','sound-toggle'];
      const targets=controls.map(name=>{const c=s.children.getByName(name),r=c.getByName('hit').getBounds();
        return{name,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width*scale,height:r.height*scale};});
      const overlap=[];for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
        const a=targets[i],b=targets[j];if(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y)overlap.push([a.name,b.name]);}
      const r=smash.canvas.getBoundingClientRect(),caption=s.children.getByName('save-caption').getBounds();
      return{targets,overlap,inside:targets.every(t=>t.x>=0&&t.right<=720&&t.y>=0&&t.bottom<=1280),
        canvasFits:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,
        captionFits:caption.x>=24&&caption.right<=696&&caption.bottom<=1126};})()`);
    assert.deepEqual(layout.overlap,[]);assert.equal(layout.inside,true);assert.equal(layout.canvasFits,true);assert.equal(layout.captionFits,true);
    if(width!==960)assert.ok(layout.targets.every(t=>t.width>=48&&t.height>=48),JSON.stringify(layout));
    report.layouts.push({width,height,...layout});
  }
  await size(360);const absent=await save();assert.equal(absent,null);
  await choose('continue-run');assert.equal(await evaluate("smash.scene.isActive('MenuScene')"),true);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("smash.scene.getScene('MenuScene').scene.restart({});undefined;");
  await waitFor("smash.scene.getScene('MenuScene').tweens.getTweens().length===0");
  await capture('lobby-reduced-motion-360');
  const sound=await evaluate("smash.scene.getScene('MenuScene').children.getByName('sound-toggle').getByName('label').text");
  await choose('sound-toggle');assert.notEqual(await evaluate("smash.scene.getScene('MenuScene').children.getByName('sound-toggle').getByName('label').text"),sound);
  await choose('sound-toggle');assert.equal(await evaluate("smash.scene.getScene('MenuScene').children.getByName('sound-toggle').getByName('label').text"),sound);
  await choose('legacy-growth-open');await waitFor("smash.scene.isActive('LegacyScene')");
  assert.equal(await evaluate("smash.scene.getScene('LegacyScene').tab"),'growth');
  await click('LegacyScene','legacy-close');await choose('legacy-open');await waitFor("smash.scene.isActive('LegacyScene')");
  assert.equal(await evaluate("smash.scene.getScene('LegacyScene').tab"),'classes');
  await click('LegacyScene','class-select-KNIGHT');await click('LegacyScene','legacy-close');
  assert.equal(await evaluate("smash.scene.getScene('MenuScene').children.getByName('lobby-class').text"),'원정 기사');
  await choose('codex-open');await waitFor("smash.scene.isActive('CodexScene')");await click('CodexScene','codex-close');
  await choose('new-run');await waitFor("smash.scene.isActive('GameScene')");
  const first=await save();assert.equal(first.hero.classId,'KNIGHT');
  await evaluate("window.gs=smash.scene.getScene('GameScene');gs.returnToTitle();undefined;");await waitFor("smash.scene.isActive('MenuScene')");
  await capture('lobby-continue-360');await choose('new-run');
  assert.ok(await evaluate("smash.scene.getScene('MenuScene').children.getByName('new-run-confirmation')!==null"));
  await choose('legacy-growth-open');assert.equal(await evaluate("smash.scene.isActive('LegacyScene')"),false,'Overwrite dialog blocks underlying navigation');
  await capture('lobby-overwrite-360');await click('MenuScene','new-run-cancel');assert.deepEqual(await save(),first);
  await choose('continue-run');await waitFor("smash.scene.isActive('GameScene')");assert.equal((await save()).runId,first.runId);
  await evaluate("gs.returnToTitle();undefined;");await waitFor("smash.scene.isActive('MenuScene')");
  await choose('new-run');await click('MenuScene','new-run-confirm');await waitFor("smash.scene.isActive('GameScene')");
  assert.notEqual((await save()).runId,first.runId,'Explicit new run replaces the checkpoint');
  await evaluate("gs.returnToTitle();undefined;");await waitFor("smash.scene.isActive('MenuScene')");
  await evaluate("localStorage.clear();localStorage.setItem('smash.run-checkpoint.v1','{broken');smash.scene.getScene('MenuScene').scene.restart();undefined;");
  await waitFor("smash.scene.getScene('MenuScene').children.getByName('lobby-class')?.text==='견습 소환사'");await capture('lobby-invalid-360');
  assert.equal(await evaluate("localStorage.getItem('smash.run-checkpoint.v1')"),'{broken');
  assert.ok(await evaluate("smash.scene.getScene('MenuScene').children.getByName('save-caption').text.includes('손상')"));
  await choose('continue-run');assert.equal(await evaluate("smash.scene.isActive('MenuScene')"),true);
  assert.deepEqual(b.errors,[],JSON.stringify(b.errors));report.status='passed';
  report.checks=['portrait/landscape FIT','48px portrait targets / no overlap','real class and shard summary',
    'class/growth/codex navigation','sound toggle','disabled continue','continue/new-run overwrite/cancel',
    'damaged save preserved','reduced motion','five distinct transparent lobby characters / atlas released / party bounds',
    'transparent familiar / source texture released','no runtime exceptions'];
  await writeFile(`${root}/browser-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{b.close();}
