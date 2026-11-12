import type {SkillShape} from '../types/game';

export type SkillVfxShape=SkillShape|'heal'|'shield'|'buff'|'rune'|'slow'|'poison_support';
export const SKILL_VFX_SHAPES:readonly SkillVfxShape[]=['arrow','streak','fire','frost','star','void','bolt','stone',
  'leaf','slash','thorn','poison','holy','feather','heal','shield','buff','rune','slow','poison_support'];
const hex=(c:number)=>`#${c.toString(16).padStart(6,'0')}`;
type Point=readonly [number,number];

/** Boot-only native artwork, following skill_vfx's silhouettes without its card backgrounds. */
function brush(ctx:CanvasRenderingContext2D){
  const rect=(x:number,y:number,w:number,h:number,c:number,alpha=1)=>{
    ctx.fillStyle=hex(c);ctx.globalAlpha=alpha;ctx.fillRect(Math.round(x),Math.round(y),w,h);ctx.globalAlpha=1;
  };
  const poly=(points:readonly Point[],c:number,alpha=1)=>{
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    ctx.fillStyle=hex(c);ctx.globalAlpha=alpha;ctx.fill();ctx.globalAlpha=1;
  };
  const line=(points:readonly Point[],width:number,c:number,alpha=1)=>{
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=hex(c);ctx.lineWidth=width;ctx.lineJoin='miter';ctx.globalAlpha=alpha;ctx.stroke();ctx.globalAlpha=1;
  };
  const ellipse=(x:number,y:number,rx:number,ry:number,c:number,alpha=1,width=1)=>{
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.strokeStyle=hex(c);
    ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.stroke();ctx.globalAlpha=1;
  };
  const star=(x:number,y:number,s:number,c:number,alpha=1)=>{
    poly([[x,y-s],[x+s*.23,y-s*.23],[x+s,y],[x+s*.23,y+s*.23],
      [x,y+s],[x-s*.23,y+s*.23],[x-s,y],[x-s*.23,y-s*.23]],c,alpha);
  };
  return{rect,poly,line,ellipse,star};
}

function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,c:number,alpha=.3):void{
  ctx.save();const gradient=ctx.createRadialGradient(x,y,1,x,y,r);
  gradient.addColorStop(0,hex(c));gradient.addColorStop(.45,hex(c)+'70');gradient.addColorStop(1,hex(c)+'00');
  ctx.globalAlpha=alpha;ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}

