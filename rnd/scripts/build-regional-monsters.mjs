import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {load} from './lib/load-typescript.mjs';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root='src/assets/monsters-v1',out='artifacts/regional-monsters-20261116';await mkdir(out,{recursive:true});
const ids=load('src/config/monsterData.ts').REGIONAL_MONSTERS.map(m=>m.id),source='data:image/png;base64,'+(await readFile(`${root}/sources/generated.png`)).toString('base64');
const b=await launchChrome();try{
 const r=await b.evaluate(`(async()=>{
 const ids=${JSON.stringify(ids)},img=new Image();img.src=${JSON.stringify(source)};await img.decode();const atlas=document.createElement('canvas');atlas.width=448;atlas.height=504;const ctx=atlas.getContext('2d'),frames={},review=[];
 const contact=document.createElement('canvas');contact.width=3*156;contact.height=6*156;const cc=contact.getContext('2d');cc.imageSmoothingEnabled=false;cc.fillStyle='#25283d';cc.fillRect(0,0,contact.width,contact.height);
 for(let i=0;i<18;i++){
  const col=i%3,row=Math.floor(i/3),x=Math.round(col*img.width/3),y=Math.round(row*img.height/6),w=Math.round((col+1)*img.width/3)-x,h=Math.round((row+1)*img.height/6)-y;
  const raw=document.createElement('canvas');raw.width=w;raw.height=h;const rc=raw.getContext('2d');rc.drawImage(img,x,y,w,h,0,0,w,h);const im=rc.getImageData(0,0,w,h),d=im.data;
  for(let n=0;n<d.length;n+=4)if(d[n+3]<24||(d[n]>220&&d[n+1]<25&&d[n+2]<25)||(d[n+2]>220&&d[n]<25&&d[n+1]<25)||(d[n]>220&&d[n+2]>200&&d[n+1]<25))d[n+3]=0;
  const seen=new Uint8Array(w*h);let largest=[];for(let p=0;p<w*h;p++)if(!seen[p]&&d[p*4+3]){const q=[p];seen[p]=1;for(let a=0;a<q.length;a++){const n=q[a];for(const v of [n%w?n-1:-1,n%w<w-1?n+1:-1,n-w,n+w])if(v>=0&&v<w*h&&!seen[v]&&d[v*4+3]){seen[v]=1;q.push(v);}}if(q.length>largest.length)largest=q;}
  const keep=new Uint8Array(w*h);for(const p of largest)keep[p]=1;let left=w,top=h,right=0,bottom=0;for(let p=0;p<w*h;p++){if(!keep[p])d[p*4+3]=0;if(d[p*4+3]>=128){left=Math.min(left,p%w);right=Math.max(right,p%w);top=Math.min(top,Math.floor(p/w));bottom=Math.max(bottom,Math.floor(p/w));}}rc.putImageData(im,0,0);
  const sw=right-left+1,sh=bottom-top+1,scale=Math.min(46/sw,46/sh),dw=Math.round(sw*scale),dh=Math.round(sh*scale);
  for(let f=0;f<4;f++){
   const cell=document.createElement('canvas');cell.width=cell.height=52;const cx=cell.getContext('2d');cx.imageSmoothingEnabled=false;cx.drawImage(raw,left,top,sw,sh,Math.round((52-dw)/2),49-dh+[0,-1,0,1][f],dw,dh);
   const p=cx.getImageData(0,0,52,52).data;let opaque=0,transparent=0,edge=0;for(let yy=0;yy<52;yy++)for(let xx=0;xx<52;xx++){const a=p[(yy*52+xx)*4+3];if(a>128){opaque++;if(!xx||!yy||xx===51||yy===51)edge++;}if(!a)transparent++;}
   const n=i*4+f,px=2+n%8*56,py=2+Math.floor(n/8)*56,key=ids[i]+'_'+f;ctx.drawImage(cell,px,py);frames[key]={frame:{x:px,y:py,w:52,h:52},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:52,h:52},sourceSize:{w:52,h:52}};review.push({key,sourceBounds:[left,top,right,bottom],opaque,transparent,edge});if(f===0)cc.drawImage(cell,col*156,row*156,156,156);
  }
 }
 return{png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],data:{frames,meta:{image:'atlas.png',size:{w:448,h:504},scale:'1'}},review};
 })()`);
 if(r.review.length!==72||r.review.some(f=>f.opaque<80||f.edge||f.transparent<1000))throw Error('Invalid monster frames');
 await writeFile(`${root}/atlas.png`,Buffer.from(r.png,'base64'));await writeFile(`${root}/atlas.json`,JSON.stringify(r.data,null,2)+'\n');await writeFile(`${root}/frame-review.json`,JSON.stringify(r.review,null,2)+'\n');await writeFile(`${out}/contact.png`,Buffer.from(r.contact,'base64'));console.log('18 regional monsters, 72 transparent 52px frames built.');
}finally{b.close();}
