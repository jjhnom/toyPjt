import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {launchChrome,sleep} from '../scripts/lib/chrome-cdp.mjs';
const mode=process.argv[2]??'after',out='artifacts/forest-slam-fit-20261113',b=await launchChrome();
const {send,evaluate,waitFor}=b,report={mode,cases:[],otherMeteors:[]};
try{
 await mkdir(out,{recursive:true});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/'});await waitFor('!!window.bossPreview');
 await evaluate(`window.inspectImages=()=>bossPreview.scene.vfx.slots.filter(s=>s?.active).map(s=>({radius:s.state.radius,x:s.state.x,y:s.state.y,images:[s.floor,s.flare].map(i=>({key:i.texture.key,frame:i.frame.name,visible:i.visible,x:i.x,y:i.y,width:i.displayWidth,height:i.displayHeight,origin:[i.originX,i.originY],alpha:i.alpha,crop:i.isCropped?[i._crop.x,i._crop.y,i._crop.width,i._crop.height]:null,masked:!!i.mask}))}));undefined;`);
 for(const id of ['lava_colossus','twilight_king']){
  await evaluate(`document.querySelector('[data-boss="${id}"]').click();document.querySelector('[data-pattern="METEOR"]').click();undefined;`);
  for(const age of [1000,1120,1240,1360]){await evaluate(`bossPreview.seek(${age})`);report.otherMeteors.push({id,age,images:await evaluate('inspectImages()')});}
 }
 await evaluate(`document.querySelector('[data-boss="forest_guardian"]').click();document.querySelector('[data-pattern="METEOR"]').click();undefined;`);
 for(const phase of [1,2,3])for(const speed of [.25,.5,1,1.5,2]){
  const data=await evaluate(`(()=>{
   document.getElementById('phase').value='${phase}';document.getElementById('phase').dispatchEvent(new Event('change'));
   document.getElementById('speed').value='${[.25,.5,1,2].includes(speed)?speed:1}';document.getElementById('speed').dispatchEvent(new Event('change'));
   bossPreview.seek(0);const s=bossPreview.scene,h=s.hazards.slots.find(h=>h.active),damage=[],samples=[],before=s.hazards.resolve;
   s.hazards.resolve=(...a)=>damage.push({age:h.age,args:a,floorVisible:s.vfx.slots[0].floor.visible});
   const dt=1000/60*${speed};let age=0;
   while(age<1800){const step=Math.min(dt,1800-age);s.vfx.update(step);s.hazards.update(step);age+=step;
    const slot=s.vfx.slots[0];if(slot.active&&h.age>=h.warningMs){const f=slot.floor;
     samples.push({age:h.age,frame:f.frame.name,visible:f.visible,x:f.x,y:f.y,width:f.displayWidth,height:f.displayHeight,origin:[f.originX,f.originY],masked:!!f.mask,decorMasked:!!slot.flare.mask});}
   }
   s.hazards.resolve=before;return{radius:h.radius,warning:h.warningMs,duration:h.duration,damage,samples,active:s.vfx.activeCount};
  })()`);
  assert.equal(data.radius,105);assert.equal(data.warning,1000);assert.equal(data.duration,250);assert.equal(data.damage.length,1);assert.equal(data.active,0);
  assert.ok(data.damage[0].age>=1000&&data.damage[0].age<1000+1000/60*speed+.001);assert.deepEqual(data.damage[0].args.slice(0,4),['METEOR',360,360,105]);
  if(mode==='after')for(const f of data.samples){assert.equal(f.visible,true);assert.equal(f.width,210);assert.equal(f.height,210);assert.equal(f.x,360);assert.equal(f.y,360);assert.deepEqual(f.origin,[.5,.5]);assert.equal(f.masked,true);assert.equal(f.decorMasked,false);assert.ok(f.frame.startsWith('forest_slam_core_'));}
  report.cases.push({phase,speed,...data});
 }
 for(const age of [999,1000,1120,1360]){
  await evaluate(`bossPreview.seek(${age})`);await sleep(60);
  const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${mode}-${age}.png`,Buffer.from(png.data,'base64'));
  const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  report.captureRect=rect;
  const crop=await send('Page.captureScreenshot',{format:'png',clip:{x:rect.x,y:rect.y+rect.height*150/1280,width:rect.width,height:rect.height*450/1280,scale:2}});
  await writeFile(`${out}/${mode}-${age}-detail.png`,Buffer.from(crop.data,'base64'));
 }
 if(mode==='after'){
  const core=await evaluate(`(()=>{const s=bossPreview.scene,rows=[];
   for(const key of ['forest_slam_core_v2','forest_slam_core_v1']){const t=s.textures.get(key),ctx=t.getContext();
   for(const name of t.getFrameNames()){const f=t.get(name),data=ctx.getImageData(f.cutX,f.cutY,96,96).data;let l=96,r=-1,top=96,bottom=-1,out=0;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(data[(y*96+x)*4+3]>64){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(Math.hypot(x+.5-48,y+.5-48)>48.001)out++;}
    rows.push({key,name,l,r,top,bottom,out});}}return rows;})()`);
  assert.equal(core.length,12);for(const f of core){assert.equal(f.out,0);assert.deepEqual([f.l,f.r,f.top,f.bottom],[0,95,0,95]);}report.corePixels=core;
  const debris=await evaluate(`(()=>{const s=bossPreview.scene,rows=[];
   for(const key of ['forest_slam_debris_v2','forest_slam_debris_v1']){const t=s.textures.get(key),ctx=t.getContext();
    for(const name of t.getFrameNames()){const f=t.get(name),d=ctx.getImageData(f.cutX,f.cutY,96,96).data,quadrants=[0,0,0,0];
     for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(d[(y*96+x)*4+3]>32&&Math.hypot(x-48,y-48)>14)quadrants[(y>=48?2:0)+(x>=48?1:0)]++;
     rows.push({key,name,quadrants});}}
   return rows;})()`);
  assert.equal(debris.length,12);for(const f of debris)assert.ok(f.quadrants.every(n=>n>10),`all-around dust ${f.key}/${f.name}: ${f.quadrants}`);report.debrisQuadrants=debris;
  for(const age of [1120,1360]){
   const layer=await evaluate(`(()=>{bossPreview.seek(${age});const s=bossPreview.scene,i=s.vfx.slots[0].flare;return{key:i.texture.key,origin:[i.originX,i.originY],x:i.x,y:i.y,cropped:i.isCropped,aboveBoss:i.depth>s.actor.depth};})()`);
   assert.equal(layer.key,'forest_slam_debris_v2');assert.deepEqual(layer.origin,[.5,.5]);assert.equal(layer.x,360);assert.equal(layer.y,360);assert.equal(layer.cropped,false);assert.equal(layer.aboveBoss,true);
  }
  const legacy=await evaluate(`(()=>{const p=bossPreview,s=p.scene;s.vfx.animated=false;p.seek(1000);const slot=s.vfx.slots[0],result={key:slot.floor.texture.key,visible:slot.floor.visible,width:slot.floor.displayWidth,center:[slot.floor.x,slot.floor.y]};p.seek(p.total);result.active=s.vfx.activeCount;s.vfx.animated=true;return result;})()`);
  assert.deepEqual(legacy,{key:'forest_slam_core_v1',visible:true,width:210,center:[360,360],active:0});report.legacy=legacy;
  const measured=await evaluate(`(async()=>{const {forestSlamVisual}=await import('/src/ui/forestSlamVfx.ts'),s=bossPreview.scene,rows=[];
   for(const animated of [true,false]){const config=forestSlamVisual(animated),atlas=s.textures.get(animated?'boss_vfx_v2':'boss_art_v1');
    for(const [i,rect]of config.footprints.entries()){const f=atlas.get('forest_guardian_impact_'+i),c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');ctx.drawImage(f.source.image,f.cutX,f.cutY,96,96,0,0,96,96);const d=ctx.getImageData(0,0,96,96).data;let left=96,right=-1,bottom=-1;const center=rect[1]+rect[3]/2;
     for(let y=center;y<96;y++)for(let x=0;x<96;x++){const j=(y*96+x)*4;if(d[j+3]>120&&d[j]>200&&d[j+1]>150&&d[j+2]<190){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
     rows.push({animated,i,rect,actual:[left,right-left+1,bottom+1-center]});
    }}return rows;})()`);
  for(const m of measured)assert.deepEqual(m.actual,[m.rect[0],m.rect[2],m.rect[3]/2],`measured footprint ${m.animated}/${m.i}`);report.measuredFootprints=measured;
  const before=JSON.parse(await readFile(`${out}/before-result.json`,'utf8'));assert.deepEqual(report.otherMeteors,before.otherMeteors,'other bosses METEOR render transforms unchanged');
  assert.deepEqual(report.cases.map(({phase,speed,radius,warning,duration,damage})=>({phase,speed,radius,warning,duration,damage})),before.cases.map(({phase,speed,radius,warning,duration,damage})=>({phase,speed,radius,warning,duration,damage})));
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${mode}-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',mode,combinations:report.cases.length,otherMeteorSnapshots:report.otherMeteors.length}));
}finally{b.close();}
