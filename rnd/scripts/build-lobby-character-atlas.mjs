import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';

// Same Canvas asset-preparation path as build-unit-atlas; source artwork stays intact.
const root=new URL('../src/assets/lobby-characters-v1/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('sources/manifest.json',root),'utf8'));
assert.deepEqual(manifest.map(row=>row.id),['summoner','knight','archer','healer','fireMage']);
const images=await Promise.all(manifest.map(async row=>({id:row.id,
  data:`data:image/png;base64,${(await readFile(new URL(`sources/${row.file}`,root))).toString('base64')}`})));
const browser=await launchChrome();
try{
  const result=await browser.evaluate(`(async()=>{
    const entries=${JSON.stringify(images)},cell=256,columns=3;
    const canvas=document.createElement('canvas');canvas.width=cell*columns;canvas.height=cell*2;
    const out=canvas.getContext('2d');out.imageSmoothingEnabled=true;out.imageSmoothingQuality='high';
    const frames=[];
    for(const [index,entry]of entries.entries()){
      const image=new Image();image.src=entry.data;await image.decode();
      const sample=document.createElement('canvas');sample.width=image.width;sample.height=image.height;
      const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,image.width,image.height).data;
      let left=image.width,top=image.height,right=-1,bottom=-1;
      for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>24){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
      if(right<=left||bottom<=top)throw Error('Empty source: '+entry.id);
      const width=right-left+1,height=bottom-top+1,scale=224/Math.max(width,height);
      const dw=Math.round(width*scale),dh=Math.round(height*scale);
      const x=(index%columns)*cell+Math.floor((cell-dw)/2),y=Math.floor(index/columns)*cell+cell-16-dh;
      out.drawImage(image,left,top,width,height,x,y,dw,dh);
      frames.push({id:entry.id,frame:index,source:{left,top,width,height},atlas:{x,y,width:dw,height:dh}});
    }
    return{png:canvas.toDataURL('image/png').split(',')[1],frames};
  })()`);
  const png=Buffer.from(result.png,'base64');
  await writeFile(new URL('party-atlas.png',root),png);
  await writeFile(new URL('atlas-layout.json',root),JSON.stringify({cell:256,columns:3,frames:result.frames},null,2)+'\n');
  console.log(JSON.stringify({characters:5,width:768,height:512,bytes:png.length}));
}finally{browser.close();}
