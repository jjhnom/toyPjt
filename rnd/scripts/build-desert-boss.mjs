import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const out='artifacts/desert-emperor-20261113';await mkdir(out,{recursive:true});
const source='data:image/png;base64,'+(await readFile('.agent/skills/design/20261113/사막의 제왕과 여섯 가지 스킬 시트.png')).toString('base64');
const inputs=await Promise.all(['bosses-v1','boss-motion-v2'].map(async dir=>({dir,data:JSON.parse(await readFile(`src/assets/${dir}/atlas.json`,'utf8')),image:'data:image/png;base64,'+(await readFile(`src/assets/${dir}/atlas.png`)).toString('base64')})));
const browser=await launchChrome();
try{
const result=await browser.evaluate(`(async()=>{
 const source=${JSON.stringify(source)},inputs=${JSON.stringify(inputs)};
 const img=new Image();img.src=source;await img.decode();
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 // Flood only connected dark sheet background, preserving enclosed dark clothing details.
 function cut(x,y,w,h){const c=canvas(w,h),ctx=c.getContext('2d');ctx.drawImage(img,x,y,w,h,0,0,w,h);const im=ctx.getImageData(0,0,w,h),d=im.data,seen=new Uint8Array(w*h),queue=[];
 const push=p=>{if(p<0||p>=w*h||seen[p])return;seen[p]=1;const k=p*4;if(Math.max(d[k],d[k+1],d[k+2])<80&&Math.max(d[k],d[k+1],d[k+2])-Math.min(d[k],d[k+1],d[k+2])<40)queue.push(p);};
 for(let xx=0;xx<w;xx++){push(xx);push((h-1)*w+xx);}for(let yy=0;yy<h;yy++){push(yy*w);push(yy*w+w-1);}for(let q=0;q<queue.length;q++){const p=queue[q];d[p*4+3]=0;if(p%w)push(p-1);if(p%w<w-1)push(p+1);push(p-w);push(p+w);}ctx.putImageData(im,0,0);return c;}
 const xs=[326,464,590,716,878,1014,1177,1340],ws=[132,127,128,135,145,150,157,174];
 const bodies=xs.map((x,i)=>{const raw=cut(x,817,ws[i],132),c=canvas(160,160),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;const scale=Math.min(128/132,150/ws[i]),w=Math.round(ws[i]*scale),h=Math.round(132*scale);ctx.drawImage(raw,Math.round((160-w)/2),140-h,w,h);return c;});
 const contact=canvas(8*160,160),cc=contact.getContext('2d');cc.fillStyle='#253044';cc.fillRect(0,0,contact.width,160);bodies.forEach((c,i)=>cc.drawImage(c,i*160,0));
 const output=[];
 for(const input of inputs){const motion=input.dir==='boss-motion-v2',base=motion?1664:1536,h=motion?1992:1940,c=canvas(1024,h),ctx=c.getContext('2d'),old=new Image();old.src=input.image;await old.decode();ctx.imageSmoothingEnabled=false;ctx.drawImage(old,0,0,1024,base,0,0,1024,base);
 const frames=input.data.frames;for(const k of Object.keys(frames))if(k.startsWith('desert_emperor_'))delete frames[k];
 function add(key,art,x,y,size){ctx.drawImage(art,x,y,size,size);frames[key]={frame:{x,y,w:size,h:size},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:size,h:size},sourceSize:{w:size,h:size}};}
 if(motion){const map=[0,1,2,3,4,4,5,5,6,6,7,7];map.forEach((f,i)=>add('desert_emperor_motion_'+i,bodies[f],2+i%6*164,base+2+Math.floor(i/6)*164,160));}
 else{
  ['idle','cast','charge'].forEach((pose,i)=>{const art=canvas(192,192);art.getContext('2d').drawImage(bodies[[0,5,7][i]],16,38);add('desert_emperor_'+pose,art,2+i*196,base+2,192);});
  const effects=[];for(let row=0;row<2;row++)for(let col=0;col<6;col++)effects.push(cut(938+col*99,591+row*96,89,88));
  for(const [track,indices]of Object.entries({cast:[0,1,2,3],impact:[2,3,4,5],field:[6,7,8,9]}))indices.forEach((f,i)=>{const n=Object.keys({cast:0,impact:1,field:2}).indexOf(track)*4+i;add('desert_emperor_'+track+'_'+i,effects[f],2+n%10*100,base+198+Math.floor(n/10)*100,96);});
 }
 input.data.meta.size={w:1024,h};output.push({dir:input.dir,png:c.toDataURL('image/png').split(',')[1],data:input.data});
 }
 return {output,contact:contact.toDataURL('image/png').split(',')[1]};
})()`);
for(const r of result.output){await writeFile(`src/assets/${r.dir}/atlas.png`,Buffer.from(r.png,'base64'));await writeFile(`src/assets/${r.dir}/atlas.json`,JSON.stringify(r.data,null,2)+'\n');}
await writeFile(`${out}/character-contact.png`,Buffer.from(result.contact,'base64'));
console.log('Desert emperor: 8 source poses mapped to 12 motion frames, 3 static poses and 12 fallback effect frames.');
}finally{browser.close();}
