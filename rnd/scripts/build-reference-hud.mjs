import {readFile,writeFile} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';

// Pack the text-free generated skins into one runtime atlas; keep all source images intact.
const root=new URL('../src/assets/hud-v1/',import.meta.url);
const rows=await Promise.all(['top','stage'].map(async id=>({id,data:'data:image/png;base64,'+
 (await readFile(new URL(id+'-source.png',root))).toString('base64')})));
const browser=await launchChrome();
try{
 const result=await browser.evaluate(`(async()=>{
  const canvas=document.createElement('canvas');canvas.width=1028;canvas.height=376;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const frames={},regions={top:[16,80,2140,410,2,2,1024,196],stage:[16,155,2140,350,2,202,1024,168]};
  for(const row of ${JSON.stringify(rows)}){
   const image=new Image();image.src=row.data;await image.decode();
   if(image.width!==2172||image.height!==724)throw Error('Unexpected skin dimensions: '+row.id);
   const [sx,sy,sw,sh,x,y,w,h]=regions[row.id];ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);
   frames[row.id]={frame:{x,y,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}};
  }
  return{png:canvas.toDataURL('image/png').split(',')[1],atlas:{frames,meta:{image:'atlas.png',size:{w:1028,h:376},scale:'1'}}};
 })()`);
 await writeFile(new URL('atlas.png',root),Buffer.from(result.png,'base64'));
 await writeFile(new URL('atlas.json',root),JSON.stringify(result.atlas,null,2)+'\n');
 console.log(JSON.stringify({frames:Object.keys(result.atlas.frames),size:[1028,376]}));
}finally{browser.close();}
