import {readFile,writeFile} from 'node:fs/promises';
import {launchChrome} from './lib/chrome-cdp.mjs';

// Crop/pack the immutable, text-free generated skins. No gameplay content is baked in.
const root=new URL('../src/assets/bottom-hud-v1/',import.meta.url);
const sources=await Promise.all(['parts','backdrop'].map(async id=>({id,data:'data:image/png;base64,'+
 (await readFile(new URL(id+'-source.png',root))).toString('base64')})));
const browser=await launchChrome();
try{
 const result=await browser.evaluate(`(async()=>{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const images={},frames={};for(const source of ${JSON.stringify(sources)}){
   const image=new Image();image.src=source.data;await image.decode();
   if(image.width!==2172||image.height!==724)throw Error('Unexpected source size');images[source.id]=image;
  }
  const frame=(name,x,y,w,h)=>frames[name]={frame:{x,y,w,h},rotated:false,trimmed:false,
   spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}};
  // Preserve the existing 200px dock. The title, slots and controls get separate bands.
  ctx.drawImage(images.backdrop,100,14,1972,116,2,2,720,24);
  ctx.drawImage(images.backdrop,100,130,1972,244,2,26,720,76);
  ctx.drawImage(images.backdrop,100,374,1972,316,2,102,720,100);
  frame('board',2,2,720,200);
  const regions={card:[182,144,262,198,2,206,84,72],empty:[735,148,212,184,90,206,84,72],
   detail:[1710,146,296,192,178,206,132,76],maintenance:[575,407,532,231,314,206,180,84],
   skill:[1135,405,433,233,498,206,128,84],exit:[1595,405,419,233,630,206,140,84],
   joystick:[193,384,292,282,774,206,94,94]};
  for(const[name,[sx,sy,sw,sh,x,y,w,h]]of Object.entries(regions)){
   ctx.save();if(name==='joystick'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.clip();}
   ctx.drawImage(images.parts,sx,sy,sw,sh,x,y,w,h);ctx.restore();frame(name,x,y,w,h);
  }
  return{png:canvas.toDataURL('image/png').split(',')[1],atlas:{frames,meta:{image:'atlas.png',size:{w:1024,h:512},scale:'1'}}};
 })()`);
 await writeFile(new URL('atlas.png',root),Buffer.from(result.png,'base64'));
 await writeFile(new URL('atlas.json',root),JSON.stringify(result.atlas,null,2)+'\n');
 console.log(JSON.stringify({frames:Object.keys(result.atlas.frames),size:[1024,512]}));
}finally{browser.close();}
