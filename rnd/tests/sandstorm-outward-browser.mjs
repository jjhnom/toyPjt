import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launchChrome} from '../scripts/lib/chrome-cdp.mjs';
const b=await launchChrome(),out='artifacts/sandstorm-outward-20261113';
try{
 await b.send('Page.navigate',{url:'http://127.0.0.1:5173/tools/boss-skill-preview/?boss=desert_emperor&pattern=POISON'});await b.waitFor('!!window.bossPreview');
 const report=[];
 for(const phase of [1,2,3]){
  await b.evaluate(`document.getElementById('phase').value='${phase}';document.getElementById('phase').dispatchEvent(new Event('change'))`);
  let previous;
  for(const age of [0,100,200,500,900,1500,2040,2300]){
   const rows=await b.evaluate(`(()=>{bossPreview.seek(${1200+age});return bossPreview.scene.vfx.slots.filter(s=>s?.active).map(s=>({x:s.state.x,y:s.state.y,r:s.state.radius,swirls:s.swirls.filter(i=>i.visible).map(i=>({x:i.x,y:i.y,size:i.displayWidth,mask:i.mask===s.mask,filter:i.frame.source.glTexture.magFilter}))}));})()`);
   assert.equal(rows.length,phase===1?1:2);
   for(const row of rows){assert.equal(row.swirls.length,age<100?1:age<200?2:3);for(const i of row.swirls){assert.ok(Math.hypot(i.x-row.x,i.y-row.y)+i.size/2<=row.r+.001);assert.equal(i.mask,true);assert.equal(i.filter,9729);}}
   if(previous)assert.notDeepEqual(rows[0].swirls[0],previous[0].swirls[0]);if(previous)for(let i=0;i<previous[0].swirls.length;i++){const a=previous[0],p=a.swirls[i],r=rows[0],q=r.swirls[i];assert.ok(Math.hypot(q.x-r.x,q.y-r.y)>=Math.hypot(p.x-a.x,p.y-a.y)-.001);assert.ok(q.size<=p.size+.001);}previous=rows;report.push({phase,age,rows});
  }
 }
 const reuse=await b.evaluate(`(()=>{const s=bossPreview.scene;bossPreview.seek(1700);const count=s.children.length,images=s.vfx.slots.filter(s=>s?.swirls).flatMap(s=>s.swirls);for(let i=0;i<30;i++){bossPreview.seek(2100);bossPreview.seek(0);}bossPreview.seek(4600);return{before:count,after:s.children.length,remaining:images.filter(i=>i.visible).length,active:s.vfx.activeCount};})()`);
 assert.equal(reuse.before,reuse.after);assert.equal(reuse.remaining,0);assert.equal(reuse.active,0);assert.deepEqual(b.errors,[]);
 await writeFile(`${out}/roaming-result.json`,JSON.stringify({samples:report,reuse},null,2));console.log('24 outward scenarios passed: staggered 3 swirls, bounded travel, shared masks, LINEAR, pooled replay and cleanup.');
}finally{b.close();}