export function paintSkillProjectile(ctx:CanvasRenderingContext2D,shape:SkillVfxShape,c:number,a:number):void{
  const {rect,poly,line,ellipse,star}=brush(ctx),white=0xfff9eb;
  if(shape!=='void')glow(ctx,20,16,14,c,.4);
  switch(shape){
    case 'arrow':case 'streak':case 'holy':
      for(let i=0;i<3;i++)rect(2+i*2,11+i*5,15-i*3,1,c,.45+i*.15);
      poly([[5,14],[21,13],[19,9],[31,16],[19,23],[21,19],[5,18]],c);
      poly([[12,15],[24,14],[22,12],[30,16],[22,20],[24,18],[12,17]],a);
      line([[7,16],[28,16]],1,white);
      if(shape==='holy'){star(9,8,3,a);star(3,23,2,a);}
      if(shape==='streak'){line([[1,8],[17,9],[24,13]],1,a,.8);line([[1,23],[16,22],[23,19]],1,c);}
      break;
    case 'fire':
      poly([[0,11],[12,12],[7,7],[22,9],[30,14],[31,19],[25,25],[9,24],[13,20],[1,23],[8,17]],c);
      poly([[8,13],[17,14],[14,10],[25,13],[29,17],[25,23],[15,21],[19,18],[8,20]],a);
      poly([[17,15],[25,15],[29,18],[24,21],[17,20],[22,18]],white);
      rect(2,6,3,2,a,.8);rect(5,26,3,2,c);rect(0,17,4,1,c,.7);break;
    case 'frost':case 'slow':
      poly([[9,16],[21,6],[30,16],[21,26]],c);poly([[13,16],[21,9],[27,16],[21,23]],a);
      line([[21,8],[21,24],[12,16],[28,16],[21,8]],1,white);
      poly([[1,9],[5,7],[8,10],[4,12]],a,.8);poly([[3,23],[7,20],[10,23],[7,26]],c);
      line([[1,16],[10,16]],2,c,.7);break;
    case 'star':
      star(23,16,9,c);star(23,16,6,a);star(23,16,3,white);
      star(11,13,4,c,.85);star(3,18,2,a,.6);line([[1,16],[15,16]],1,c,.5);break;
    case 'void':
      ctx.shadowColor=hex(c);ctx.shadowBlur=3;
      ellipse(22,16,8,9,c,1,3);ellipse(23,16,6,7,a,.85,1);
      ctx.shadowBlur=0;
      line([[1,19],[8,10],[22,6]],2,c,.7);line([[1,23],[12,26],[23,24]],2,c,.65);
      star(26,9,3,a);star(8,21,2,c);break;
    case 'bolt':
      line([[1,17],[9,13],[14,18],[22,11],[29,16]],5,c,.75);
      line([[1,17],[9,13],[14,18],[22,11],[29,16]],2,a);
      line([[10,14],[7,6],[15,9]],1,a);line([[17,16],[20,25],[28,23]],1,c);
      poly([[23,10],[31,16],[23,22],[26,16]],white);break;
    case 'stone':
      poly([[12,8],[24,6],[30,13],[29,24],[17,28],[9,22],[8,14]],c);
      poly([[12,9],[23,8],[27,13],[18,17],[10,15]],a);
      poly([[18,18],[28,15],[27,23],[18,26]],0x6d5848);
      line([[11,16],[18,18],[18,25]],1,a,.65);
      rect(2,10,4,3,c,.7);rect(1,23,4,3,c,.7);rect(5,18,3,2,a);break;
    case 'leaf':
      poly([[7,19],[12,10],[26,7],[28,14],[21,23],[10,25]],c);
      poly([[11,19],[16,12],[24,10],[21,18],[12,23]],a);
      line([[9,23],[24,10]],1,white,.9);star(5,9,3,c);star(2,22,2,a);break;
    case 'slash':
      for(let y=1;y<31;y++)for(let x=1;x<31;x++){
        const outer=(x-15)**2+(y-16)**2,cut=(x-10)**2+(y-13)**2;
        if(outer<205&&cut>155)rect(x,y,1,1,outer>160?c:a);
      }
      line([[0,12],[11,14],[22,10]],1,c,.7);line([[2,23],[13,23],[24,20]],1,c,.6);
      star(27,16,3,white);break;
    case 'thorn':
      line([[1,18],[8,15],[15,19],[22,14],[30,16]],4,c);
      line([[3,17],[11,16],[18,17],[27,15]],1,a);
      for(const[x,y,d]of[[8,15,-1],[15,19,1],[22,14,-1]])poly([[x-3,y],[x+4,y],[x,y+d*7]],c);
      star(28,16,3,a);break;
    case 'poison':case 'poison_support':
      for(const[x,y,r]of[[11,18,6],[20,16,8],[26,20,4]]){
        ellipse(x,y,r,r,c,.85,3);rect(x-2,y-r+1,3,2,a,.9);
      }
      rect(2,9,3,3,c);rect(7,27,3,2,a,.8);rect(25,5,2,3,c);break;
    case 'feather':
      poly([[3,22],[11,11],[24,7],[30,15],[22,19],[14,23]],c);
      for(let i=0;i<4;i++)poly([[7+i*4,22-i*2],[9+i*4,12-i],[17+i*3,11-i],[14+i*4,17-i]],a);
      line([[5,24],[28,11]],2,white);star(4,12,2,a,.8);break;
    case 'heal':
      rect(13,6,6,21,c);rect(6,13,20,6,c);rect(15,8,2,17,a);rect(8,15,16,2,a);
      star(4,6,3,c,.8);star(27,24,3,a);break;
    case 'shield':
      poly([[16,3],[27,7],[25,21],[16,29],[7,21],[5,7]],c);
      poly([[16,6],[24,9],[22,20],[16,25],[10,20],[8,9]],a);
      line([[16,7],[16,24],[22,19]],1,white);ellipse(16,23,14,6,c,.5);break;
    case 'buff':
      for(const[x,y,s]of[[7,20,4],[16,12,7],[26,20,4]]){
        poly([[x,y-s],[x+s,y],[x+2,y],[x+2,y+8],[x-2,y+8],[x-2,y],[x-s,y]],c);
        rect(x-1,y-2,2,8,a);
      }break;
    case 'rune':
      poly([[16,3],[30,16],[16,29],[2,16]],c,.7);
      line([[16,6],[27,16],[16,26],[5,16],[16,6],[16,26]],1,a);
      line([[5,16],[27,16]],1,white);break;
  }
}

