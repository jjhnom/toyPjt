import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launchChrome} from '../scripts/lib/chrome-cdp.mjs';
const b=await launchChrome(),out='artifacts/desert-motion-20261113';
try{
 await b.send('Page.navigate',{url:'http://127.0.0.1:5173/tools/boss-skill-preview/?boss=desert_emperor&pattern=POISON'});await b.waitFor('!!window.bossPreview');
 const samples=[];
 for(const [time,index]of [[0,4],[150,5],[450,7],[1050,11],[1199,11],[1200,12],[1280,13],[1520,16],[1760,19],[1840,0]]){
  const r=await b.evaluate(`(()=>{bossPreview.seek(${time});const s=bossPreview.scene,a=s.actor;return{time:${time},frame:a.frame.name,texture:a.texture.key,x:a.x,y:a.y,origin:[a.originX,a.originY],size:[a.displayWidth,a.displayHeight],filter:a.frame.source.glTexture?.magFilter,early:s.hazards.slots.filter(h=>h.active&&h.resolved).length};})()`);
  assert.equal(r.frame,'desert_emperor_motion_'+index);assert.equal(r.texture,'desert_motion_v3');assert.deepEqual(r.size,[144,144]);assert.equal(r.filter,9728);if(time<1200)assert.equal(r.early,0);samples.push(r);
 }
 const hashes=await b.evaluate(`(()=>{const t=bossPreview.scene.textures.get('desert_motion_v3');return [0,19].map(i=>{const f=t.get('desert_emperor_motion_'+i),c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.drawImage(f.source.image,f.cutX,f.cutY,160,160,0,0,160,160);let h=2166136261;for(const n of x.getImageData(0,0,160,160).data)h=Math.imul(h^n,16777619)>>>0;return h;});})()`);assert.equal(hashes[0],hashes[1],'final recovery must exactly match idle');
 for(const id of ['forest_guardian','twilight_king','desert_emperor']){
  await b.evaluate(`document.querySelector('[data-boss="${id}"]').click();bossPreview.seek(1500)`);
  assert.equal(await b.evaluate('bossPreview.scene.actor.texture.key'),id==='desert_emperor'?'desert_motion_v3':'boss_motion_v2');
 }
 assert.deepEqual(b.errors,[]);await writeFile(`${out}/motion-result.json`,JSON.stringify({samples,idleHashes:hashes},null,2));console.log('Desert 8+8 frame timing, exact idle return, nearest filter and boss switching passed.');
}finally{b.close();}

