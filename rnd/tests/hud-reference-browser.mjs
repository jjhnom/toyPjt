import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const out='artifacts/hud-reference-20261112',b=await browserSession(),{evaluate,send,click,waitFor}=b;
const report={status:'running',shots:[],reference:'.agent/skills/design/20261112/상단ui.png'};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor("smash.scene.isActive('GameScene')");
 await evaluate(`window.gs=smash.scene.getScene('GameScene');gs.scene.pause();gs.clearEncounter();
  gs.progression.stages=gs.progression.stages.map(s=>({...s,gridWidth:3,gridHeight:3}));gs.progression.index=1;gs.stats.stageIndex=1;
  gs.squad.hero.level=4;gs.squad.hero.xp=54;gs.squad.health.maxHp=115;gs.squad.health.currentHp=71;
  gs.squad.roster.minerals=320;gs.roomState='CLEARED';gs.gridManager.getCurrentRoom().type='COMBAT';
  gs.bannerContainer.setVisible(false);gs.refreshHud();undefined;`);
 await evaluate(`(async()=>{const {setHudText}=await import('/src/ui/battleHudText.ts');
  setHudText(gs.saveStatusText,'자동 저장 · S2',120);})()`);
 const shot=async(name,width)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(160);
  for(const crop of [false,true]){
   const file=`${name}-${width}${crop?'-hud':''}.png`;
   const png=await send('Page.captureScreenshot',{format:'png',...(crop?{clip:{x:0,y:0,width,height:Math.ceil(158*width/720),scale:1}}:{})});
   await writeFile(`${out}/${file}`,Buffer.from(png.data,'base64'));report.shots.push(file);
  }
 };
 const inspect=()=>evaluate(`(()=>{
  const keys=['hudHeroName','hudHeroLevel','hudHpText','hudHeroXpText','hudMineralText','hudStageIndex','hudRoomText','hudRoomBadge','hudWaveText','saveStatusText'];
  const rows=keys.map(key=>({key,text:gs[key].text,r:gs[key].getBounds()})),problems=[];
  for(const {key,r}of rows)if(r.left<20||r.right>590||r.top<12||r.bottom>154)problems.push(key+' outside safe region');
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
   const a=rows[i].r,c=rows[j].r;if(a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top)problems.push(rows[i].key+' / '+rows[j].key);
  }
  return{problems,rows,stageBottom:gs.children.getByName('stage-banner').getBounds().bottom,
   doorTop:gs.doors.top.sprite.getBounds().top,portrait:gs.children.getByName('hero-portrait').texture.key,
   textureFrames:smash.textures.get('reference_hud').getFrameNames(),xpNext:gs.topHud.xp.text,
   arena:[gs.children.getByName('provided-floor').width,gs.children.getByName('provided-floor').height]};})()`);
 report.standard=await inspect();assert.deepEqual(report.standard.problems,[]);
 assert.ok(report.standard.stageBottom<report.standard.doorTop);assert.equal(report.standard.portrait,'portrait_leader_hud');
 assert.deepEqual(report.standard.textureFrames,['top','stage']);assert.deepEqual(report.standard.arena,[576,904]);
 assert.equal(report.standard.xpNext,'54 / 65');
 for(const width of [360,390,720])await shot('matched',width);
 await evaluate(`gs.squad.health.currentHp=99999;gs.squad.health.maxHp=100000;gs.squad.hero.level=19;gs.squad.hero.xp=785;
  gs.squad.roster.minerals=999999;gs.progression.current.name='끝없이 이어지는 독안개 습지와 잊혀진 고대 소환사의 회랑';
  gs.progression.mutation='FIERCE';gs.roomState='LOCKED_WAVES';gs.currentWave=2;gs.totalWavesInRoom=3;gs.refreshHud();undefined;`);
 report.stress=await inspect();assert.deepEqual(report.stress.problems,[],JSON.stringify(report.stress));
 assert.equal(await evaluate('gs.hudMineralText.getData("amount")'),999999);
 const pages=await evaluate(`(()=>{const t=gs.hudRoomText,p=t.getData('pages'),shown=[];
  for(let i=0;i<p.length;i++){shown.push(t.text);gs.stageBanner.advancePages();}return{pages:p,shown,full:t.getData('fullText')};})()`);
 assert.equal(pages.shown.join('').replaceAll(' ',''),pages.full.replaceAll(' ',''));report.pages=pages;
 for(const width of [360,390])await shot('stress',width);
 await evaluate(`gs.squad.hero.level=20;gs.squad.hero.xp=0;gs.squad.health.currentHp=0;gs.squad.roster.minerals=0;
  gs.roomState='ENTERING';gs.progression.current.name='황혼 성채';gs.refreshHud();undefined;`);
 report.zero=await inspect();assert.deepEqual(report.zero.problems,[]);assert.equal(await evaluate('gs.hudHeroXpText.text'),'MAX');
 for(const width of [360,390])await shot('zero-max',width);
 // Phaser's Canvas renderer ignores gradient commands; the base fill must remain a visible live gauge.
 report.canvas=await evaluate(`(async()=>{
  const {HUD_ART}=await import('/src/ui/hudArt.ts'),{PROVIDED_ATLAS}=await import('/src/ui/artAssets.ts');
  const {BattleTopHud}=await import('/src/ui/BattleTopHud.ts');
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:720px;height:1280px';document.body.append(host);
  return await new Promise(resolve=>{new gs.game.constructor({type:1,width:720,height:1280,parent:host,banner:false,
   audio:{noAudio:true},scene:{preload(){this.load.atlas('reference_hud',HUD_ART.image,HUD_ART.data);this.load.atlas('provided_ui',PROVIDED_ATLAS.image,PROVIDED_ATLAS.data);},
    create(){const source=gs.textures.get('portrait_leader_hud').getSourceImage(),copy=document.createElement('canvas');
     copy.width=source.width;copy.height=source.height;copy.getContext('2d').drawImage(source,0,0);this.textures.addCanvas('portrait_leader_hud',copy);
     const hud=new BattleTopHud(this);hud.setHealth(71,115,71/115);hud.setProgress('견습 소환사',4,54,65);hud.setMinerals(320);
     setTimeout(()=>{const ctx=this.game.canvas.getContext('2d'),pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
      const result={renderer:this.game.renderer.type,hp:pixel(170,60),xp:pixel(184,85)};this.game.destroy(true);host.remove();resolve(result);},180);
    }}});});})()`);
 assert.equal(report.canvas.renderer,1);assert.deepEqual(report.canvas.hp,[255,90,101,255]);
 assert.deepEqual(report.canvas.xp,[63,183,255,255]);
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(out+'/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,shots:report.shots.length,stageBottom:report.standard.stageBottom,doorTop:report.standard.doorTop,xp:report.standard.xpNext}));
}finally{b.close();}
