import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launchChrome} from '../scripts/lib/chrome-cdp.mjs';
const b=await launchChrome(),out='artifacts/sandstorm-periphery-20261113';
try{
 const baseline='data:image/png;base64,'+(await readFile(`${out}/before-ground.png`)).toString('base64');
 await b.send('Page.navigate',{url:'http://127.0.0.1:5173/tools/boss-skill-preview/?boss=desert_emperor&pattern=POISON'});await b.waitFor('!!window.bossPreview');
 const result=await b.evaluate(`(async()=>{
  function metrics(c){const d=c.getContext('2d').getImageData(0,0,192,192).data,sectors=Array.from({length:12},()=>({alpha:0,count:0}));let alpha=0,count=0,covered=0,outside=0;
   for(let y=0;y<192;y++)for(let x=0;x<192;x++){const dx=x+.5-96,dy=y+.5-96,r=Math.hypot(dx,dy),a=d[(y*192+x)*4+3];if(r>=96&&a)outside++;if(r>=80&&r<=94){const i=Math.floor(((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*12);sectors[i].alpha+=a;sectors[i].count++;alpha+=a;count++;if(a>=55)covered++;}}
   return{mean:alpha/count,coverage:covered/count,sectors:sectors.map(s=>s.alpha/s.count),outside};}
  const old=new Image();old.src=${JSON.stringify(baseline)};await old.decode();const c=document.createElement('canvas');c.width=c.height=192;const ctx=c.getContext('2d');ctx.drawImage(old,0,0);const before=metrics(c),texture=bossPreview.scene.textures.get('boss_ground_hd_sand'),frames=[];
  for(let i=0;i<8;i++){ctx.clearRect(0,0,192,192);const f=texture.get('ground_'+i);ctx.drawImage(f.source.image,f.cutX,f.cutY,192,192,0,0,192,192);frames.push(metrics(c));}
  return{before,frames};
 })()`);
 for(const frame of result.frames){assert.ok(frame.mean>result.before.mean*1.5);assert.ok(frame.coverage>result.before.coverage+.15);assert.ok(Math.min(...frame.sectors)>15);assert.equal(frame.outside,0);}
 assert.deepEqual(b.errors,[]);await writeFile(`${out}/periphery-result.json`,JSON.stringify(result,null,2));console.log('All 8 ground frames: stronger outer-band coverage in all 12 sectors, no pixels outside the hazard circle.');
}finally{b.close();}