export function paintSkillImpact(ctx:CanvasRenderingContext2D,shape:SkillVfxShape):void{
  const {rect,poly,line,ellipse,star}=brush(ctx),white=0xffffff;
  if(shape!=='void')glow(ctx,16,17,15,white,.45);
  if(shape==='arrow'||shape==='streak'||shape==='star'){
    for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;line([[16,16],[16+Math.cos(a)*12,16+Math.sin(a)*12]],1,white,.45);}
    star(16,16,14,white,.65);star(16,16,10,white);rect(14,14,4,4,white);
    star(5,7,2,white,.7);star(26,24,2,white,.7);return;
  }
  if(shape==='heal'||shape==='holy'||shape==='slow'||shape==='buff'){
    ellipse(16,25,13,4,white,.85,1);ellipse(16,25,9,2,white,.45,1);
    for(const[x,top]of[[7,12],[16,3],[25,10]]){
      poly([[x-3,25],[x,top],[x+3,25]],white,.35);
      rect(x-1,top+4,2,23-top,white,.8);star(x,top+3,3,white);
    }
    if(shape==='buff')paintSkillProjectile(ctx,'buff',white,white);
    if(shape==='slow')line([[11,16],[21,16],[16,11],[16,21]],1,white);
    return;
  }
  if(shape==='shield'){
    ellipse(16,23,14,5,white,.85,1);
    line([[2,23],[3,14],[7,7],[16,3],[25,7],[29,14],[30,23]],2,white,.85);
    line([[3,16],[10,18],[16,15],[23,18],[29,16]],1,white,.4);
    line([[7,7],[10,18],[9,25]],1,white,.4);line([[25,7],[23,18],[24,25]],1,white,.4);
    ellipse(16,23,10,3,white,.35,1);star(20,5,2,white);return;
  }
  if(shape==='rune'){
    ellipse(16,17,14,10,white,.6,1);paintSkillProjectile(ctx,'rune',white,white);return;
  }
  if(shape==='poison'||shape==='poison_support'){
    for(const[x,y,r]of[[8,19,5],[23,19,6],[11,10,4],[23,8,3]])ellipse(x,y,r,r,white,.45,2);
    poly([[10,9],[22,9],[25,13],[24,21],[19,23],[18,27],[14,27],[13,23],[8,21],[7,14]],white,.8);
    // Transparent eye sockets remain legible under the caller's element tint.
    ctx.clearRect(10,14,4,4);ctx.clearRect(19,14,4,4);ctx.clearRect(15,21,2,3);return;
  }
  if(shape==='void'){
    ctx.shadowColor='#ffffff';ctx.shadowBlur=3;
    for(let arm=0;arm<3;arm++){
      const points:Point[]=[];for(let i=0;i<=16;i++){const a=i*.2+arm*Math.PI*2/3,r=7+i*.4;points.push([16+Math.cos(a)*r,16+Math.sin(a)*r]);}
      line(points,2,white,.7);
    }
    ellipse(16,16,8,8,white,.9,2);ctx.shadowBlur=0;
    star(26,8,3,white);star(6,24,2,white);return;
  }
  if(shape==='feather'){
    for(const side of [-1,1])for(let i=0;i<4;i++)poly([[16,23],[16+side*(8+i*2),6+i*3],[16+side*(6+i*2),19+i]],white,.65+i*.1);
    star(16,21,5,white);return;
  }
  if(shape==='frost'){
    for(let i=0;i<6;i++){const a=i*Math.PI/3;line([[16,16],[16+Math.cos(a)*14,16+Math.sin(a)*14]],2,white,.7);}
    poly([[16,4],[24,16],[16,28],[8,16]],white,.7);line([[16,5],[16,27],[8,16],[24,16]],1,white);return;
  }
  if(shape==='bolt'){
    line([[18,1],[12,10],[20,12],[12,23],[17,23],[14,30]],3,white);
    line([[14,11],[5,8],[8,17],[2,22]],1,white,.8);line([[17,17],[27,12],[24,23],[30,25]],1,white,.8);
    star(16,23,7,white);return;
  }
  if(shape==='slash'){paintSkillProjectile(ctx,'slash',white,white);star(23,19,8,white);return;}
  const count=shape==='stone'?6:shape==='leaf'||shape==='thorn'?7:9;
  for(let i=0;i<count;i++){
    const a=i*Math.PI*2/count,r=10+(i%3)*2,x=16+Math.cos(a)*r,y=18+Math.sin(a)*r*.8;
    if(shape==='stone')poly([[x-3,y],[x,y-3],[x+3,y],[x+1,y+3]],white,.5+i%2*.3);
    else poly([[15,20],[x-2,y-2],[x,y-5],[x+2,y]],white,.5+i%3*.2);
  }
  if(shape==='fire'){
    poly([[6,25],[8,15],[13,18],[16,2],[21,17],[26,12],[27,25]],white,.65);
    poly([[11,25],[16,12],[20,25]],white);star(16,24,9,white);
  }else star(16,18,shape==='leaf'?7:11,white);
}

