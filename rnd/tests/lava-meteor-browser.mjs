import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {launchChrome,sleep} from '../scripts/lib/chrome-cdp.mjs';
const mode=process.argv[2]??'after',out='artifacts/lava-meteor-20261113',b=await launchChrome();
const {send,evaluate,waitFor}=b,report={mode,cases:[],others:[]};
try{
 await mkdir(out,{recursive:true});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/'});await waitFor('!!window.bossPreview');
 for(const id of ['forest_guardian','twilight_king']){
  await evaluate(`document.querySelector('[data-boss="${id}"]').click();document.querySelector('[data-pattern="METEOR"]').click()`);
  for(const age of [999,1100,1290,1500]){
   const images=await evaluate(`(()=>{bossPreview.seek(${age});return bossPreview.scene.vfx.slots.filter(s=>s?.active).map(s=>[s.floor,s.flare].map(i=>({key:i.texture.key,frame:i.frame.name,x:i.x,y:i.y,w:i.displayWidth,h:i.displayHeight,alpha:i.alpha,visible:i.visible,crop:i.isCropped?[i._crop.x,i._crop.y,i._crop.width,i._crop.height]:null,mask:!!i.mask,origin:[i.originX,i.originY]})));})()`);
   report.others.push({id,age,images});
  }
 }
 await evaluate(`document.querySelector('[data-boss="lava_colossus"]').click();bossPreview.seek(0)`);
 for(const phase of [1,2,3])for(const speed of [.25,.5,1,2]){
  const data=await evaluate(`(()=>{document.getElementById('phase').value='${phase}';document.getElementById('phase').dispatchEvent(new Event('change'));bossPreview.seek(0);
   const s=bossPreview.scene,h=s.hazards.slots.filter(h=>h.active),plan=h.map(h=>({x:h.x,y:h.y,radius:h.radius,warning:h.warningMs,duration:h.duration})),old=s.hazards.resolve,damage=[];
   s.hazards.resolve=(...args)=>damage.push({age:h[0].age,args});let age=0;const dt=1000/60*${speed};
   while(age<1900){const d=Math.min(dt,1900-age);s.vfx.update(d);s.hazards.update(d);age+=d;}
   s.hazards.resolve=old;return{plan,damage,active:s.vfx.activeCount};})()`);
  assert.equal(data.plan.length,3);assert.deepEqual(data.plan.map(p=>p.x),[210,360,510]);assert.ok(data.plan.every(p=>p.radius===65+phase*5&&p.warning===1100&&p.duration===250));
  assert.equal(data.damage.length,3);assert.ok(data.damage.every(d=>d.age===data.damage[0].age&&d.age>=1100&&d.age<1100+1000/60*speed+.001));assert.equal(data.active,0);
  report.cases.push({phase,speed,...data});
 }
 await evaluate(`document.getElementById('phase').value='2';document.getElementById('phase').dispatchEvent(new Event('change'));bossPreview.seek(0)`);
 for(const age of [550,1050,1100,1290,1550,1760]){
  await evaluate(`bossPreview.seek(${age})`);await sleep(50);const rect=await evaluate("document.querySelector('canvas').getBoundingClientRect().toJSON()");
  const png=await send('Page.captureScreenshot',{format:'png',clip:{x:rect.x,y:rect.y+rect.height*380/1280,width:rect.width,height:rect.height*450/1280,scale:2}});
  await writeFile(`${out}/${mode}-${age}.png`,Buffer.from(png.data,'base64'));
 }
 if(mode==='before'){
  const source=await evaluate(`(()=>{const s=bossPreview.scene,t=s.textures.get('boss_vfx_v2'),rows=[],c=document.createElement('canvas');c.width=1152;c.height=480;const ctx=c.getContext('2d');ctx.fillStyle='#161b2c';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;
   for(const [row,kind]of ['fall','impact','field'].entries())for(let i=0;i<8;i++){const f=t.get('lava_colossus_'+kind+'_'+i),tmp=document.createElement('canvas');tmp.width=tmp.height=96;const tc=tmp.getContext('2d');tc.drawImage(f.source.image,f.cutX,f.cutY,96,96,0,0,96,96);const d=tc.getImageData(0,0,96,96).data;let l=96,r=-1,top=96,bottom=-1;for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(d[(y*96+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}rows.push({kind,i,canvas:[96,96],bounds:[l,top,r-l+1,bottom-top+1],origin:[.5,76/96]});ctx.drawImage(tmp,i*144,row*160+22,144,144);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(kind+' '+i+' '+[l,top,r-l+1,bottom-top+1],i*144+2,row*160+16);}
   return{rows,png:c.toDataURL('image/png').split(',')[1]};})()`);
  await writeFile(`${out}/source-frames.png`,Buffer.from(source.png,'base64'));await writeFile(`${out}/source-bounds.json`,JSON.stringify(source.rows,null,2));
 }else{
  const baseline=JSON.parse(await readFile(`${out}/before-result.json`,'utf8'));assert.deepEqual(report.cases,baseline.cases);assert.deepEqual(report.others,baseline.others);
  const checks=await evaluate(`(()=>{const s=bossPreview.scene,rows=[];for(const phase of [1,2,3]){document.getElementById('phase').value=String(phase);document.getElementById('phase').dispatchEvent(new Event('change'));bossPreview.seek(1290);rows.push(...s.vfx.slots.filter(v=>v?.active).map(v=>({phase,r:v.state.radius,x:v.floor.x,y:v.floor.y,ox:v.floor.originX,oy:v.floor.originY,w:v.floor.displayWidth,h:v.floor.displayHeight,frame:v.floor.frame.name,key:v.floor.texture.key,mask:!!v.floor.mask})));}return rows;})()`);
  assert.equal(checks.length,9);for(const c of checks){assert.ok(Math.abs(c.w*60/64-2*c.r)<.001);assert.ok(Math.abs(c.h*60/64-2*c.r)<.001);assert.equal(c.y,630);assert.equal(c.ox,.5);assert.equal(c.oy,.5);assert.equal(c.key,'lava_meteor_v1');assert.ok(c.mask);}report.geometry=checks;
  const pixels=await evaluate(`(()=>{const t=bossPreview.scene.textures.get('lava_meteor_v1'),ctx=t.getContext(),rows=[];
   for(let v=0;v<3;v++){const f=t.get('lava_ground_'+v+'_7'),d=ctx.getImageData(f.cutX,f.cutY,64,64).data;let l=64,r=-1,top=64,bottom=-1,out=0;
    for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(d[(y*64+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(Math.hypot(x+.5-32,y+.5-32)>30.001)out++;}rows.push({v,bounds:[l,top,r-l+1,bottom-top+1],out});}return rows;})()`);
  for(const p of pixels){assert.deepEqual(p.bounds,[2,2,60,60]);assert.equal(p.out,0);}report.effectiveBounds=pixels;
  for(const age of [949,1100,1450,1750]){
   const v=await evaluate(`(()=>{bossPreview.seek(${age});return bossPreview.scene.vfx.slots.filter(s=>s?.active).map(s=>({floor:s.floor.visible,air:s.flare.visible,frame:s.flare.frame.name}));})()`);
   if(age===949)assert.ok(v.every(s=>!s.floor&&!s.air));if(age===1100)assert.ok(v.every(s=>s.air&&s.frame.startsWith('lava_air_')));if(age===1450)assert.ok(v.every(s=>!s.air));if(age===1750)assert.equal(v.length,0);
  }
  const counts=await evaluate(`(()=>{const s=bossPreview.scene;bossPreview.seek(1290);const n=s.children.length;for(let i=0;i<30;i++){bossPreview.seek(1200);bossPreview.seek(1800);}return[n,s.children.length,s.vfx.activeCount];})()`);
  assert.equal(counts[0],counts[1]);assert.equal(counts[2],0);report.pool=counts;
  const repeat=await evaluate(`(()=>{const sample=()=>bossPreview.scene.vfx.slots.filter(s=>s?.active).map(s=>[s.floor.frame.name,s.flare.frame.name,s.floor.x,s.floor.y,s.floor.displayWidth]);bossPreview.seek(1290);const first=sample();bossPreview.seek(550);bossPreview.seek(1290);return[first,sample()];})()`);assert.deepEqual(repeat[0],repeat[1]);
  for(const width of [360,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*1280/720)+1100,deviceScaleFactor:1,mobile:true});await evaluate('bossPreview.seek(1290)');await sleep(100);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/mobile-${width}.png`,Buffer.from(png.data,'base64'));}
  if(process.argv.includes('--videos'))for(const speed of [1,.25]){
   const video=await evaluate(`(async()=>{document.getElementById('phase').value='2';document.getElementById('phase').dispatchEvent(new Event('change'));document.getElementById('loop').checked=false;document.getElementById('speed').value='${speed}';document.getElementById('speed').dispatchEvent(new Event('change'));bossPreview.seek(0);const stream=document.querySelector('canvas').captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();document.getElementById('replay').click();const start=performance.now();while(bossPreview.elapsed<bossPreview.total&&performance.now()-start<25000)await new Promise(r=>setTimeout(r,100));await new Promise(r=>setTimeout(r,180));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});})()`);
   const bytes=Buffer.from(video,'base64');assert.ok(bytes.length>1000);assert.equal(await evaluate('bossPreview.elapsed===bossPreview.total'),true,'recording includes the entire effect and cleanup');await writeFile(`${out}/lava-${speed}x.webm`,bytes);
  }
 }
 assert.deepEqual(b.errors,[]);report.status='passed';await writeFile(`${out}/${mode}-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',mode,cases:report.cases.length}));
}finally{b.close();}
