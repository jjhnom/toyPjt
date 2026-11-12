import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserSession,sleep} from './helpers/browser-session.mjs';
const phase=process.argv[2]??'after',out='artifacts/skill-vfx-20261112';
const b=await browserSession(),{evaluate,send,click,waitFor}=b,report={phase,shots:[]};
try{
 await mkdir(out,{recursive:true});await click('MenuScene','new-run');await waitFor('smash.scene.isActive("GameScene")');
 await evaluate('window.gs=smash.scene.getScene("GameScene");gs.scene.pause();gs.clearEncounter();gs.bannerContainer.setVisible(false);undefined;');
 const shot=async(name,width)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720),deviceScaleFactor:1,mobile:true});await sleep(160);
  const png=await send('Page.captureScreenshot',{format:'png'}),file=`${phase}-${name}-${width}.png`;
  await writeFile(`${out}/${file}`,Buffer.from(png.data,'base64'));report.shots.push(file);
 };
 for(const page of [0,1,2]){
  await evaluate(`(async()=>{
   window.vfxBoard?.destroy(true);vfxBoard=gs.add.container(0,0).setDepth(1000);
   const add=o=>{vfxBoard.add(o);return o;},text=(x,y,s,size=22)=>add(gs.add.text(x,y,s,{fontFamily:'Malgun Gothic',fontSize:size+'px',color:'#ede6ff',resolution:2}));
   add(gs.add.rectangle(360,640,720,1280,0x12152f));text(24,20,'스킬 VFX · 실제 런타임 텍스처',28);
   const {UNIT_COMBAT_STYLES}=await import('/src/config/skillData.ts');
   const pages=[['arrow','streak','fire','frost','star','void','bolt'],['stone','leaf','slash','thorn','poison','holy','feather'],['heal','shield','buff','rune','slow','poison_support']];
   const types=pages[${page}];text(24,60,'투사체 / 심볼 / 웨이브 · 검증용 보드',18);
   types.forEach((shape,i)=>{const y=160+i*160,unit=Object.keys(UNIT_COMBAT_STYLES).find(u=>UNIT_COMBAT_STYLES[u].shape===shape);
    add(gs.add.rectangle(360,y+30,680,146,0x21172f));text(30,y-38,shape);
    const fallback=shape==='poison_support'?'skill_poison':'skill_'+shape;
    const key=unit?'skill_projectile_'+unit:gs.textures.exists(fallback)?fallback:'skill_glyph_'+shape;
    const color=unit?(shape==='bolt'?0x3fb7ff:UNIT_COMBAT_STYLES[unit].color):shape==='heal'?0x79d842:shape==='buff'?0xffb55a:shape==='poison_support'?0x79d842:shape==='rune'?0xb78cff:0x9ceeff;
    add(gs.add.image(150,y+30,gs.textures.exists(key)?key:'skill_glyph_star').setTint(unit?0xffffff:color).setDisplaySize(64,64));
    const glyph='skill_glyph_'+shape,wave='skill_wave_'+shape;
    add(gs.add.image(340,y+30,gs.textures.exists(glyph)?glyph:gs.textures.exists(fallback)?fallback:'skill_glyph_star')
     .setTint(unit?(shape==='bolt'?0xc5f6ff:UNIT_COMBAT_STYLES[unit].accent):color).setDisplaySize(64,64));
    add(gs.add.image(560,y+30,gs.textures.exists(wave)?wave:'tex_ring').setTint(color).setDisplaySize(96,${page}===2?44:96));
   });undefined;})()`);
  for(const width of [360,390,720])await shot('board-'+page,width);
 }
 await evaluate(`vfxBoard.destroy(true);window.vfxBoard=null;gs.squad.roster.minerals=50000;
  for(const id of ['ROCKET_BOT','STUN_BOT','WORLD_DRUID','EARTH_DEITY'])gs.squad.roster.summon(id);
  gs.squad.syncRoster();gs.squad.setPositionImmediate(360,750);gs.squad.drones.forEach((d,i)=>d.setPosition(180+(i%3)*175,650+Math.floor(i/3)*170));
  gs.roomState='LOCKED_WAVES';gs.drawArenaForRoom(gs.gridManager.getCurrentRoom());gs.refreshHud();
  gs.particles.clear(true,true);gs.particles.beginFrame();
  ['ROCKET_BOT','STUN_BOT','CHAIN_LIGHTNING','BLACKHOLE_MISSILE'].forEach((u,i)=>{
   const x=220+i%2*280,y=340+Math.floor(i/2)*220;gs.particles.emitExplosion(u,x,y,70);gs.particles.emitHit(u,x,y);});
  gs.particles.emitSkill('heal',180,750,'WORLD_DRUID');gs.particles.emitSkill('shield',360,750,'EARTH_DEITY');
  gs.particles.emitSkill('poison',520,750,'THORN_GUARD');for(const p of gs.particles.getChildren())p.update(0,70);undefined;`);
 for(const width of [360,390,720])await shot('battle',width);
 report.textures=await evaluate(`(async()=>{
  const {UNIT_COMBAT_STYLES}=await import('/src/config/skillData.ts');
  const keys=Object.keys(UNIT_COMBAT_STYLES).map(u=>'skill_projectile_'+u),out=[];
  for(const key of keys){const image=gs.textures.get(key).getSourceImage(),data=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
   let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i])opaque++;
   out.push({key,w:image.width,h:image.height,opaque,corners:[data[3],data[(image.width-1)*4+3],data[data.length-1]]});}
  return out;})()`);
 assert.equal(report.textures.length,22);for(const t of report.textures){assert.equal(t.w,32);assert.equal(t.h,32);assert.ok(t.opaque>20);}
 report.textureBudget=await evaluate(`(()=>{const keys=gs.textures.getTextureKeys().filter(k=>k.startsWith('skill_'));
  return{count:keys.length,rgbaBytes:keys.reduce((n,k)=>{const s=gs.textures.get(k).getSourceImage();return n+s.width*s.height*4;},0)};})()`);
 const state=await evaluate(`(()=>{
  gs.particles.clear(true,true);for(let i=0;i<200;i++)gs.particles.emitExplosion('ROCKET_BOT',360,650,70);
  const count=gs.particles.getLength(),active=gs.particles.countActive(true);for(const p of gs.particles.getChildren())p.update(0,2000);
  const expired=gs.particles.countActive(true);gs.particles.emitCast('STUN_BOT',360,650,0);
  const reused=gs.particles.getLength()===count;gs.particles.clear(true,true);gs.particles.beginFrame();
  for(let i=0;i<100;i++)gs.particles.emitTrail('ROCKET_BOT',360,650,0);
  return{count,active,expired,reused,trails:gs.particles.countActive(true),body:gs.squad.leader.body.width};})()`);
 assert.ok(state.count<=120&&state.active<=120);assert.equal(state.expired,0);assert.equal(state.reused,true);assert.ok(state.trails<=12);assert.equal(state.body,36);report.pool=state;
 if(phase==='after'){
  const textureCheck=await evaluate(`(()=>{
   const shapes=['arrow','streak','fire','frost','star','void','bolt','stone','leaf','slash','thorn','poison','holy','feather','heal','shield','buff','rune','slow','poison_support'];
   return shapes.map(shape=>{const glyph=gs.textures.get('skill_glyph_'+shape).getSourceImage(),wave=gs.textures.get('skill_wave_'+shape).getSourceImage();
    const data=wave.getContext('2d').getImageData(0,0,96,96).data;let outside=0;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(Math.hypot(x+.5-48,y+.5-48)>43&&data[(y*96+x)*4+3])outside++;
    return{shape,glyph:[glyph.width,glyph.height],wave:[wave.width,wave.height],outside};});})()`);
  for(const t of textureCheck){assert.deepEqual(t.glyph,[32,32]);assert.deepEqual(t.wave,[96,96]);assert.equal(t.outside,0,t.shape);}
  report.shapes=textureCheck;
  const reset=await evaluate(`(()=>{gs.particles.clear(true,true);gs.particles.emitSkill('heal',300,600,'WORLD_DRUID');
   const p=gs.particles.getChildren().find(p=>p.isRing);p.update(0,80);const flat=p.scaleY/p.scaleX;
   p.launchShockwave(300,600,70,0xffffff,'skill_wave_fire');p.update(0,80);const round=p.scaleY/p.scaleX;
   p.launchLine(100,200,200,200,0xffffff,3);p.update(0,30);const line=p.isLine;
   gs.particles.clear(true,true);gs.particles.emitSkill('shield',300,600,'EARTH_DEITY');
   const dome=gs.particles.getChildren().find(p=>p.active&&p.texture.key==='skill_glyph_shield');
   const shieldBefore=dome.displayWidth;dome.update(0,50);return{flat,round,line,shieldBefore,shieldAfter:dome.displayWidth};})()`);
  assert.ok(reset.flat<.7);assert.equal(reset.round,1);assert.equal(reset.line,true);
  assert.equal(reset.shieldBefore,58);assert.ok(reset.shieldAfter>50,'Shield must not jump back to the old 26px startScale');report.reset=reset;
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${phase}-result.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({phase,status:report.status,shots:report.shots.length,pool:report.pool}));
}finally{b.close();}
