import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchChrome} from '../scripts/lib/chrome-cdp.mjs';
const out='artifacts/frost-queen-impact-v2-20261116',b=await launchChrome();
try{
 await mkdir(out,{recursive:true});
 await b.send('Page.navigate',{url:(process.env.SMASH_TEST_URL??'http://127.0.0.1:5173/')+'tools/boss-skill-preview/?boss=frost_queen&pattern=FROST'});
 await b.waitFor('!!window.bossPreview');
 const impact=await b.evaluate(`(()=>{bossPreview.seek(1100);const s=bossPreview.scene.vfx.slots.find(v=>v?.active);return{alpha:s.flare.alpha,frame:s.flare.frame.name};})()`);
 assert.equal(impact.alpha,1);assert.equal(impact.frame,'motes_0');
 const rows=[];
 for(const time of [400,1000,1280,1600,2940,3120]){
  const row=await b.evaluate(`(()=>{
   bossPreview.seek(${time});const s=bossPreview.scene;
   const v=s.vfx.slots.filter(v=>v?.active);
   return {time:${time},count:v.length,floor:v[0].floor.frame.name,air:v[0].flare.frame.name,
    aligned:v.every(v=>v.floor.x===v.state.x&&v.floor.y===v.state.y&&v.floor.displayWidth===v.state.radius*2&&v.flare.mask===v.mask),failed:s.hazards.visualFailed};
  })()`);
  assert.equal(row.count,4);assert.equal(row.aligned,true);assert.equal(row.failed,false);rows.push(row);
 }
 assert.equal(rows[0].floor,'intro_0');assert.equal(rows[1].floor,'intro_3');
 assert.equal(rows[2].air,'motes_2');assert.equal(rows[4].air,'release_0');assert.equal(rows[5].air,'release_2');
 const board=await b.evaluate(`(()=>{
  const t=bossPreview.scene.textures.get('boss_ground_hd_frost'),c=document.createElement('canvas');c.width=1248;c.height=240;
  const ctx=c.getContext('2d');ctx.fillStyle='#151d2d';ctx.fillRect(0,0,c.width,c.height);
  const pairs=[['intro_0',null],['intro_3','warn'],['ground_2','motes_2'],['ground_4','motes_4'],['ground_4','release_0'],['ground_6','release_2']];
  for(let i=0;i<pairs.length;i++){
   for(const key of pairs[i])if(key){const f=t.get(key);ctx.drawImage(f.source.image,f.cutX,f.cutY,192,192,8+i*208,32,192,192);}
   ctx.fillStyle='#d5f7ff';ctx.font='14px sans-serif';ctx.fillText(['FROST SPREAD','READY','ERUPTION','SUSTAIN','SHATTER','DISSOLVE'][i],8+i*208,20);
  }
  return c.toDataURL('image/png').split(',')[1];
 })()`);
 await writeFile(out+'/sequence.png',Buffer.from(board,'base64'));
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1500,deviceScaleFactor:1,mobile:true});
 await b.evaluate('bossPreview.seek(1280)');
 const shot=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(shot.data,'base64'));
 const pool=await b.evaluate(`(()=>{
  const s=bossPreview.scene,n=s.children.length;for(let i=0;i<20;i++){bossPreview.seek(1280);bossPreview.seek(3120);}
  const same=n===s.children.length;bossPreview.seek(bossPreview.total);return{same,active:s.vfx.activeCount};
 })()`);
 assert.equal(pool.same,true);assert.equal(pool.active,0);assert.deepEqual(b.errors,[]);
 await writeFile(out+'/result.json',JSON.stringify({rows,pool},null,2));console.log(JSON.stringify({status:'passed',rows,pool}));
}finally{b.close();}
