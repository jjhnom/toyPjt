import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root='src/assets/sandstorm-v1',out='artifacts/sandstorm-reference-20261113';await mkdir(out,{recursive:true});
const source='data:image/png;base64,'+(await readFile(`${root}/sources/generated.png`)).toString('base64');
const b=await launchChrome();
try{
const r=await b.evaluate(`(async()=>{
 const img=new Image();img.src=${JSON.stringify(source)};await img.decode();const cells=[];
 for(let i=0;i<12;i++){
  const col=i%4,row=Math.floor(i/4),x=Math.round(col*img.width/4),y=Math.round(row*img.height/3),w=Math.round((col+1)*img.width/4)-x,h=Math.round((row+1)*img.height/3)-y;
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,x,y,w,h,0,0,w,h);const im=ctx.getImageData(0,0,w,h),d=im.data;
  for(let n=0;n<d.length;n+=4)if(d[n+3]<40||(d[n]>130&&d[n]>d[n+1]*1.8&&d[n]>d[n+2]*1.8)||(d[n]>130&&d[n+1]>110&&d[n+2]<35))d[n+3]=0;
  const seen=new Uint8Array(w*h),keep=new Uint8Array(w*h);
  for(let p=0;p<w*h;p++)if(!seen[p]&&d[p*4+3]){const q=[p];seen[p]=1;for(let a=0;a<q.length;a++){const n=q[a];for(const v of [n%w?n-1:-1,n%w<w-1?n+1:-1,n-w,n+w])if(v>=0&&v<w*h&&!seen[v]&&d[v*4+3]){seen[v]=1;q.push(v);}}if(q.length>100)for(const n of q)keep[n]=1;}
  for(let p=0;p<w*h;p++)if(!keep[p])d[p*4+3]=0;
  ctx.putImageData(im,0,0);
  let best=0,base=Math.round(h*.82);
  for(let yy=Math.round(h*.66);yy<h*.92;yy++){let light=0;for(let dy=-2;dy<=2;dy++)for(let xx=Math.round(w*.22);xx<w*.78;xx++){const n=((yy+dy)*w+xx)*4;if(d[n+3]>128&&d[n]>175&&d[n+1]>130&&d[n+2]>45)light+=d[n+1];}if(light>best){best=light;base=yy;}}
  cells.push({canvas:c,base});
 }
 const size=192,pitch=196,atlas=document.createElement('canvas');atlas.width=784;atlas.height=588;const ctx=atlas.getContext('2d'),frames={},review=[];
 const contact=document.createElement('canvas');contact.width=768;contact.height=576;const cc=contact.getContext('2d');cc.fillStyle='#25283d';cc.fillRect(0,0,768,576);
 // One scale for every frame; anchor is the bright ground contact, not the moving stone bounds.
 const scale=104/(img.height/3*.78);
 for(let i=0;i<12;i++){
  const raw=cells[i],c=document.createElement('canvas');c.width=c.height=size;const cx=c.getContext('2d');cx.imageSmoothingEnabled=true;
  cx.save();cx.beginPath();cx.arc(96,96,93,0,Math.PI*2);cx.clip();cx.drawImage(raw.canvas,Math.round(96-raw.canvas.width*scale/2),Math.round(120-raw.base*scale),Math.round(raw.canvas.width*scale),Math.round(raw.canvas.height*scale));cx.restore();
  const final=cx.getImageData(0,0,size,size),p=final.data;
  for(let n=0;n<p.length;n+=4)if(p[n]>150&&p[n+1]<35&&p[n+2]<35)p[n+3]=0;cx.putImageData(final,0,0);
  let opaque=0,transparent=0,red=0;for(let n=0;n<p.length;n+=4){if(p[n+3]>128)opaque++;if(!p[n+3])transparent++;if(p[n+3]&&p[n]>150&&p[n+1]<35&&p[n+2]<35)red++;}
  const x=2+i%4*pitch,y=2+Math.floor(i/4)*pitch;ctx.drawImage(c,x,y);cc.drawImage(c,i%4*size,Math.floor(i/4)*size);frames['sand_'+i]={frame:{x,y,w:size,h:size},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:size,h:size},sourceSize:{w:size,h:size}};review.push({index:i,scale,sourceBase:raw.base,anchor:[96,120],opaque,transparent,red});
 }
 return {png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],data:{frames,meta:{image:'atlas.png',size:{w:784,h:588},scale:'1'}},review};
})()`);
if(r.review.some(f=>f.opaque<300||f.transparent<20000||f.red))throw Error('Invalid sandstorm frame '+JSON.stringify(r.review));
await writeFile(`${root}/atlas.png`,Buffer.from(r.png,'base64'));await writeFile(`${root}/atlas.json`,JSON.stringify(r.data,null,2)+'\n');await writeFile(`${root}/frame-review.json`,JSON.stringify(r.review,null,2)+'\n');await writeFile(`${out}/contact.png`,Buffer.from(r.contact,'base64'));console.log('12 transparent sandstorm frames baked with fixed scale and ground anchor.');
}finally{b.close();}
