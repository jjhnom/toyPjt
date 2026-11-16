import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root=new URL('../.agent/skills/design/20261112/bossmonster/',import.meta.url);
const files=(await readdir(root)).filter(f=>f.endsWith('.png'));
const sources=await Promise.all(files.map(async file=>({file,data:'data:image/png;base64,'+(await readFile(new URL(file,root))).toString('base64')})));
const b=await launchChrome();
try{
 const rows=await b.evaluate(`(async()=>{const out=[];for(const item of ${JSON.stringify(sources)}){
  const image=new Image();image.src=item.data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const {data}=ctx.getImageData(0,0,c.width,c.height);
  let transparent=0,solid=0,partial=0,left=c.width,top=c.height,right=0,bottom=0;const bands=[0,0,0,0];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const a=data[(y*c.width+x)*4+3];
   if(a===0)transparent++;else if(a===255)solid++;else partial++;
   if(a>0)bands[a<=24?0:a<128?1:a<240?2:3]++;
   if(a>24){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
  out.push({file:item.file,width:c.width,height:c.height,transparent,solid,partial,bands,bounds:[left,top,right,bottom],corner:[...data.slice(0,4)]});
 }return out;})()`);
 await mkdir(new URL('../artifacts/boss-redesign-20261112/',import.meta.url),{recursive:true});
 await writeFile(new URL('../artifacts/boss-redesign-20261112/source-analysis.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
 console.log(JSON.stringify(rows));
}finally{b.close();}
