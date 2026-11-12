import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {launchChrome} from './lib/chrome-cdp.mjs';

// Asset preparation: crop the user's labeled sheets, preserve originals and pack only runtime art.
const root=new URL('../src/assets/provided-v1/',import.meta.url);
const names=['frames','buttons','tiles','icons','props'];
const sources=await Promise.all(names.map(async id=>{const bytes=await readFile(new URL(`sources/${id}.png`,root));
  return{id,sha256:createHash('sha256').update(bytes).digest('hex'),data:'data:image/png;base64,'+bytes.toString('base64')};}));
const crops=[
  ['button_primary','buttons',[66,88,674,202],320,96],['button_secondary','buttons',[788,102,601,177],320,96],
  ['button_disabled','buttons',[788,102,601,177],320,96],
  ['tab_selected','buttons',[93,429,603,158],320,80],['tab_normal','buttons',[757,440,599,147],320,80],
  ...['back','plus','minus','pause','close'].map((id,i)=>['control_'+id,'buttons',[[97,743,191,189],[366,743,191,189],[629,743,195,189],[899,743,190,189],[1164,743,194,189]][i],64,64]),
  ['panel','frames',[27,178,665,341],256,128],['popup','frames',[716,180,367,334],256,256],
  ['card','frames',[1114,87,306,465],128,256],
  ...['swords','helmet','book','shop','crown','settings','heart','bolt','gem','coin','skull','hourglass'].map((id,i)=>{
    const boxes=[[63,45,307,235],[427,42,249,237],[739,39,294,240],[1093,44,283,235],
      [58,390,319,221],[434,414,245,195],[747,411,271,196],[1105,401,268,207],
      [66,747,294,196],[432,737,251,200],[759,750,264,187],[1123,754,235,183]];
    return['icon_'+id,'icons',boxes[i],64,64];
  }),
  ...['dungeon','grass','ice','lava'].map((id,i)=>['floor_'+id,'tiles',[[76,136,266,261],[422,135,261,264],[760,137,262,264],[1101,135,260,262]][i],128,128]),
  ['night','tiles',[48,586,1349,304],704,160],
  ...['rock','crystal','barrel','crate','banner'].map((id,i)=>['prop_'+id,'props',[[47,477,278,203],[366,439,232,244],[649,459,196,224],[899,454,246,234],[1175,379,238,301]][i],96,96])
];
const chrome=await launchChrome();
try{
  const result=await chrome.evaluate(`(async()=>{
    const sourceRows=${JSON.stringify(sources)},crops=${JSON.stringify(crops)},images={};
    for(const row of sourceRows){const image=new Image();image.src=row.data;await image.decode();images[row.id]=image;}
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=576;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    let x=2,y=2,rowHeight=0;const frames={},records=[];
    for(const [id,source,box,w,h]of crops){
      if(x+w+2>canvas.width){x=2;y+=rowHeight+4;rowHeight=0;}
      if(y+h+2>canvas.height)throw Error('Atlas overflow: '+id);
      const [sx,sy,sw,sh]=box,image=images[source];
      ctx.filter=id==='button_disabled'?'grayscale(1) brightness(.65)':'none';
      if(id==='panel'){
        // Mirror the clean lower rail for the top: the original top corners contain header ornaments.
        // Each corner occupies 24px, matching providedSkin's fixed panel slice borders.
        const part=(a,b,c,d,e,f,j,k,flipY=false)=>{
          ctx.save();ctx.translate(x+e,y+f+(flipY?k:0));if(flipY)ctx.scale(1,-1);
          ctx.drawImage(image,a,b,c,d,0,0,j,k);ctx.restore();
        };
        part(63,290,593,193,24,24,w-48,h-48);
        part(27,483,36,36,0,0,24,24,true);part(656,483,36,36,w-24,0,24,24,true);
        part(27,483,36,36,0,h-24,24,24);part(656,483,36,36,w-24,h-24,24,24);
        part(63,483,593,36,24,0,w-48,24,true);part(63,483,593,36,24,h-24,w-48,24);
        part(27,290,36,193,0,24,24,h-48);part(656,290,36,193,w-24,24,24,h-48);
      }else if(id.startsWith('icon_')||id.startsWith('prop_')){
        const factor=Math.min((w-4)/sw,(h-4)/sh),dw=Math.round(sw*factor),dh=Math.round(sh*factor);
        ctx.drawImage(image,sx,sy,sw,sh,x+Math.floor((w-dw)/2),y+Math.floor((h-dh)/2),dw,dh);
      }else ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);
      frames[id]={frame:{x,y,w,h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w,h},sourceSize:{w,h}};
      records.push({id,source,box,width:w,height:h});x+=w+4;rowHeight=Math.max(rowHeight,h);
    }
    return{png:canvas.toDataURL('image/png').split(',')[1],atlas:{frames,meta:{image:'atlas.png',size:{w:2048,h:576},scale:'1'}},records};
  })()`);
  const png=Buffer.from(result.png,'base64');await writeFile(new URL('atlas.png',root),png);
  await writeFile(new URL('atlas.json',root),JSON.stringify(result.atlas,null,2)+'\n');
  await writeFile(new URL('sources/manifest.json',root),JSON.stringify({sourceFolder:'.agent/skills/design/20261111',
    sources:sources.map(({id,sha256})=>({id,file:id+'.png',sha256})),regions:result.records},null,2)+'\n');
  console.log(JSON.stringify({regions:result.records.length,bytes:png.length,size:[2048,576]}));
}finally{chrome.close();}
