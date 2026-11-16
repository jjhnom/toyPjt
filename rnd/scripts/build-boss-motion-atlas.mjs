import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root=new URL('../src/assets/boss-motion-v2/',import.meta.url);
const layout=JSON.parse(await readFile(new URL('layout.json',root),'utf8'));
const sources=await Promise.all(Object.keys(layout.bosses).map(async id=>({id,data:'data:image/png;base64,'+(await readFile(new URL(`sources/${id}.png`,root))).toString('base64')})));
const b=await launchChrome();
try{
 const result=await b.evaluate(`(async()=>{
  const layout=${JSON.stringify(layout)},frames={},review=[],sources=${JSON.stringify(sources)};
  const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=1664;
  const ctx=atlas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const contact=document.createElement('canvas');contact.width=4*164;contact.height=5*(3*164+26);
  const cc=contact.getContext('2d');cc.imageSmoothingEnabled=false;cc.fillStyle='#182331';cc.fillRect(0,0,contact.width,contact.height);
  let packed=0;
  for(let boss=0;boss<sources.length;boss++){
   const {id,data}=sources[boss],img=new Image();img.src=data;await img.decode();
   const sw=img.width/layout.columns,sh=img.height/layout.rows;
   if(!Number.isInteger(sw)||!Number.isInteger(sh))throw Error('Nonuniform source: '+id);
   cc.fillStyle='#fff';cc.font='16px sans-serif';cc.fillText(id,4,boss*518+20);
   for(let i=0;i<12;i++){
    const col=i%4,row=Math.floor(i/4),canvas=document.createElement('canvas');canvas.width=canvas.height=layout.size;
    const cx=canvas.getContext('2d');cx.imageSmoothingEnabled=false;
    const [ry,rh]=layout.bosses[id].rowBounds[row];
    const dw=Math.round(sw*layout.scale),dh=Math.round(rh*layout.scale),dx=Math.round(layout.anchor[0]-sw/2*layout.scale),dy=Math.round(layout.anchor[1]-(row*sh+layout.bosses[id].feetY[row]-ry)*layout.scale);
    // Source cells include transparent padding below the feet; verify actual pixels rather than that padding.
    const source=document.createElement('canvas');source.width=sw;source.height=rh;const sc=source.getContext('2d');sc.drawImage(img,col*sw,ry,sw,rh,0,0,sw,rh);
    const original=sc.getImageData(0,0,sw,rh).data;let clipped=0;
    for(let y=0;y<rh;y++)for(let x=0;x<sw;x++)if(original[(y*sw+x)*4+3]>0&&(dx+x*dw/sw<0||dx+x*dw/sw>=160||dy+y*dh/rh<0||dy+y*dh/rh>=160)){
      if(original[(y*sw+x)*4+3]>=32)throw Error('Visible art overflow '+id+'/'+i);clipped++;
    }
    cx.drawImage(img,col*sw,ry,sw,rh,dx,dy,dw,dh);
    const pixels=cx.getImageData(0,0,layout.size,layout.size).data;let opaque=0,transparent=0,minX=160,minY=160,maxX=-1,maxY=-1;
    for(let y=0;y<160;y++)for(let x=0;x<160;x++){const a=pixels[(y*160+x)*4+3];if(a===0)transparent++;if(a>=200){opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
    if(!opaque||transparent<layout.size*layout.size*.15)throw Error('Missing body/alpha '+id+'/'+i);
    const key=id+'_motion_'+i,x=2+packed%6*164,y=2+Math.floor(packed/6)*164;
    ctx.drawImage(canvas,x,y);frames[key]={frame:{x,y,w:160,h:160},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:160,h:160},sourceSize:{w:160,h:160}};
    cc.drawImage(canvas,col*164,boss*518+26+row*164);
    review.push({key,motion:layout.motions[row],source:'sources/'+id+'.png',rect:[col*sw,ry,sw,rh],placement:[dx,dy,dw,dh],bodyBounds:[minX,minY,maxX,maxY],opaque,transparent,clippedFaintPixels:clipped});packed++;
   }
  }
  return{png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],review,
   atlas:{frames,meta:{image:'atlas.png',size:{w:1024,h:1664},scale:'1'}},packed};
 })()`);
 assert.equal(result.packed,60);
 await writeFile(new URL('atlas.png',root),Buffer.from(result.png,'base64'));
 await writeFile(new URL('atlas.json',root),JSON.stringify(result.atlas,null,2)+'\n');
 await writeFile(new URL('frame-review.json',root),JSON.stringify(result.review,null,2)+'\n');
 const out=new URL('../artifacts/boss-motion-20261112/',import.meta.url);await mkdir(out,{recursive:true});
 await writeFile(new URL('contact.png',out),Buffer.from(result.contact,'base64'));
 console.log(JSON.stringify({frames:result.packed,atlas:[1024,1664],pngBytes:Buffer.from(result.png,'base64').length}));
}finally{b.close();}
