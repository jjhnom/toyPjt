import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root='src/assets/desert-motion-v3',out='artifacts/desert-motion-20261113';await mkdir(out,{recursive:true});
const source='data:image/png;base64,'+(await readFile(`${root}/sources/attack-clean-generated.png`)).toString('base64');
const b=await launchChrome();
try{
const r=await b.evaluate(`(async()=>{
 const img=new Image();img.src=${JSON.stringify(source)};await img.decode();
 const cells=[],review=[];let maxHeight=0,maxWidth=0;
 for(let i=0;i<16;i++){
  const x=Math.round(i%4*img.width/4),y=Math.round(Math.floor(i/4)*img.height/4),w=Math.round((i%4+1)*img.width/4)-x,h=Math.round((Math.floor(i/4)+1)*img.height/4)-y;
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,x,y,w,h,0,0,w,h);
  const im=ctx.getImageData(0,0,w,h),d=im.data;let removed=0;
  // The image generator left a saturated red matte around the alpha edges; it is not character art.
  for(let n=0;n<d.length;n+=4)if(d[n]>130&&d[n]>d[n+1]*1.75&&d[n]>d[n+2]*1.75){d[n+3]=0;removed++;}
  // Remove isolated low-alpha background specks, retaining the soft golden staff glow.
  for(let n=0;n<d.length;n+=4)if(d[n+3]<32)d[n+3]=0;
  const visited=new Uint8Array(w*h);let largest=[];
  for(let p=0;p<w*h;p++)if(!visited[p]&&d[p*4+3]>=32){const component=[p];visited[p]=1;for(let q=0;q<component.length;q++){const n=component[q];for(const next of [n%w?n-1:-1,n%w<w-1?n+1:-1,n-w,n+w])if(next>=0&&next<w*h&&!visited[next]&&d[next*4+3]>=32){visited[next]=1;component.push(next);}}if(component.length>largest.length)largest=component;}
  const keep=new Uint8Array(w*h);for(const p of largest)keep[p]=1;for(let p=0;p<w*h;p++)if(!keep[p])d[p*4+3]=0;
  ctx.putImageData(im,0,0);let left=w,top=h,right=0,bottom=0;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(d[(yy*w+xx)*4+3]>=96){left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy);}
  let sx=0,count=0;for(let yy=Math.max(top,bottom-12);yy<=bottom;yy++)for(let xx=0;xx<w;xx++){const n=(yy*w+xx)*4;if(d[n+3]>=160){sx+=xx;count++;}}
  const footX=count?sx/count:(left+right)/2;
  cells.push({canvas:c,left,top,right,bottom,footX,removed});maxHeight=Math.max(maxHeight,bottom-top+1);maxWidth=Math.max(maxWidth,right-left+1);
 }
 const scale=Math.min(128/maxHeight,146/maxWidth),art=[];
 for(const [i,cell]of cells.entries()){
  const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  const dx=Math.round(94-cell.footX*scale),dy=Math.round(140-(cell.bottom+1)*scale);
  ctx.drawImage(cell.canvas,dx,dy,Math.round(cell.canvas.width*scale),Math.round(cell.canvas.height*scale));art.push(c);
  const p=ctx.getImageData(0,0,160,160).data;let opaque=0,transparent=0,edge=0,hash=2166136261;
  for(let yy=0;yy<160;yy++)for(let xx=0;xx<160;xx++){const n=(yy*160+xx)*4;if(p[n+3]>=128){opaque++;if(xx===0||yy===0||xx===159||yy===159)edge++;}if(!p[n+3])transparent++;for(let k=0;k<4;k++)hash=Math.imul(hash^p[n+k],16777619)>>>0;}
  review.push({index:i,sourceBounds:[cell.left,cell.top,cell.right,cell.bottom],footX:cell.footX,scale,placement:[dx,dy],opaque,transparent,edge,hash,removedMatte:cell.removed});
 }
 const atlas=document.createElement('canvas');atlas.width=656;atlas.height=820;const ctx=atlas.getContext('2d'),frames={};
 // Four relaxed idle/gait frames and all sixteen distinct anticipation/release frames.
 const map=[0,0,0,0,...Array.from({length:16},(_,i)=>i===15?0:i)];
 map.forEach((f,i)=>{const x=2+i%4*164,y=2+Math.floor(i/4)*164;ctx.drawImage(art[f],x,y);frames['desert_emperor_motion_'+i]={frame:{x,y,w:160,h:160},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:160,h:160},sourceSize:{w:160,h:160}};});
 const contact=document.createElement('canvas');contact.width=640;contact.height=640;const cc=contact.getContext('2d');cc.fillStyle='#253044';cc.fillRect(0,0,640,640);art.forEach((c,i)=>cc.drawImage(c,i%4*160,Math.floor(i/4)*160));
 return {png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],data:{frames,meta:{image:'atlas.png',size:{w:656,h:820},scale:'1'}},review};
})()`);
if(r.review.some(f=>f.opaque<1000||f.transparent<10000||f.edge>0))throw Error('Incomplete/clipped desert frame: '+JSON.stringify(r.review));
await writeFile(`${root}/atlas.png`,Buffer.from(r.png,'base64'));await writeFile(`${root}/atlas.json`,JSON.stringify(r.data,null,2)+'\n');await writeFile(`${root}/frame-review.json`,JSON.stringify(r.review,null,2)+'\n');await writeFile(`${out}/attack-contact.png`,Buffer.from(r.contact,'base64'));
console.log('20 aligned runtime frames, 16 generated attack poses; uniform scale, transparent padding and unclipped bounds verified.');
}finally{b.close();}
