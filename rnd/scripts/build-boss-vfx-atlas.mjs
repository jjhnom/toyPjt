import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root=new URL('../src/assets/boss-vfx-v2/',import.meta.url);
const layout=JSON.parse(await readFile(new URL('layout.json',root),'utf8'));
const sources=await Promise.all(Object.keys(layout.bosses).map(async id=>({id,data:'data:image/png;base64,'+(await readFile(new URL(`sources/${id}.png`,root))).toString('base64')})));
const b=await launchChrome();
try{
 const result=await b.evaluate(`(async()=>{
  const layout=${JSON.stringify(layout)},sources=${JSON.stringify(sources)},frames={},review=[];
  const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=1824;const ctx=atlas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const contact=document.createElement('canvas');contact.width=800;contact.height=22*110+5*26;const cc=contact.getContext('2d');cc.imageSmoothingEnabled=false;cc.fillStyle='#182331';cc.fillRect(0,0,contact.width,contact.height);
  let index=0,line=0,header=0;
  for(const item of sources){
   const {id,data}=item,img=new Image();img.src=data;await img.decode();const boss=layout.bosses[id],cw=img.width/8,ch=img.height/boss.rows.length;
   cc.fillStyle='#fff';cc.font='16px sans-serif';cc.fillText(id,4,line*110+header*26+20);header++;
   for(const [row,kind]of boss.rows.entries()){
    const [sy,sh]=boss.bounds?.[row]??[Math.round(row*ch),Math.round((row+1)*ch)-Math.round(row*ch)];
    const foot=boss.footY?boss.footY[row]-sy:Math.round(ch*boss.feet[row]);
    // One common scale for the entire row, including small early frames and all alpha padding.
    const maxWidth=boss.columns?Math.max(...boss.columns.map(c=>c[1])):Math.ceil(cw);
    const scale=Math.min(86/maxWidth,70/foot,18/Math.max(1,sh-foot));
    for(let frame=0;frame<8;frame++){
     const [sx,sw]=boss.columns?.[frame]??[Math.round(frame*cw),Math.round((frame+1)*cw)-Math.round(frame*cw)],canvas=document.createElement('canvas');canvas.width=canvas.height=96;
     const cx=canvas.getContext('2d');cx.imageSmoothingEnabled=false;const dw=Math.round(sw*scale),dh=Math.round(sh*scale),dx=Math.round(48-dw/2),dy=Math.round(76-foot*scale);
     if(dx<0||dy<0||dx+dw>96||dy+dh>96)throw Error('Frame overflow '+id+'/'+kind+'/'+frame);
     cx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
     const pixels=cx.getImageData(0,0,96,96).data;let opaque=0,transparent=0,blue=0,purple=0;
     for(let p=0;p<pixels.length;p+=4){if(pixels[p+3]===0)transparent++;if(pixels[p+3]>128){opaque++;if(pixels[p+2]>pixels[p]*1.4&&pixels[p+1]>pixels[p]*1.2)blue++;if(pixels[p]>pixels[p+1]*1.3&&pixels[p+2]>pixels[p+1]*1.3)purple++;}}
     if(opaque<5||transparent<2000)throw Error('Empty/opaque frame '+id+'/'+kind+'/'+frame);
     const x=2+index%10*100,y=2+Math.floor(index/10)*100,key=id+'_'+kind+'_'+frame;
     ctx.drawImage(canvas,x,y);frames[key]={frame:{x,y,w:96,h:96},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:96,h:96},sourceSize:{w:96,h:96}};
     cc.drawImage(canvas,frame*100,line*110+header*26);review.push({key,source:'sources/'+id+'.png',rect:[sx,sy,sw,sh],foot:[sx+sw/2,sy+foot],placement:[dx,dy,dw,dh],opaque,transparent,blue,purple});index++;
    }line++;
   }
  }
  return{png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],review,index,
   atlas:{frames,meta:{image:'atlas.png',size:{w:1024,h:1824},scale:'1'}}};
 })()`);
 assert.equal(result.index,176);
 await writeFile(new URL('atlas.png',root),Buffer.from(result.png,'base64'));
 await writeFile(new URL('atlas.json',root),JSON.stringify(result.atlas,null,2)+'\n');
 await writeFile(new URL('frame-review.json',root),JSON.stringify(result.review,null,2)+'\n');
 const out=new URL('../artifacts/boss-vfx-motion-20261112/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('contact.png',out),Buffer.from(result.contact,'base64'));
 console.log(JSON.stringify({frames:result.index,atlas:[1024,1824],pngBytes:Buffer.from(result.png,'base64').length}));
}finally{b.close();}
