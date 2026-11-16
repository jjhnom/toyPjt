import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';
const root=new URL('../src/assets/bosses-v1/',import.meta.url),project=new URL('../',import.meta.url);
const layout=JSON.parse(await readFile(new URL('layout.json',root),'utf8'));
const names=[...new Set(Object.values(layout.bosses).flatMap(b=>[b.character,b.effects]))];
const sources=await Promise.all(names.map(async file=>({file,data:'data:image/png;base64,'+
 (await readFile(new URL(layout.sourceRoot+file,project))).toString('base64')})));
const b=await launchChrome();
try{
 const result=await b.evaluate(`(async()=>{
  const layout=${JSON.stringify(layout)},images={},frames={},review=[];
  for(const item of ${JSON.stringify(sources)}){const img=new Image();img.src=item.data;await img.decode();images[item.file]=img;}
  const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=1536;const ctx=atlas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const contact=document.createElement('canvas');contact.width=1000;contact.height=1500;const cc=contact.getContext('2d');
  cc.fillStyle='#182331';cc.fillRect(0,0,1000,1500);cc.imageSmoothingEnabled=false;
  let characterIndex=0,effectIndex=0;
  const pack=(key,canvas,x,y)=>{ctx.drawImage(canvas,x,y);const w=canvas.width,h=canvas.height;
   frames[key]={frame:{x,y,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}};};
  for(const[id,boss]of Object.entries(layout.bosses)){
   const row=Object.keys(layout.bosses).indexOf(id);cc.fillStyle='#fff';cc.font='16px sans-serif';cc.fillText(id,12,row*295+20);
   for(const[pose,entry]of Object.entries(boss.poses)){
    const [sx,sy,sw,sh]=entry.rect,[fx,fy]=entry.foot,s=boss.scale,canvas=document.createElement('canvas');canvas.width=canvas.height=192;
    const cx=canvas.getContext('2d');cx.imageSmoothingEnabled=false;
    const dx=Math.round(96+(sx-fx)*s),dy=Math.round(178+(sy-fy)*s),dw=Math.round(sw*s),dh=Math.round(sh*s);
    if(dx<0||dy<0||dx+dw>192||dy+dh>192)throw Error('Pose exceeds frame: '+id+'/'+pose+' '+[dx,dy,dw,dh]);
    cx.drawImage(images[boss.character],sx,sy,sw,sh,dx,dy,dw,dh);
    pack(id+'_'+pose,canvas,2+characterIndex%5*196,2+Math.floor(characterIndex/5)*196);characterIndex++;
    cc.drawImage(canvas,12+Object.keys(boss.poses).indexOf(pose)*196,row*295+24);
    review.push({key:id+'_'+pose,source:boss.character,rect:entry.rect,foot:entry.foot,placement:[dx,dy,dw,dh]});
   }
   for(const[kind,entry]of Object.entries(boss.rows)){
    const [,ry,,rh]=entry.rect;
    for(let i=0;i<entry.frames.length;i++){
     const col=entry.frames[i],[sx,sw]=layout.effectColumnBounds[entry.columns][col],scale=Math.min(86/sw,70/rh);
     const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
     const cx=canvas.getContext('2d');cx.imageSmoothingEnabled=false;
     const dw=Math.round(sw*scale),dh=Math.round(rh*scale),dx=Math.round(48-dw/2);
     const dy=entry.center?Math.round(48-dh/2):Math.round(76-(entry.footY-ry)*scale);
     if(dy<0||dy+dh>96)throw Error('Effect exceeds frame: '+id+'/'+kind);
     cx.drawImage(images[boss.effects],sx,ry,sw,rh,dx,dy,dw,dh);
     const key=id+'_'+kind+'_'+i;pack(key,canvas,2+effectIndex%10*100,590+Math.floor(effectIndex/10)*100);effectIndex++;
     if(i===2||entry.frames.length===2&&i===1)cc.drawImage(canvas,605+Object.keys(boss.rows).indexOf(kind)%4*96,row*295+26+Math.floor(Object.keys(boss.rows).indexOf(kind)/4)*110);
     review.push({key,source:boss.effects,rect:[sx,ry,sw,rh],placement:[dx,dy,dw,dh]});
    }
   }
  }
  return{png:atlas.toDataURL('image/png').split(',')[1],contact:contact.toDataURL('image/png').split(',')[1],
   atlas:{frames,meta:{image:'atlas.png',size:{w:1024,h:1536},scale:'1'}},review,characterIndex,effectIndex};
 })()`);
 assert.equal(result.characterIndex,15);assert.ok(result.effectIndex<90);
 await writeFile(new URL('atlas.png',root),Buffer.from(result.png,'base64'));
 await writeFile(new URL('atlas.json',root),JSON.stringify(result.atlas,null,2)+'\n');
 await writeFile(new URL('frame-review.json',root),JSON.stringify(result.review,null,2)+'\n');
 const artifact=new URL('../artifacts/boss-redesign-20261112/',import.meta.url);await mkdir(artifact,{recursive:true});
 await writeFile(new URL('atlas-contact.png',artifact),Buffer.from(result.contact,'base64'));
 console.log(JSON.stringify({poses:result.characterIndex,effects:result.effectIndex,atlas:[1024,1536]}));
}finally{b.close();}