export function paintSkillWave(ctx:CanvasRenderingContext2D,shape:SkillVfxShape):void{
  const {rect,line,ellipse,star}=brush(ctx),white=0xffffff;
  ctx.save();ctx.beginPath();ctx.arc(48,48,42,0,Math.PI*2);ctx.clip();
  // Keep the outside boundary circular and within the real AoE; ground cues flatten at playback.
  ctx.shadowColor='#ffffff';ctx.shadowBlur=5;
  ellipse(48,48,39,39,white,.55,3);ctx.shadowBlur=0;
  ellipse(48,48,41,41,white,.35,2);ellipse(48,48,35,35,white,.3,1);
  const sides=shape==='frost'||shape==='slow'?6:shape==='stone'||shape==='shield'?8:12;
  for(let i=0;i<sides;i++){
    const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;
    const r=shape==='fire'||shape==='feather'?38+(i%2)*3:40;
    const x=48+Math.cos(a)*r,y=48+Math.sin(a)*r;
    line([[x,y],[48+Math.cos(b)*r,48+Math.sin(b)*r]],2,white,.9);
    if(shape==='fire'||shape==='feather')line([[x,y],[48+Math.cos(a+.06)*29,48+Math.sin(a+.06)*29]],2,white,.6);
    else if(shape==='stone')rect(x-3,y-2,6,4,white,.8);
    else if(shape==='leaf'||shape==='thorn')line([[x,y],[48+Math.cos(a+.1)*32,48+Math.sin(a+.1)*32]],3,white,.65);
    else if(i%2===0)star(x,y,shape==='star'?5:3,white);
  }
  // Bright, deterministic edge fragments retain the source concepts' texture at mobile sizes.
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,r=34+(i*7%8),x=48+Math.cos(a)*r,y=48+Math.sin(a)*r;
    if(shape==='fire'||shape==='feather'){
      const b=a+.12;line([[48+Math.cos(b)*29,48+Math.sin(b)*29],[x,y]],i%3===0?3:2,white,.4+i%3*.2);
    }else if(shape==='frost'||shape==='slow'){
      if(i%4===0){line([[x-3,y],[x,y-6],[x+3,y],[x,y+5],[x-3,y]],1,white,.9);}
    }else if(shape==='bolt'){
      line([[48+Math.cos(a)*33,48+Math.sin(a)*33],[48+Math.cos(a+.06)*40,48+Math.sin(a+.06)*40],[x,y]],1,white,.75);
    }else if(shape==='leaf'||shape==='thorn'){
      if(i%2===0)line([[x-2,y-3],[x+2,y+3]],3,white,.7);
    }else if(i%3===0)star(x,y,2,white,.7);
  }
  if(shape==='void'){
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;line([[48+Math.cos(a)*29,48+Math.sin(a)*29],
      [48+Math.cos(a+.4)*35,48+Math.sin(a+.4)*35],[48+Math.cos(a+.8)*40,48+Math.sin(a+.8)*40]],2,white,.6);}
  }
  if(shape==='heal'||shape==='holy'||shape==='rune'||shape==='buff'){
    ellipse(48,48,32,32,white,.45,1);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;star(48+Math.cos(a)*37,48+Math.sin(a)*37,5,white);}
  }
  if(shape==='rune')line([[48,20],[76,48],[48,76],[20,48],[48,20]],1,white,.6);
  if(shape==='buff'){
    line([[48,28],[48,66]],3,white,.8);line([[35,43],[48,28],[61,43]],3,white,.8);
  }
  ctx.restore();
}
