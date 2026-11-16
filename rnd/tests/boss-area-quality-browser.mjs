import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {launchChrome,sleep} from '../scripts/lib/chrome-cdp.mjs';
const mode=process.argv[2]??'after',out=process.env.SMASH_QUALITY_OUT??'artifacts/boss-area-quality-20261113',b=await launchChrome(),report={mode,cases:[],audit:[]};
const {send,evaluate,waitFor}=b;
try{
 await mkdir(out,{recursive:true});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173/tools/boss-skill-preview/'});await waitFor('!!window.bossPreview');
 const ids=await evaluate("[...document.querySelectorAll('[data-boss]')].map(e=>e.dataset.boss)");
 for(const id of ids){
  await evaluate(`document.querySelector('[data-boss="${id}"]').click()`);
  const kinds=await evaluate("[...document.querySelectorAll('[data-pattern]')].map(e=>e.dataset.pattern).filter(k=>k!=='CHARGE')");
  for(const kind of kinds){
   await evaluate(`document.querySelector('[data-pattern="${kind}"]').click()`);
   for(const phase of [1,2,3])for(const speed of [.25,.5,1,2]){
    const data=await evaluate(`(()=>{document.getElementById('phase').value='${phase}';document.getElementById('phase').dispatchEvent(new Event('change'));bossPreview.seek(0);const s=bossPreview.scene,h=s.hazards.slots.filter(h=>h.active),old=s.hazards.resolve,events=[];
     const plan=h.map(h=>({kind:h.kind,x:h.x,y:h.y,r:h.radius,w:h.warningMs,d:h.duration}));s.hazards.resolve=(...args)=>events.push([h[0].age,...args]);let age=0,dt=1000/60*${speed};while(age<4500){const d=Math.min(dt,4500-age);s.vfx.update(d);s.hazards.update(d);age+=d;}s.hazards.resolve=old;return{plan,events,active:s.vfx.activeCount};})()`);
    assert.equal(data.active,0);report.cases.push({id,kind,phase,speed,...data});
   }
   const audit=await evaluate(`(()=>{document.getElementById('phase').value='2';document.getElementById('phase').dispatchEvent(new Event('change'));bossPreview.seek(${kind==='POISON'||kind==='FROST'?1700:id==='lava_colossus'?1290:1190});const s=bossPreview.scene,slot=s.vfx.slots.find(s=>s?.active),floor=slot.floor;
    return{atlas:floor.texture.key,frame:floor.frame.name,source:[floor.frame.cutWidth,floor.frame.cutHeight],display:[floor.displayWidth,floor.displayHeight],origin:[floor.originX,floor.originY],x:floor.x,y:floor.y,r:slot.state.radius,masked:!!floor.mask,filter:floor.frame.source.glTexture?.magFilter,actorFilter:s.actor.frame.source.glTexture?.magFilter,actorSource:[s.actor.frame.cutWidth,s.actor.frame.cutHeight],css:getComputedStyle(document.querySelector('canvas')).imageRendering};})()`);
   report.audit.push({id,kind,...audit});
   if(mode==='after'){assert.equal(audit.source[0],192);assert.equal(audit.source[1],192);assert.deepEqual(audit.origin,[.5,.5]);assert.equal(audit.display[0],audit.r*2);assert.equal(audit.display[1],audit.r*2);assert.equal(audit.filter,9729);assert.equal(audit.actorFilter,9728);assert.equal(audit.masked,true);assert.equal(audit.css,'auto');}
   await sleep(50);const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
   const png=await send('Page.captureScreenshot',{format:'png',clip:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,scale:2}});await writeFile(`${out}/${mode}-${id}-${kind}.png`,Buffer.from(png.data,'base64'));
  }
 }
 report.materialHashes=await evaluate(`(()=>{const rows={};for(const style of ['earth','poison','ice','fire','dark','binding','frost','void','sand']){const t=bossPreview.scene.textures.get('boss_ground_hd_'+style),d=t.getContext().getImageData(0,0,t.width,t.height).data;let hash=2166136261;for(const n of d)hash=Math.imul(hash^n,16777619)>>>0;rows[style]=hash;}return rows;})()`);
 report.unchangedMaterials=Object.fromEntries(['earth','ice','fire','dark'].map(k=>[k,report.materialHashes[k]]));
 if(mode==='after'){
  const before=JSON.parse(await readFile(`${out}/before-result.json`,'utf8'));
  if(process.env.SMASH_NEW_BOSS_CHECK==='1'){
   assert.deepEqual(report.cases.filter(r=>r.id!=='desert_emperor'),before.cases);
   for(const [style,hash]of Object.entries(before.materialHashes))assert.equal(report.materialHashes[style],hash,style+' retains its artwork');
  }else assert.deepEqual(report.cases,before.cases);
  if(process.env.SMASH_IDENTITY_CHECK==='1')assert.deepEqual(report.unchangedMaterials,before.unchangedMaterials);
  if(process.env.SMASH_REFERENCE_CHECK==='1')for(const style of ['poison','binding','ice','dark'])assert.equal(report.materialHashes[style],before.materialHashes[style],style+' retains its original artwork');
  if(process.env.SMASH_BINDING_CHECK==='1')for(const style of ['earth','poison','ice','fire','dark','frost','void'])assert.equal(report.materialHashes[style],before.materialHashes[style],style+' retains its original artwork');
  const counts=await evaluate(`(()=>{const s=bossPreview.scene;bossPreview.seek(1190);const n=s.children.length;for(let i=0;i<20;i++){bossPreview.seek(1400);bossPreview.seek(4500);}return[n,s.children.length,s.vfx.activeCount,s.vfx.slots.filter(s=>s?.detail?.visible).length];})()`);
  assert.equal(counts[0],counts[1]);assert.equal(counts[2],0);assert.equal(counts[3],0);report.pool=counts;
  const resources=await evaluate(`(()=>{const s=bossPreview.scene,rows=[];for(const style of ['earth','poison','ice','fire','dark','binding','frost','void','sand']){const t=s.textures.get('boss_ground_hd_'+style),img=t.getSourceImage(),exports={};for(const layer of ['ground_0','motes_0']){const f=t.get(layer),c=document.createElement('canvas');c.width=c.height=192;c.getContext('2d').drawImage(img,f.cutX,f.cutY,192,192,0,0,192,192);exports[layer]=c.toDataURL('image/png').split(',')[1];}rows.push({style,width:img.width,height:img.height,frames:t.getFrameNames().length,exports});}return rows;})()`);
  for(const r of resources){assert.ok(r.width<=1024&&r.height<=1024);assert.equal(r.frames,r.style==='frost'?25:(r.style==='binding'||r.style==='poison')?24:r.style==='sand'?20:r.style==='ice'?16:17);for(const [layer,data]of Object.entries(r.exports))await writeFile(`${out}/resource-${r.style}-${layer}.png`,Buffer.from(data,'base64'));delete r.exports;}report.resources=resources;report.cacheBytes=resources.reduce((n,r)=>n+r.width*r.height*4,0);
  if(process.env.SMASH_IDENTITY_CHECK==='1'){
   const identity=await evaluate(`(()=>{const s=bossPreview.scene,images=[];for(const style of ['poison','binding']){const t=s.textures.get('boss_ground_hd_'+style),f=t.get('ground_0');images.push(t.getContext().getImageData(f.cutX,f.cutY,192,192));}let intersection=0,union=0;for(let p=3;p<images[0].data.length;p+=4){const a=images[0].data[p]>64,b=images[1].data[p]>64;if(a||b)union++;if(a&&b)intersection++;}const c=document.createElement('canvas');c.width=432;c.height=232;const ctx=c.getContext('2d');ctx.fillStyle='#12152f';ctx.fillRect(0,0,432,232);for(let i=0;i<2;i++){const d=images[i];for(let p=0;p<d.data.length;p+=4){const y=Math.round(.2126*d.data[p]+.7152*d.data[p+1]+.0722*d.data[p+2]);d.data[p]=d.data[p+1]=d.data[p+2]=y;}const tmp=document.createElement('canvas');tmp.width=tmp.height=192;tmp.getContext('2d').putImageData(d,0,0);ctx.drawImage(tmp,16+i*208,28);ctx.fillStyle='#ede6ff';ctx.font='13px sans-serif';ctx.fillText(i?'BINDING':'POISON',16+i*208,18);}return{iou:intersection/union,png:c.toDataURL('image/png').split(',')[1]};})()`);
   assert.ok(identity.iou<.6,'identities must differ by alpha silhouette rather than palette alone');await writeFile(`${out}/identity-grayscale.png`,Buffer.from(identity.png,'base64'));delete identity.png;report.identity=identity;
   for(const [id,kind]of [['swamp_lord','POISON'],['twilight_king','FROST']]){
    await evaluate(`document.querySelector('[data-boss="${id}"]').click();document.querySelector('[data-pattern="${kind}"]').click()`);
    for(const age of [800,1000,1120,1360,1900]){await evaluate(`bossPreview.seek(${age})`);await sleep(40);const r=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");const png=await send('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y+r.height*320/1280,width:r.width,height:r.height*610/1280,scale:2}});await writeFile(`${out}/motion-${id}-${age}.png`,Buffer.from(png.data,'base64'));}
   }
  }
  assert.equal(await evaluate("['boss_ground_v2','forest_slam_core_v2','lava_meteor_v1','twilight_meteor_v1'].some(k=>bossPreview.scene.textures.exists(k))"),false,'HD mode avoids allocating obsolete fallback atlases');
  for(const width of [360,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1700,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('[data-boss=\"frost_queen\"]').click();document.querySelector('[data-pattern=\"FROST\"]').click();bossPreview.seek(1700)");await sleep(100);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/mobile-${width}.png`,Buffer.from(png.data,'base64'));}
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${mode}-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',mode,cases:report.cases.length,patterns:report.audit.length}));
}finally{b.close();}


