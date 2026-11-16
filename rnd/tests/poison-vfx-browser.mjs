import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchChrome} from '../scripts/lib/chrome-cdp.mjs';
const out='artifacts/poison-vfx-20261116',b=await launchChrome();
try{
 await mkdir(out,{recursive:true});
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=swamp_lord&pattern=POISON'});
 await b.waitFor('!!window.bossPreview');
 const results=[];
 for(const id of ['swamp_lord','twilight_king']){
  await b.evaluate(`document.querySelector('[data-boss="${id}"]').click();document.querySelector('[data-pattern="POISON"]').click()`);
  const row=await b.evaluate(`(()=>{
   const p=bossPreview,s=p.scene,w=${id==='swamp_lord'?1000:1000},frames=[];
   for(const dt of [0,180,360,1440,2040,2220]){
    p.seek(w+dt);const slots=s.vfx.slots.filter(v=>v?.active);
    frames.push(slots[0].flare.frame.name);
    if(!slots.every(v=>v.floor.x===v.state.x&&v.floor.y===v.state.y&&v.floor.displayWidth===v.state.radius*2&&v.flare.mask===v.mask))throw Error('Misaligned poison');
   }
   const count=s.children.length;
   for(let i=0;i<15;i++){p.seek(1180);p.seek(p.total);}
   const t=s.textures.get('boss_ground_hd_poison');
   return {frames,same:count===s.children.length,active:s.vfx.activeCount,failed:s.hazards.visualFailed,width:t.getSourceImage().width,height:t.getSourceImage().height,count:t.getFrameNames().length};
  })()`);
  assert.deepEqual(row.frames,['motes_0','motes_2','motes_4','motes_4','release_0','release_2']);
  assert.equal(row.same,true);assert.equal(row.active,0);assert.equal(row.failed,false);assert.equal(row.count,24);assert.ok(row.width<=1024&&row.height<=1024);
  results.push({id,...row});
 }
 const board=await b.evaluate(`(()=>{
  const t=bossPreview.scene.textures.get('boss_ground_hd_poison'),c=document.createElement('canvas');c.width=1040;c.height=240;
  const ctx=c.getContext('2d');ctx.fillStyle='#151d2d';ctx.fillRect(0,0,c.width,c.height);
  for(const [i,keys]of [['intro_2'],['ground_0','motes_1'],['ground_3','motes_4'],['ground_6','release_0'],['ground_7','release_2']].entries()){
   for(const k of keys){const f=t.get(k);ctx.drawImage(f.source.image,f.cutX,f.cutY,192,192,8+i*208,32,192,192);}
   ctx.fillStyle='#d5f7aa';ctx.font='14px sans-serif';ctx.fillText(['SPREAD','TOXIC SPLASH','BUBBLES / MIST','RELEASE','DISSIPATE'][i],8+i*208,20);
  }
  return c.toDataURL('image/png').split(',')[1];
 })()`);
 await writeFile(out+'/sequence.png',Buffer.from(board,'base64'));
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate(`document.querySelector('[data-boss="swamp_lord"]').click();bossPreview.seek(1180)`);
 const png=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(png.data,'base64'));
 assert.deepEqual(b.errors,[]);await writeFile(out+'/result.json',JSON.stringify(results,null,2));console.log(JSON.stringify({status:'passed',results}));
}finally{b.close();}
