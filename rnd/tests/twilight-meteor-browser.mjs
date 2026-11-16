import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {launchChrome,sleep} from '../scripts/lib/chrome-cdp.mjs';
const mode=process.argv[2]??'after',out='artifacts/twilight-meteor-20261113',b=await launchChrome(),report={mode,cases:[],others:[]};
const {send,evaluate,waitFor}=b;
try{
 await mkdir(out,{recursive:true});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=twilight_king&pattern=METEOR'});await waitFor('!!window.bossPreview');
 assert.deepEqual(await evaluate('bossPreview.selection'),{id:'twilight_king',sequence:0,phase:2});
 await evaluate(`window.sampleVfx=()=>bossPreview.scene.vfx.slots.filter(s=>s?.active).map(s=>[s.floor,s.flare].map(i=>({key:i.texture.key,frame:i.frame.name,x:i.x,y:i.y,w:i.displayWidth,h:i.displayHeight,origin:[i.originX,i.originY],alpha:i.alpha,visible:i.visible,mask:!!i.mask})));undefined;`);
 for(const id of ['lava_colossus','forest_guardian','twilight_king']){
  await evaluate(`document.querySelector('[data-boss="${id}"]').click()`);
  for(const kind of id==='twilight_king'?['POISON','CHARGE','FROST','SUMMON']:['METEOR']){
   await evaluate(`document.querySelector('[data-pattern="${kind}"]').click()`);
   for(const age of [950,1000,1190,1450]){await evaluate(`bossPreview.seek(${age})`);report.others.push({id,kind,age,images:await evaluate('sampleVfx()')});}
  }
 }
 await evaluate(`document.querySelector('[data-boss="twilight_king"]').click();document.querySelector('[data-pattern="METEOR"]').click()`);
 for(const phase of [1,2,3])for(const speed of [.25,.5,1,2]){
  const row=await evaluate(`(()=>{document.getElementById('phase').value='${phase}';document.getElementById('phase').dispatchEvent(new Event('change'));bossPreview.seek(0);const s=bossPreview.scene,slots=s.hazards.slots.filter(h=>h.active),old=s.hazards.resolve,damage=[];
   const plan=slots.map(h=>({x:h.x,y:h.y,r:h.radius,warning:h.warningMs,duration:h.duration}));s.hazards.resolve=(...args)=>damage.push({age:slots[0].age,args});let age=0,dt=1000/60*${speed};while(age<1800){const d=Math.min(dt,1800-age);s.vfx.update(d);s.hazards.update(d);age+=d;}s.hazards.resolve=old;return{plan,damage,active:s.vfx.activeCount};})()`);
  assert.deepEqual(row.plan.map(p=>[p.x,p.y,p.r,p.warning,p.duration]),[[360,480,65,1000,250],[360,780,65,1000,250],[210,630,65,1000,250],[510,630,65,1000,250]]);
  assert.equal(row.damage.length,4);assert.ok(row.damage.every(d=>d.age===row.damage[0].age&&d.age>=1000));assert.equal(row.active,0);report.cases.push({phase,speed,...row});
 }
 for(const age of [500,950,1000,1190,1450,1660]){
  await evaluate(`bossPreview.seek(${age})`);await sleep(50);const r=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const png=await send('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y+r.height*250/1280,width:r.width,height:r.height*680/1280,scale:2}});await writeFile(`${out}/${mode}-${age}.png`,Buffer.from(png.data,'base64'));
 }
 const lava=await evaluate(`(()=>{const t=bossPreview.scene.textures.get('lava_meteor_v1'),c=t.getContext(),d=c.getImageData(0,0,t.width,t.height).data;let hash=2166136261;for(const n of d)hash=Math.imul(hash^n,16777619)>>>0;return hash;})()`);report.lavaHash=lava;
 if(mode==='after'){
  const before=JSON.parse(await readFile(`${out}/before-result.json`,'utf8'));assert.deepEqual(report.cases,before.cases);assert.deepEqual(report.others,before.others);assert.equal(lava,before.lavaHash);
  const pixels=await evaluate(`(()=>{const s=bossPreview.scene,a=s.textures.get('lava_meteor_v1'),t=s.textures.get('twilight_meteor_v1'),d=t.getContext().getImageData(0,0,t.width,t.height).data,base=a.getContext().getImageData(0,0,a.width,a.height).data;let alphaMismatch=0,purple=0,blue=0;for(let p=0;p<d.length;p+=4){if(d[p+3]!==base[p+3])alphaMismatch++;if(d[p+3]>32){if(d[p]>d[p+1]*1.3&&d[p+2]>d[p+1]*1.3)purple++;if(d[p+2]>d[p]*1.3&&d[p+1]>d[p]*1.1)blue++;}}return{alphaMismatch,purple,blue,frames:t.getFrameNames().length};})()`);
  assert.equal(pixels.alphaMismatch,0);assert.equal(pixels.frames,102);assert.ok(pixels.purple>1000);assert.equal(pixels.blue,0);report.pixels=pixels;
  await evaluate('bossPreview.seek(1190)');const geometry=await evaluate('sampleVfx()');for(const pair of geometry){assert.equal(pair[0].key,'twilight_meteor_v1');assert.ok(Math.abs(pair[0].w*60/64-130)<.001);assert.deepEqual(pair[0].origin,[.5,.5]);}report.geometry=geometry;
  for(const width of [360,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1700,deviceScaleFactor:1,mobile:true});await sleep(80);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/mobile-${width}.png`,Buffer.from(png.data,'base64'));}
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${mode}-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',mode,combinations:report.cases.length,unchangedSnapshots:report.others.length}));
}finally{b.close();}
